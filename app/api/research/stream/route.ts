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
import { auth } from '@clerk/nextjs/server'
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
import { calculateCost, fetchGenerationStats, estimateCostFromText } from '@/lib/pricing'
import { checkUsageAllowed, addAnonymousUsage, deductUserCredits } from '@/server/queries/usage'
import {
  createResearchQuery,
  createModelCall,
  updateResearchQuery,
  type ResearchQueryRecord,
} from '@/server/queries/analytics'

export const runtime = 'nodejs'
export const maxDuration = 800

// OpenRouter-specific error codes
const OPENROUTER_ERRORS = {
  CREDIT_EXHAUSTED: 'openrouter_credits_exhausted',
  RATE_LIMITED: 'openrouter_rate_limited',
  QUOTA_EXCEEDED: 'openrouter_quota_exceeded',
} as const

/**
 * Parse OpenRouter-specific error from error message.
 * Returns error code or null if not an OpenRouter error.
 */
function parseOpenRouterError(errorMessage: string): string | null {
  const msg = errorMessage.toLowerCase()

  if (msg.includes('insufficient credits') || msg.includes('credit balance') || msg.includes('no credits')) {
    return OPENROUTER_ERRORS.CREDIT_EXHAUSTED
  }
  if (msg.includes('rate limit')) {
    return OPENROUTER_ERRORS.RATE_LIMITED
  }
  if (msg.includes('quota') || msg.includes('limit exceeded')) {
    return OPENROUTER_ERRORS.QUOTA_EXCEEDED
  }
  return null
}

/**
 * Send urgent Slack alert for OpenRouter credit exhaustion.
 */
