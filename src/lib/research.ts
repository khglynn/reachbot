import { generateText } from 'ai'
import { createOpenRouter } from '@openrouter/ai-sdk-provider'

// Create openrouter client with optional custom API key
function getOpenRouter(apiKey?: string) {
  return createOpenRouter({
    apiKey: apiKey || process.env.OPENROUTER_API_KEY!,
  })
}

// All available models for selection - verified against OpenRouter Nov 2025
// Organized by provider, then reasoning capability
export const ALL_MODELS = [
  // Column 1: Anthropic + OpenAI (6 models)
  { 
    id: 'anthropic/claude-opus-4.5:online', 
    name: 'Claude Opus 4.5', 
    description: 'Top reasoning & writing',
    provider: 'Anthropic',
    category: 'flagship', 
    supportsVision: true, 
    cost: 5 
  },
  { 
    id: 'anthropic/claude-sonnet-4.5:online', 
    name: 'Claude Sonnet 4.5', 
    description: 'Best all-rounder',
    provider: 'Anthropic',
    category: 'flagship', 
    supportsVision: true, 
    cost: 3 
  },
  { 
    id: 'anthropic/claude-haiku-4.5:online', 
    name: 'Claude Haiku 4.5', 
    description: 'Fast & economical',
    provider: 'Anthropic',
    category: 'fast', 
    supportsVision: true, 
    cost: 1 
  },
  { 
    id: 'openai/gpt-5.1:online', 
    name: 'GPT-5.1', 
    description: 'High reasoning depth',
    provider: 'OpenAI',
    category: 'flagship', 
    supportsVision: true, 
    cost: 4, 
    reasoning: 'high' 
  },
  { 
    id: 'openai/o3-mini:online', 
    name: 'o3-mini', 
    description: 'STEM-focused reasoning',
    provider: 'OpenAI',
    category: 'reasoning', 
    supportsVision: false, 
    cost: 2 
  },
  
  // Column 2: Google + Perplexity (6 models)
  { 
    id: 'google/gemini-3-pro-preview:online', 
    name: 'Gemini 3 Pro', 
    description: 'Top multimodal',
    provider: 'Google',
    category: 'flagship', 
    supportsVision: true, 
    cost: 3 
  },
  { 
    id: 'google/gemini-2.5-pro:online', 
    name: 'Gemini 2.5 Pro', 
    description: 'High-end creative',
    provider: 'Google',
    category: 'flagship', 
    supportsVision: true, 
    cost: 3 
  },
  { 
    id: 'google/gemini-2.5-flash:online', 
    name: 'Gemini 2.5 Flash', 
    description: 'Built-in thinking',
    provider: 'Google',
    category: 'fast', 
    supportsVision: true, 
    cost: 1 
  },
  { 
    id: 'google/gemini-2.0-flash:online', 
    name: 'Gemini 2.0 Flash', 
    description: 'Fastest & cheapest',
    provider: 'Google',
    category: 'fast', 
    supportsVision: true, 
    cost: 0 
  },
  { 
    id: 'perplexity/sonar-deep-research', 
    name: 'Perplexity Deep', 
    description: 'Exhaustive research',
    provider: 'Perplexity',
    category: 'reasoning', 
    supportsVision: false, 
    cost: 3 
  },
  { 
    id: 'perplexity/sonar-pro', 
    name: 'Perplexity Sonar', 
    description: 'Fast search-native',
    provider: 'Perplexity',
    category: 'search', 
    supportsVision: false, 
    cost: 2 
  },
  
  // Column 3: X.AI + DeepSeek + Others (6 models)
  { 
    id: 'x-ai/grok-4:online', 
    name: 'Grok 4', 
    description: 'Creative real-time',
    provider: 'X.AI',
    category: 'flagship', 
    supportsVision: true, 
    cost: 2 
  },
  { 
    id: 'deepseek/deepseek-r1:online', 
    name: 'DeepSeek R1', 
    description: 'Open reasoning champ',
    provider: 'DeepSeek',
    category: 'reasoning', 
    supportsVision: false, 
    cost: 1 
  },
  { 
    id: 'qwen/qwen3-235b-a22b:online', 
    name: 'Qwen3-Max', 
    description: 'Multilingual creative',
    provider: 'Alibaba',
    category: 'flagship', 
    supportsVision: false, 
    cost: 2 
  },
  { 
    id: 'moonshotai/kimi-k2:online', 
    name: 'Kimi K2', 
    description: 'Long-context master',
    provider: 'Moonshot',
    category: 'reasoning', 
    supportsVision: false, 
    cost: 2 
  },
  { 
    id: 'meta-llama/llama-4-maverick:online', 
    name: 'Llama 4 Maverick', 
    description: 'Open multimodal',
    provider: 'Meta',
    category: 'fast', 
    supportsVision: true, 
    cost: 0 
  },
  { 
    id: 'minimax/minimax-m1-80k:online', 
    name: 'MiniMax M1', 
    description: 'Extended context',
    provider: 'MiniMax',
    category: 'reasoning', 
    supportsVision: false, 
    cost: 2 
  },
]

