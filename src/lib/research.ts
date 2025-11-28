import { generateText } from 'ai'
import { createOpenRouter } from '@openrouter/ai-sdk-provider'

const openrouter = createOpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY!,
})

// Vision-capable models for research
export const RESEARCH_MODELS = [
  { id: 'anthropic/claude-haiku-4.5', name: 'Claude Haiku 4.5', supportsVision: true },
  { id: 'google/gemini-2.5-flash-preview-05-20', name: 'Gemini 2.5 Flash', supportsVision: true },
  { id: 'deepseek/deepseek-r1', name: 'DeepSeek R1', supportsVision: false },
]

export const ORCHESTRATOR_MODEL = 'anthropic/claude-4-sonnet-20250522'
export const FOLLOWUP_MODEL = 'anthropic/claude-haiku-4.5'

export interface ResearchImage {
  base64: string
  mimeType: 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp'
}

export interface ResearchRequest {
  query: string
  images?: ResearchImage[]
}

export interface ModelResponse {
  model: string
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

// System prompt that encourages substantive research
const RESEARCH_SYSTEM_PROMPT = `You are an expert research assistant. Your role is to provide thorough, well-reasoned answers based on your training knowledge.

Guidelines:
- Draw from your extensive knowledge base to provide substantive, helpful answers
- Be direct and confident in your responses - avoid excessive hedging
- If discussing something that changes frequently (prices, availability), note that info may be dated
- Cite sources from your training when relevant
- Structure your response clearly with key points
- Be concise but comprehensive - aim for 300-500 words
- If images are provided, analyze them thoroughly and integrate observations into your response

Do NOT:
- Refuse to answer because you "can't browse the web" - use your training knowledge
- Add excessive disclaimers about limitations
- Say you cannot verify current information for every statement`

export async function runResearch(request: ResearchRequest): Promise<ResearchResult> {
  const startTime = Date.now()
  const hasImages = request.images && request.images.length > 0

  // Build messages based on whether we have images
  const buildMessages = (model: typeof RESEARCH_MODELS[0]) => {
    const messages: any[] = [
      { role: 'system', content: RESEARCH_SYSTEM_PROMPT }
    ]

    if (hasImages && model.supportsVision) {
      // Multi-modal message with images
      const content: any[] = [
        { type: 'text', text: request.query }
      ]
      
      for (const img of request.images!) {
        content.push({
          type: 'image',
          image: `data:${img.mimeType};base64,${img.base64}`
        })
      }
      
      messages.push({ role: 'user', content })
    } else {
      // Text-only message
      let text = request.query
      if (hasImages && !model.supportsVision) {
        text = `[Note: This query includes ${request.images!.length} image(s) that this model cannot process. Please answer based on the text query alone.]\n\n${request.query}`
      }
      messages.push({ role: 'user', content: text })
    }

    return messages
  }

  // Query all models in parallel
  const responses = await Promise.all(
    RESEARCH_MODELS.map(async (model) => {
      const modelStart = Date.now()
      try {
        const result = await generateText({
          model: openrouter(model.id),
          messages: buildMessages(model),
          maxTokens: 2000,
        })
        return {
          model: model.name,
          content: result.text,
          success: true,
          durationMs: Date.now() - modelStart
        }
      } catch (error) {
        return {
          model: model.name,
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
      modelCount: RESEARCH_MODELS.length,
      successCount: 0
    }
  }

  // Synthesize responses
  const synthesisPrompt = `Synthesize these AI model responses to the question: "${request.query}"

${successful.map(r => `### ${r.model}\n${r.content}`).join('\n\n---\n\n')}

Create a unified synthesis that:
1. Identifies key consensus points across models
2. Highlights notable disagreements or unique insights
3. Provides actionable takeaways

Guidelines:
- Write 300-500 words
- Use markdown formatting (headers, bullets, bold for emphasis)
- Start directly with the synthesis - no meta-commentary about the process
- Be substantive and specific, not generic
- If models analyzed images, integrate those visual observations`

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
    modelCount: RESEARCH_MODELS.length,
    successCount: successful.length
  }
}

export async function runFollowUp(query: string, context?: string): Promise<string> {
  const messages: any[] = [
    { 
      role: 'system', 
      content: 'You are a helpful research assistant. Give concise, substantive answers. Draw from your knowledge confidently.' 
    }
  ]

  if (context) {
    messages.push({ role: 'assistant', content: context })
  }
  
  messages.push({ role: 'user', content: query })

  const result = await generateText({
    model: openrouter(FOLLOWUP_MODEL),
    messages,
    maxTokens: 1000,
  })

  return result.text
}
