/**
 * Streaming Research API - SSE endpoint for real-time progress
 *
 * Sends events as each model completes:
 * - model_complete: { model: string, success: boolean }
 * - synthesis_start: {}
 * - complete: { result: ResearchResult }
 * - error: { message: string }
 */

import { NextRequest } from 'next/server'
import { generateText } from 'ai'
import { createOpenRouter } from '@openrouter/ai-sdk-provider'
import type { ResearchResult, ModelResponse, ModelOption, Attachment } from '@/types'
import {
  MODEL_OPTIONS,
  ORCHESTRATOR_OPTIONS,
  DEFAULT_MODELS,
  DEFAULT_ORCHESTRATOR,
  DEFAULT_ORCHESTRATOR_PROMPT,
} from '@/config/models'
import { calculateCost } from '@/lib/pricing'

export const runtime = 'nodejs'
export const maxDuration = 800

const RESEARCH_SYSTEM_PROMPT = `You are an expert research assistant with built-in web search.

GUIDELINES:
- Search the web for current information when relevant
- Provide thorough, well-reasoned answers with citations
- Be direct and confident - ground your response in facts
- Structure responses clearly

FORMAT:
- 400-600 words
- Use markdown: ## headers, **bold**, bullets
- Cite web sources when using current data
- End with practical takeaways`