async function sendOpenRouterCreditAlert(): Promise<void> {
  const webhookUrl = process.env.SLACK_WEBHOOK_EACHIE_MONEY
  if (!webhookUrl) return

  try {
    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: '🚨 URGENT: OpenRouter credits exhausted! Users seeing errors.\n' +
          'Top up at: https://openrouter.ai/account',
      }),
    })
  } catch (error) {
    console.error('[Research] Failed to send credit alert:', error)
  }
}

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

        // Get device ID from header (for anonymous usage tracking)
        const deviceId = request.headers.get('X-Device-ID') || undefined

        // Get authenticated user ID (if signed in)
        const { userId } = await auth()

        // Check usage limits (skip if BYOK - no cost to us)
        // Only check if DATABASE_URL is configured (graceful degradation)
        if (process.env.DATABASE_URL && !byokMode && !apiKey) {
          try {
            const usageCheck = await checkUsageAllowed({
              byokMode: false,
              deviceId,
              userId: userId ?? undefined,
            })

            if (!usageCheck.allowed) {
              switch (usageCheck.reason) {
                case 'free_tier_exhausted':
                  sendEvent('error', {
                    message: 'Free research limit reached. Sign in to continue.',
                    code: 'FREE_TIER_EXHAUSTED',
                  })
                  break
                case 'free_tier_paused':
                  sendEvent('error', {
                    message: 'Free research is temporarily paused due to high demand. Sign in to continue.',
                    code: 'FREE_TIER_PAUSED',
                  })
                  break
                case 'rate_limited':
                  sendEvent('error', {
                    message: `Too many requests. Please wait ${usageCheck.retryAfter || 'a moment'} and try again.`,
                    code: 'RATE_LIMITED',
                  })
                  break
                case 'insufficient_credits':
                  sendEvent('error', {
                    message: 'Insufficient credits. Please add credits to continue.',
                    code: 'INSUFFICIENT_CREDITS',
                  })
                  break
              }
              controller.close()
              return
            }
          } catch (dbError) {
            // Database not available - allow query but log warning
            console.warn('[Research] Database check failed, allowing query:', dbError)
          }
        }

        // API Key validation
        const forceBYOK = process.env.FORCE_BYOK === 'true'
        const key = apiKey || (byokMode || forceBYOK ? undefined : process.env.OPENROUTER_API_KEY)

        if (!key) {
          sendEvent('error', { message: 'API key required. Please add your OpenRouter key in Settings.' })
          controller.close()
          return
        }

        const openrouter = createOpenRouter({
          apiKey: key,
          headers: {
            'HTTP-Referer': 'https://eachie.ai',
            'X-Title': 'Eachie',
          },
        })
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

        // Create analytics record for this research query
        let analyticsQueryId: string | undefined
        if (process.env.DATABASE_URL && deviceId) {
          try {
            // Determine billing type
            const billingType: 'free_tier' | 'credits' | 'byok' =
              byokMode || apiKey ? 'byok' : 'free_tier'

            // Extract attachment extensions
            const attachmentExts = (attachments as Attachment[]).map(a => {
              const name = a.name || ''
              const dotIndex = name.lastIndexOf('.')
              return dotIndex >= 0 ? name.slice(dotIndex).toLowerCase() : ''
            }).filter(Boolean)

            const record: ResearchQueryRecord = {
              device_id: deviceId,
              query_text: query,
              selected_model_ids: models.map((m: ModelOption) => m.id),
              orchestrator_id: synthesizerModelId,
              attachment_extensions: attachmentExts,
              billing_type: billingType,
            }

            analyticsQueryId = await createResearchQuery(record)
          } catch (analyticsError) {
            console.warn('[Research] Failed to create analytics record:', analyticsError)
          }
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

              const durationMs = Date.now() - modelStart

              // === COST HIERARCHY ===
              // 1. Try OpenRouter Generation API for actual cost
              // 2. Fall back to token-based calculation
              // 3. Fall back to text-length estimation (with ~flag)
              let cost = 0
              let isEstimatedCost = false
              const generationId = result.response?.id

              // Level 1: Query OpenRouter's Generation API for actual cost
              if (generationId && key) {
                const stats = await fetchGenerationStats(generationId, key)
                if (stats?.total_cost && stats.total_cost > 0) {
                  cost = stats.total_cost
                }
              }

              // Level 2: Calculate from token counts
              if (cost === 0 && usage && (usage.promptTokens > 0 || usage.completionTokens > 0)) {
                cost = calculateCost(model.id, usage)
              }

              // Level 3: Estimate from text length (last resort)
              if (cost === 0 && result.text) {
                const inputText = buildMessages(model)
                  .map(m => typeof m.content === 'string' ? m.content : '')
                  .join('\n')
                const estimate = estimateCostFromText(model.id, inputText, result.text)
                if (estimate) {
                  cost = estimate.cost
                  isEstimatedCost = true
                }
              }

              const response: ModelResponse = {
                model: model.name,
                modelId: model.id,
                content: result.text,
                success: true,
                durationMs,
                usage,
                cost,
                isEstimatedCost: isEstimatedCost || undefined,
              }

              responses.push(response)
              // Send event immediately when model completes
              sendEvent('model_complete', { model: model.name, success: true })

              // Record model call in analytics
              if (analyticsQueryId) {
                try {
                  await createModelCall({
                    research_query_id: analyticsQueryId,
                    model_id: model.id,
                    model_name: model.name,
                    provider: model.provider,
                    success: true,
                    response_text: result.text,
                    duration_ms: durationMs,
                    prompt_tokens: usage?.promptTokens,
                    completion_tokens: usage?.completionTokens,
                    total_tokens: usage?.totalTokens,
                    cost_cents: cost ? Math.round(cost * 100) : undefined,
                    reasoning_mode: model.reasoning || 'none',
                    used_vision: hasImages && model.supportsVision,
                    used_pdf: hasPdfs,
                  })
                } catch (e) {
                  console.warn('[Research] Failed to record model call:', e)
                }
              }
            } catch (error) {
              const durationMs = Date.now() - modelStart
              const errorMessage = error instanceof Error ? error.message : String(error)

              // Check for OpenRouter-specific errors
              const orError = parseOpenRouterError(errorMessage)

              // Send urgent alert for credit exhaustion (only once per request)
              if (orError === OPENROUTER_ERRORS.CREDIT_EXHAUSTED && !byokMode) {
                // Fire and forget - don't block the response
                sendOpenRouterCreditAlert()
              }

              const response: ModelResponse = {
                model: model.name,
                modelId: model.id,
                content: '',
                success: false,
                error: errorMessage,
                errorCode: orError || undefined,
                durationMs,
              }
              responses.push(response)
              sendEvent('model_complete', {
                model: model.name,
                success: false,
                errorCode: orError || undefined,
              })

              // Record failed model call in analytics
              if (analyticsQueryId) {
                try {
                  // Categorize error (prefer OpenRouter error code)
                  let errorCode = orError || 'UNKNOWN'
                  if (!orError) {
                    if (errorMessage.includes('timeout')) errorCode = 'TIMEOUT'
                    else if (errorMessage.includes('401') || errorMessage.includes('auth')) errorCode = 'AUTH_ERROR'
                  }

                  await createModelCall({
                    research_query_id: analyticsQueryId,
                    model_id: model.id,
                    model_name: model.name,
                    provider: model.provider,
                    success: false,
                    error_code: errorCode,
                    error_message: errorMessage,
                    duration_ms: durationMs,
                    reasoning_mode: model.reasoning || 'none',
                  })
                } catch (e) {
                  console.warn('[Research] Failed to record model call error:', e)
                }
              }
            }
          })
        )

        const successful = responses.filter((r) => r.success)

        // Handle complete failure
        if (successful.length === 0) {
          // Update analytics for complete failure
          if (analyticsQueryId) {
            try {
              await updateResearchQuery(analyticsQueryId, {
                success_count: 0,
                failure_count: responses.length,
                error_code: 'ALL_MODELS_FAILED',
                error_type: 'model_error',
                total_duration_ms: Date.now() - startTime,
              })
            } catch (e) {
              console.warn('[Research] Failed to update analytics:', e)
            }
          }

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

        // Calculate orchestrator cost using the same hierarchy
        const orchestratorUsage = synthesisResult.usage
          ? {
              promptTokens: synthesisResult.usage.promptTokens || 0,
              completionTokens: synthesisResult.usage.completionTokens || 0,
            }
          : undefined

        let orchestratorCost = 0
        let orchestratorCostEstimated = false
        const orchestratorGenId = synthesisResult.response?.id

        // Level 1: Try OpenRouter's Generation API
        if (orchestratorGenId && key) {
          const stats = await fetchGenerationStats(orchestratorGenId, key)
          if (stats?.total_cost && stats.total_cost > 0) {
            orchestratorCost = stats.total_cost
          }
        }

        // Level 2: Calculate from token counts
        if (orchestratorCost === 0 && orchestratorUsage && (orchestratorUsage.promptTokens > 0 || orchestratorUsage.completionTokens > 0)) {
          orchestratorCost = calculateCost(synthesizerModelId, orchestratorUsage)
        }

        // Level 3: Estimate from text length
        if (orchestratorCost === 0 && synthesisResult.text) {
          const estimate = estimateCostFromText(synthesizerModelId, synthesisPrompt, synthesisResult.text)
          if (estimate) {
            orchestratorCost = estimate.cost
            orchestratorCostEstimated = true
          }
        }

        // Total = all model costs + orchestrator cost
        const modelsCost = responses.reduce((sum, r) => sum + (r.cost || 0), 0)
        const totalCost = modelsCost + orchestratorCost

        // Check if any costs were estimated
        const hasEstimatedCosts = orchestratorCostEstimated || responses.some(r => r.isEstimatedCost)

        const result: ResearchResult = {
          query,
          responses,
          synthesis: synthesisResult.text,
          totalDurationMs: Date.now() - startTime,
          modelCount: models.length,
          successCount: successful.length,
          totalCost,
          hasEstimatedCosts: hasEstimatedCosts || undefined,
          timestamp: new Date().toISOString(),
          orchestrator: orchestratorName,
        }

        // Record cost for anonymous users (skip if BYOK or no database)
        if (process.env.DATABASE_URL && deviceId && !byokMode && !apiKey && totalCost > 0) {
          try {
            // Convert dollars to cents (totalCost is in dollars)
            const costCents = Math.round(totalCost * 100)
            await addAnonymousUsage(deviceId, costCents)
          } catch (dbError) {
            // Log but don't fail the request
            console.warn('[Research] Failed to record usage:', dbError)
          }
        }

        // Deduct credits for authenticated users (handles super_admin tracking)
        if (process.env.DATABASE_URL && userId && !byokMode && totalCost > 0) {
          try {
            const costCents = Math.round(totalCost * 100)
            await deductUserCredits(userId, costCents)
          } catch (dbError) {
            console.warn('[Research] Failed to deduct user credits:', dbError)
          }
        }

        // Update analytics record with final totals
        if (analyticsQueryId) {
          try {
            await updateResearchQuery(analyticsQueryId, {
              success_count: successful.length,
              failure_count: responses.length - successful.length,
              synthesis_text: synthesisResult.text,
              total_cost_cents: Math.round(totalCost * 100),
              total_duration_ms: Date.now() - startTime,
            })
          } catch (e) {
            console.warn('[Research] Failed to update analytics:', e)
          }
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
