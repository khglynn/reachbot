import { generateText } from 'ai'
import { createOpenRouter } from '@openrouter/ai-sdk-provider'

const openrouter = createOpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY!,
})

// All available models for selection
export const ALL_MODELS = [
  // Flagships
  { id: 'anthropic/claude-4-sonnet-20250522:online', name: 'Claude Sonnet 4', category: 'flagship', supportsVision: true, cost: 3 },
  { id: 'anthropic/claude-opus-4.5:online', name: 'Claude Opus 4.5', category: 'flagship', supportsVision: true, cost: 5 },
  { id: 'openai/gpt-5.1:online', name: 'GPT-5.1', category: 'flagship', supportsVision: true, cost: 4, reasoning: 'medium' },
  { id: 'google/gemini-3-pro-preview:online', name: 'Gemini 3 Pro', category: 'flagship', supportsVision: true, cost: 3 },
  
  // Fast & Economical
  { id: 'anthropic/claude-haiku-4.5:online', name: 'Claude Haiku 4.5', category: 'fast', supportsVision: true, cost: 1 },
  { id: 'google/gemini-2.5-flash-preview-05-20:online', name: 'Gemini 2.5 Flash', category: 'fast', supportsVision: true, cost: 1 },
  { id: 'meta-llama/llama-4-maverick:online', name: 'Llama 4 Maverick', category: 'fast', supportsVision: false, cost: 0 },
  
  // Reasoning Specialists
  { id: 'deepseek/deepseek-r1:online', name: 'DeepSeek R1', category: 'reasoning', supportsVision: false, cost: 1 },
  { id: 'moonshotai/kimi-k2-thinking:online', name: 'Kimi K2 Thinking', category: 'reasoning', supportsVision: false, cost: 2 },
  { id: 'perplexity/sonar-deep-research', name: 'Perplexity Deep', category: 'reasoning', supportsVision: false, cost: 3 },
  
  // Grounding/Instruction-Following
  { id: 'openai/gpt-5.1-codex:online', name: 'GPT-5.1 Codex', category: 'grounding', supportsVision: true, cost: 4, reasoning: 'high' },
  { id: 'x-ai/grok-4.1:online', name: 'Grok 4.1', category: 'grounding', supportsVision: true, cost: 2 },
  
  // Search-Native
  { id: 'perplexity/sonar-pro', name: 'Perplexity Sonar Pro', category: 'search', supportsVision: false, cost: 2 },
]

// Default selections for quick mode
export const DEFAULT_QUICK_MODELS = [
  'anthropic/claude-haiku-4.5:online',
  'google/gemini-2.5-flash-preview-05-20:online', 
  'deepseek/deepseek-r1:online',
]

// Default selections for deep mode  
export const DEFAULT_DEEP_MODELS = [
  'anthropic/claude-4-sonnet-20250522:online',
  'openai/gpt-5.1:online',
  'google/gemini-3-pro-preview:online',
  'deepseek/deepseek-r1:online',
  'perplexity/sonar-deep-research',
]

export const ORCHESTRATOR_MODEL = 'anthropic/claude-4-sonnet-20250522'

export interface ResearchImage {
  base64: string
  mimeType: 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp'
}

export interface ResearchRequest {
  query: string
  images?: ResearchImage[]
  modelIds?: string[] // Selected model IDs
  mode?: 'quick' | 'deep'
}

export interface ModelResponse {
  model: string
  modelId: string
  content: string
  success: boolean
  error?: string
  durationMs?: number
}

export interface ResearchResult {
  query: string
  responses: ModelResponse[]
  synthesis: string
  totalDurationMs: number
  modelCount: number
  successCount: number
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

export async function runResearch(request: ResearchRequest): Promise<ResearchResult> {
  const startTime = Date.now()
  const hasImages = request.images && request.images.length > 0
  
  // Get models to use
  let modelIds = request.modelIds
  if (!modelIds || modelIds.length === 0) {
    modelIds = request.mode === 'deep' ? DEFAULT_DEEP_MODELS : DEFAULT_QUICK_MODELS
  }
  
  const models = modelIds
    .map(id => ALL_MODELS.find(m => m.id === id))
    .filter((m): m is typeof ALL_MODELS[0] => m !== undefined)

  const buildMessages = (model: typeof models[0]) => {
    const messages: any[] = [{ role: 'system', content: RESEARCH_SYSTEM_PROMPT }]

    if (hasImages && model.supportsVision) {
      const content: any[] = [{ type: 'text', text: request.query }]
      for (const img of request.images!) {
        content.push({ type: 'image', image: `data:${img.mimeType};base64,${img.base64}` })
      }
      messages.push({ role: 'user', content })
    } else {
      let text = request.query
      if (hasImages && !model.supportsVision) {
        text = `[Note: ${request.images!.length} image(s) attached but not visible to this model]\n\n${request.query}`
      }
      messages.push({ role: 'user', content: text })
    }
    return messages
  }

  const responses = await Promise.all(
    models.map(async (model) => {
      const modelStart = Date.now()
      try {
        // Build options with reasoning if supported
        const options: any = {
          model: openrouter(model.id),
          messages: buildMessages(model),
          maxTokens: request.mode === 'deep' ? 3000 : 2000,
        }
        
        // Add reasoning effort for GPT-5.1 models
        if (model.reasoning) {
          options.experimental_providerMetadata = {
            openrouter: {
              reasoning: { effort: model.reasoning }
            }
          }
        }

        const result = await generateText(options)
        return {
          model: model.name,
          modelId: model.id,
          content: result.text,
          success: true,
          durationMs: Date.now() - modelStart
        }
      } catch (error) {
        return {
          model: model.name,
          modelId: model.id,
          content: '',
          success: false,
          error: error instanceof Error ? error.message : String(error),
          durationMs: Date.now() - modelStart
        }
      }
    })
  )

  const successful = responses.filter(r => r.success)

  if (successful.length === 0) {
    return {
      query: request.query,
      responses,
      synthesis: 'All models failed to respond. Please try again.',
      totalDurationMs: Date.now() - startTime,
      modelCount: models.length,
      successCount: 0
    }
  }

  const synthesisPrompt = `Synthesize these AI model responses to: "${request.query.slice(0, 200)}"

${successful.map(r => `### ${r.model}\n${r.content}`).join('\n\n---\n\n')}

Create a synthesis that:
1. Identifies key consensus points
2. Highlights disagreements or unique insights  
3. Provides actionable takeaways

Guidelines:
- 300-500 words, use markdown formatting
- Be substantive and specific`

  const synthesisResult = await generateText({
    model: openrouter(ORCHESTRATOR_MODEL),
    messages: [{ role: 'user', content: synthesisPrompt }],
    maxTokens: 1500,
  })

  return {
    query: request.query,
    responses,
    synthesis: synthesisResult.text,
    totalDurationMs: Date.now() - startTime,
    modelCount: models.length,
    successCount: successful.length
  }
}