// Default selections for quick mode
export const DEFAULT_QUICK_MODELS = [
  'anthropic/claude-haiku-4.5:online',
  'google/gemini-2.5-flash:online', 
  'deepseek/deepseek-r1:online',
]

// Default selections for deep mode  
export const DEFAULT_DEEP_MODELS = [
  'anthropic/claude-sonnet-4.5:online',
  'openai/gpt-5.1:online',
  'google/gemini-3-pro-preview:online',
  'deepseek/deepseek-r1:online',
  'perplexity/sonar-deep-research',
]

// Available orchestrator models
export const ORCHESTRATOR_MODELS = [
  { id: 'anthropic/claude-sonnet-4.5', name: 'Claude Sonnet 4.5', description: 'Balanced & reliable' },
  { id: 'anthropic/claude-opus-4.5', name: 'Claude Opus 4.5', description: 'Maximum quality' },
  { id: 'openai/gpt-5.1', name: 'GPT-5.1', description: 'Deep reasoning', reasoning: 'high' },
  { id: 'openai/gpt-5.1', name: 'GPT-5.1 Medium', description: 'Balanced reasoning', reasoning: 'medium' },
  { id: 'openai/gpt-5.1', name: 'GPT-5.1 Low', description: 'Fast reasoning', reasoning: 'low' },
  { id: 'google/gemini-3-pro-preview', name: 'Gemini 3 Pro', description: 'Multimodal synthesis' },
]

export const DEFAULT_ORCHESTRATOR = 'anthropic/claude-sonnet-4.5'

export interface ResearchImage {
  base64: string
  mimeType: 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp'
}

export interface ResearchRequest {
  query: string
  images?: ResearchImage[]
  modelIds?: string[] // Selected model IDs
  mode?: 'quick' | 'deep'
  orchestratorId?: string
  apiKey?: string // Optional user-provided OpenRouter key
}

export interface ModelResponse {
  model: string
  modelId: string
  content: string
  success: boolean
  error?: string
  durationMs?: number
  usage?: {
    promptTokens: number
    completionTokens: number
    totalTokens: number
  }
  cost?: number
}

