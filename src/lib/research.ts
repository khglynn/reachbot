/**
 * Research Library - Core logic for multi-model AI research
 *
 * Handles parallel model queries, synthesis, and cost tracking.
 * Supports BYOK mode where server keys are disabled.
 *
 * This file runs on the server (in API routes) and handles:
 * - Querying multiple AI models via OpenRouter
 * - Adding reasoning configuration for thinking models
 * - Calculating costs based on token usage
 * - Synthesizing responses with an orchestrator model
 *
 * @module lib/research
 */

import { generateText } from 'ai'
import { createOpenRouter } from '@openrouter/ai-sdk-provider'
import type { ResearchRequest, ResearchResult, ModelResponse, ModelOption, Attachment } from '@/types'
import {
  MODEL_OPTIONS,
  ORCHESTRATOR_OPTIONS,
  DEFAULT_MODELS,
  DEFAULT_ORCHESTRATOR,
  DEFAULT_ORCHESTRATOR_PROMPT,
} from '@/config/models'
import { calculateCost } from '@/lib/pricing'

// Re-export types for API route convenience
export type { ResearchRequest, ResearchResult, ModelResponse }

// ============================================================
// SYSTEM PROMPTS
// ============================================================

/**
 * System prompt sent to all research models.
 * Guides them to provide well-structured, research-focused responses.
 */
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

// ============================================================
// MAIN RESEARCH FUNCTION
// ============================================================

/**
 * Runs parallel research across multiple AI models and synthesizes results.
 *
 * Flow:
 * 1. Validate API key (required in BYOK mode)
 * 2. Build messages for each model (including images for vision models)
 * 3. Query all models in parallel
 * 4. Synthesize successful responses with orchestrator
 * 5. Calculate costs and return results
 *
 * @param request - Research configuration including query, models, and API key
 * @returns Combined results from all models with synthesis
 *
 * @example
 * const result = await runResearch({
 *   query: 'What are the best practices for React performance?',
 *   modelIds: ['anthropic/claude-haiku-4.5:online', 'google/gemini-2.5-flash:online'],
 *   orchestratorId: 'anthropic/claude-sonnet-4.5',
 *   apiKey: 'sk-or-...',
 * })
 */