export async function POST(request: NextRequest) {
  const encoder = new TextEncoder()

  // Create a readable stream
  const stream = new ReadableStream({
    async start(controller) {
      const sendEvent = (event: string, data: unknown) => {
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`))
      }

      try {
        const body = await request.json()
        const { query, attachments = [], modelIds, orchestratorId, orchestratorPrompt, apiKey, byokMode } = body

        if (!query) {
          sendEvent('error', { message: 'Query is required' })
          controller.close()
          return
        }

        const startTime = Date.now()

        // API Key validation
        const forceBYOK = process.env.FORCE_BYOK === 'true'
        const key = apiKey || (byokMode || forceBYOK ? undefined : process.env.OPENROUTER_API_KEY)

        if (!key) {
          sendEvent('error', { message: 'API key required. Please add your OpenRouter key in Settings.' })
          controller.close()
          return
        }

        const openrouter = createOpenRouter({ apiKey: key })
        const synthesizerModelId = orchestratorId || DEFAULT_ORCHESTRATOR

        // Parse attachments
        const imageAttachments = (attachments as Attachment[]).filter((a) => a.type === 'image')
        const pdfAttachments = (attachments as Attachment[]).filter((a) => a.type === 'pdf')
        const textAttachments = (attachments as Attachment[]).filter((a) => a.type === 'text')
        const hasImages = imageAttachments.length > 0
        const hasPdfs = pdfAttachments.length > 0

        // Build enhanced query with text attachments
        let enhancedQuery = query
        if (textAttachments.length > 0) {
          const textContent = textAttachments.map((a) => `--- ${a.name} ---\n${a.content}`).join('\n\n')
          enhancedQuery = `${query}\n\n[Attached Files]\n${textContent}`
        }

        // Get models
        const ids = modelIds?.length ? modelIds : DEFAULT_MODELS
        const models = ids
          .map((id: string) => MODEL_OPTIONS.find((m) => m.id === id))
          .filter((m: ModelOption | undefined): m is ModelOption => m !== undefined)

        if (models.length === 0) {
          sendEvent('error', { message: 'No valid models selected' })
          controller.close()
          return
        }

        // Build messages for each model
        const buildMessages = (model: ModelOption) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const messages: any[] = [{ role: 'system', content: RESEARCH_SYSTEM_PROMPT }]
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const content: any[] = []
          let queryText = enhancedQuery

          if (hasImages && !model.supportsVision) {
            queryText = `[Note: ${imageAttachments.length} image(s) attached but not visible to this model]\n\n${queryText}`
          }

          content.push({ type: 'text', text: queryText })

          if (hasImages && model.supportsVision) {
            for (const img of imageAttachments) {
              content.push({ type: 'image', image: `data:${img.mimeType};base64,${img.content}` })
            }
          }

          if (hasPdfs) {
            for (const pdf of pdfAttachments) {
              content.push({ type: 'file', data: `data:${pdf.mimeType};base64,${pdf.content}`, mimeType: pdf.mimeType })
            }
          }

          if ((hasImages && model.supportsVision) || hasPdfs) {
            messages.push({ role: 'user', content })
          } else {
            messages.push({ role: 'user', content: queryText })
          }

          return messages
        }

        // Query all models in parallel, but send events as each completes
        const responses: ModelResponse[] = []

        await Promise.all(
          models.map(async (model: ModelOption) => {
            const modelStart = Date.now()
            try {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const options: any = {
                model: openrouter(model.id),
                messages: buildMessages(model),
                maxTokens: 2500,
              }

              if (model.reasoning === 'enabled') {
                options.experimental_providerMetadata = {
                  openrouter: { reasoning: { enabled: true } },
                }
              } else if (model.reasoning === 'low' || model.reasoning === 'high') {
                options.experimental_providerMetadata = {
                  openrouter: { reasoning: { effort: model.reasoning } },
                }
              }

              const result = await generateText(options)
              const usage = result.usage
                ? {
                    promptTokens: result.usage.promptTokens || 0,
                    completionTokens: result.usage.completionTokens || 0,
                    totalTokens: result.usage.totalTokens || 0,
                  }
                : undefined

              const response: ModelResponse = {
                model: model.name,
                modelId: model.id,
                content: result.text,
                success: true,
                durationMs: Date.now() - modelStart,
                usage,
                cost: calculateCost(model.id, usage),
              }

              responses.push(response)
              // Send event immediately when model completes
              sendEvent('model_complete', { model: model.name, success: true })
            } catch (error) {
              const response: ModelResponse = {
                model: model.name,
                modelId: model.id,
                content: '',
                success: false,
                error: error instanceof Error ? error.message : String(error),
                durationMs: Date.now() - modelStart,
              }
              responses.push(response)
              sendEvent('model_complete', { model: model.name, success: false })
            }
          })
        )

        const successful = responses.filter((r) => r.success)

        // Handle complete failure
        if (successful.length === 0) {
          const result: ResearchResult = {
            query,
            responses,
            synthesis: 'All models failed to respond. Please check your API key and try again.',
            totalDurationMs: Date.now() - startTime,
            modelCount: models.length,
            successCount: 0,
            timestamp: new Date().toISOString(),
            orchestrator: synthesizerModelId,
          }
          sendEvent('complete', { result })
          controller.close()
          return
        }

        // Synthesis phase
        sendEvent('synthesis_start', {})

        const responsesBlock = successful.map((r) => `### ${r.model}\n${r.content}`).join('\n\n---\n\n')
        const customPrompt = orchestratorPrompt || DEFAULT_ORCHESTRATOR_PROMPT

        const synthesisPrompt = `Synthesize these AI model responses to: "${query.slice(0, 200)}"

${responsesBlock}

${customPrompt}`

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const orchestratorOptions: any = {
          model: openrouter(synthesizerModelId),
          messages: [{ role: 'user', content: synthesisPrompt }],
          maxTokens: 1500,
        }

        const synthesisResult = await generateText(orchestratorOptions)
        const orchestratorName =
          ORCHESTRATOR_OPTIONS.find((o) => o.id === synthesizerModelId)?.name || synthesizerModelId

        const result: ResearchResult = {
          query,
          responses,
          synthesis: synthesisResult.text,
          totalDurationMs: Date.now() - startTime,
          modelCount: models.length,
          successCount: successful.length,
          totalCost: responses.reduce((sum, r) => sum + (r.cost || 0), 0),
          timestamp: new Date().toISOString(),
          orchestrator: orchestratorName,
        }

        sendEvent('complete', { result })
        controller.close()
      } catch (error) {
        sendEvent('error', { message: error instanceof Error ? error.message : 'Research failed' })
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  })
}