export interface ResearchResult {
  query: string
  responses: ModelResponse[]
  synthesis: string
  totalDurationMs: number
  modelCount: number
  successCount: number
  totalCost?: number
  timestamp?: string
  orchestrator?: string
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

// Pricing per million tokens (input/output) - Nov 2025
const MODEL_PRICING: Record<string, { input: number, output: number }> = {
  'anthropic/claude-opus-4.5:online': { input: 15, output: 75 },
  'anthropic/claude-sonnet-4.5:online': { input: 3, output: 15 },
  'anthropic/claude-haiku-4.5:online': { input: 0.25, output: 1.25 },
  'openai/gpt-5.1:online': { input: 1.25, output: 10 },
  'openai/o3-mini:online': { input: 0.75, output: 6 },
  'google/gemini-3-pro-preview:online': { input: 2.5, output: 10 },
  'google/gemini-2.5-pro:online': { input: 1.25, output: 5 },
  'google/gemini-2.5-flash:online': { input: 0.15, output: 0.60 },
  'google/gemini-2.0-flash:online': { input: 0.075, output: 0.30 },
  'perplexity/sonar-deep-research': { input: 3, output: 15 },
  'perplexity/sonar-pro': { input: 1, output: 5 },
  'x-ai/grok-4:online': { input: 1, output: 5 },
  'deepseek/deepseek-r1:online': { input: 0.20, output: 4.50 },
  'qwen/qwen3-235b-a22b:online': { input: 0.30, output: 1.49 },
  'moonshotai/kimi-k2:online': { input: 1, output: 5 },
  'meta-llama/llama-4-maverick:online': { input: 0, output: 0 },
  'minimax/minimax-m1-80k:online': { input: 0.50, output: 2 },
}

function calculateCost(modelId: string, usage?: ModelResponse['usage']): number {
  if (!usage) return 0
  const pricing = MODEL_PRICING[modelId]
  if (!pricing) return 0
  
  const inputCost = (usage.promptTokens / 1_000_000) * pricing.input
  const outputCost = (usage.completionTokens / 1_000_000) * pricing.output
  return inputCost + outputCost
}

export async function runResearch(request: ResearchRequest): Promise<ResearchResult> {
  const startTime = Date.now()
  const hasImages = request.images && request.images.length > 0
  const orchestratorId = request.orchestratorId || DEFAULT_ORCHESTRATOR
  const openrouter = getOpenRouter(request.apiKey)
  
  // Get models to use
  let modelIds = request.modelIds
  if (!modelIds || modelIds.length === 0) {
    modelIds = request.mode === 'deep' ? DEFAULT_DEEP_MODELS : DEFAULT_QUICK_MODELS
  }
  
  const models = modelIds
    .map(id => {
      // Handle reasoning suffix (e.g., "model:online:high")
      const [baseId, reasoning] = id.includes(":online:") 
        ? [id.split(":online:")[0] + ":online", id.split(":online:")[1]]
        : [id, undefined]
      const model = ALL_MODELS.find(m => m.id === baseId)
      if (model && reasoning) {
        return { ...model, reasoning } as typeof model
      }
      return model
    })
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
        
        // Add reasoning effort for models that support it
        if (model.reasoning) {
          options.experimental_providerMetadata = {
            openrouter: {
              reasoning: { effort: model.reasoning }
            }
          }
        }

        const result = await generateText(options)
        
        // Extract usage from result
        const usage = result.usage ? {
          promptTokens: result.usage.promptTokens || 0,
          completionTokens: result.usage.completionTokens || 0,
          totalTokens: result.usage.totalTokens || 0,
        } : undefined
        
        const cost = calculateCost(model.id, usage)
        
        return {
          model: model.name,
          modelId: model.id,
          content: result.text,
          success: true,
          durationMs: Date.now() - modelStart,
          usage,
          cost
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
      successCount: 0,
      timestamp: new Date().toISOString(),
      orchestrator: orchestratorId
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

  // Get orchestrator config with reasoning if specified
  // Handle reasoning suffix (e.g., "model:high")
  let orchestratorModelId = orchestratorId
  let orchestratorReasoning: string | undefined
  if (orchestratorId.includes(':')) {
    const parts = orchestratorId.split(':')
    orchestratorModelId = parts[0]
    orchestratorReasoning = parts[1]
  }
  
  const orchestrator = ORCHESTRATOR_MODELS.find(o => o.id === orchestratorId) || ORCHESTRATOR_MODELS[0]
  const finalOrchestratorId = orchestratorModelId
  const orchestratorOptions: any = {
    model: openrouter(finalOrchestratorId),
    messages: [{ role: 'user', content: synthesisPrompt }],
    maxTokens: 1500,
  }
  
  // Use orchestrator's reasoning or the parsed reasoning
  const reasoningEffort = orchestratorReasoning || orchestrator.reasoning
  if (reasoningEffort) {
    orchestratorOptions.experimental_providerMetadata = {
      openrouter: {
        reasoning: { effort: reasoningEffort }
      }
    }
  }

  const synthesisResult = await generateText(orchestratorOptions)
  
  // Calculate total cost
  const totalCost = responses.reduce((sum, r) => sum + (r.cost || 0), 0)

  return {
    query: request.query,
    responses,
    synthesis: synthesisResult.text,
    totalDurationMs: Date.now() - startTime,
    modelCount: models.length,
    successCount: successful.length,
    totalCost,
    timestamp: new Date().toISOString(),
    orchestrator: orchestrator.name
  }
}