export async function runResearch(request: ResearchRequest): Promise<ResearchResult> {
  const startTime = Date.now()

  // ---- API Key Validation ----
  // In BYOK mode, user MUST provide key. Otherwise, fall back to server key.
  const forceBYOK = process.env.FORCE_BYOK === 'true'
  const apiKey =
    request.apiKey ||
    (request.byokMode || forceBYOK ? undefined : process.env.OPENROUTER_API_KEY)

  if (!apiKey) {
    throw new Error('API key required. Please add your OpenRouter key in Settings.')
  }

  const openrouter = createOpenRouter({ apiKey })
  const orchestratorId = request.orchestratorId || DEFAULT_ORCHESTRATOR
  const attachments = request.attachments || []

  // Separate attachments by type
  const imageAttachments = attachments.filter((a) => a.type === 'image')
  const pdfAttachments = attachments.filter((a) => a.type === 'pdf')
  const textAttachments = attachments.filter((a) => a.type === 'text')

  const hasImages = imageAttachments.length > 0
  const hasPdfs = pdfAttachments.length > 0
  const hasTextFiles = textAttachments.length > 0

  // ---- Get Models to Query ----
  const modelIds = request.modelIds?.length ? request.modelIds : DEFAULT_MODELS
  const models = modelIds
    .map((id) => MODEL_OPTIONS.find((m) => m.id === id))
    .filter((m): m is ModelOption => m !== undefined)

  if (models.length === 0) {
    throw new Error('No valid models selected')
  }

  // ---- Build Query with Text Attachments ----
  // Text files are appended directly to the query (works for all models)
  let enhancedQuery = request.query
  if (hasTextFiles) {
    const textContent = textAttachments
      .map((a) => `--- ${a.name} ---\n${a.content}`)
      .join('\n\n')
    enhancedQuery = `${request.query}\n\n[Attached Files]\n${textContent}`
  }

  // ---- Build Messages for Each Model ----
  const buildMessages = (model: ModelOption) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const messages: any[] = [{ role: 'system', content: RESEARCH_SYSTEM_PROMPT }]

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const content: any[] = []
    let queryText = enhancedQuery

    // Add note about images that can't be seen
    if (hasImages && !model.supportsVision) {
      queryText = `[Note: ${imageAttachments.length} image(s) attached but not visible to this model]\n\n${queryText}`
    }

    content.push({ type: 'text', text: queryText })

    // Add images for vision-capable models
    if (hasImages && model.supportsVision) {
      for (const img of imageAttachments) {
        content.push({
          type: 'image',
          image: `data:${img.mimeType};base64,${img.content}`,
        })
      }
    }

    // Add PDFs (OpenRouter handles these for all models)
    if (hasPdfs) {
      for (const pdf of pdfAttachments) {
        content.push({
          type: 'file',
          data: `data:${pdf.mimeType};base64,${pdf.content}`,
          mimeType: pdf.mimeType,
        })
      }
    }

    // If we have multimodal content, use the array format
    if ((hasImages && model.supportsVision) || hasPdfs) {
      messages.push({ role: 'user', content })
    } else {
      messages.push({ role: 'user', content: queryText })
    }

    return messages
  }

  // ---- Query All Models in Parallel ----
  const responses = await Promise.all(
    models.map(async (model): Promise<ModelResponse> => {
      const modelStart = Date.now()
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const options: any = {
          model: openrouter(model.id),
          messages: buildMessages(model),
          maxTokens: 2500,
        }

        // Add reasoning configuration based on model type
        if (model.reasoning === 'enabled') {
          // Grok Fast: enable reasoning (boolean parameter)
          options.experimental_providerMetadata = {
            openrouter: { reasoning: { enabled: true } },
          }
        } else if (model.reasoning === 'low' || model.reasoning === 'high') {
          // OpenAI/Anthropic reasoning models: set effort level
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

        return {
          model: model.name,
          modelId: model.id,
          content: result.text,
          success: true,
          durationMs: Date.now() - modelStart,
          usage,
          cost: calculateCost(model.id, usage),
        }
      } catch (error) {
        return {
          model: model.name,
          modelId: model.id,
          content: '',
          success: false,
          error: error instanceof Error ? error.message : String(error),
          durationMs: Date.now() - modelStart,
        }
      }
    })
  )

  const successful = responses.filter((r) => r.success)

  // ---- Handle Complete Failure ----
  if (successful.length === 0) {
    return {
      query: request.query,
      responses,
      synthesis: 'All models failed to respond. Please check your API key and try again.',
      totalDurationMs: Date.now() - startTime,
      modelCount: models.length,
      successCount: 0,
      timestamp: new Date().toISOString(),
      orchestrator: orchestratorId,
    }
  }

  // ---- Synthesize Responses ----
  const responsesBlock = successful.map((r) => `### ${r.model}\n${r.content}`).join('\n\n---\n\n')
  const customPrompt = request.orchestratorPrompt || DEFAULT_ORCHESTRATOR_PROMPT

  const synthesisPrompt = `Synthesize these AI model responses to: "${request.query.slice(0, 200)}"

${responsesBlock}

${customPrompt}`

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const orchestratorOptions: any = {
    model: openrouter(orchestratorId),
    messages: [{ role: 'user', content: synthesisPrompt }],
    maxTokens: 1500,
  }

  const synthesisResult = await generateText(orchestratorOptions)
  const orchestratorName =
    ORCHESTRATOR_OPTIONS.find((o) => o.id === orchestratorId)?.name || orchestratorId

  return {
    query: request.query,
    responses,
    synthesis: synthesisResult.text,
    totalDurationMs: Date.now() - startTime,
    modelCount: models.length,
    successCount: successful.length,
    totalCost: responses.reduce((sum, r) => sum + (r.cost || 0), 0),
    timestamp: new Date().toISOString(),
    orchestrator: orchestratorName,
  }
}
