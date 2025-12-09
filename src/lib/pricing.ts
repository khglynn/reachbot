/**
 * Pricing Configuration - Single Source of Truth
 *
 * Consolidates all model pricing data. Import this file wherever
 * cost calculation is needed instead of duplicating the pricing map.
 *
 * @module lib/pricing
 */

// ============================================================
// PRICING DATA
// Rates per million tokens (input/output) - Dec 2024
// Update this single file when pricing changes.
// ============================================================

export const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  // Anthropic
  'anthropic/claude-opus-4.5:online': { input: 15, output: 75 },
  'anthropic/claude-sonnet-4.5:online': { input: 3, output: 15 },
  'anthropic/claude-haiku-4.5:online': { input: 0.25, output: 1.25 },

  // OpenAI
  'openai/gpt-5.1:online': { input: 1.25, output: 10 },
  'openai/o3:online': { input: 10, output: 40 },
  'openai/o3-mini:online': { input: 0.75, output: 6 },

  // Google
  'google/gemini-3-pro-preview:online': { input: 2.5, output: 10 },
  'google/gemini-2.5-pro:online': { input: 1.25, output: 5 },
  'google/gemini-2.5-flash:online': { input: 0.15, output: 0.6 },
  'google/gemini-2.0-flash:online': { input: 0.075, output: 0.3 },

  // Perplexity
  'perplexity/sonar-deep-research': { input: 3, output: 15 },
  'perplexity/sonar-pro': { input: 1, output: 5 },

  // xAI
  'x-ai/grok-4:online': { input: 1, output: 5 },
  'x-ai/grok-4.1-fast': { input: 0.5, output: 2 },

  // DeepSeek
  'deepseek/deepseek-r1:online': { input: 0.2, output: 4.5 },

  // Other
  'qwen/qwen3-235b-a22b:online': { input: 0.3, output: 1.49 },
  'moonshotai/kimi-k2:online': { input: 1, output: 5 },
  'meta-llama/llama-4-maverick:online': { input: 0, output: 0 },
  'minimax/minimax-m1': { input: 0.4, output: 2.2 },
}

/**
 * Calculates cost for a model query based on token usage.
 *
 * @param modelId - OpenRouter model ID
 * @param usage - Token usage from the response
 * @returns Cost in USD
 *
 * @example
 * const cost = calculateCost('anthropic/claude-haiku-4.5:online', {
 *   promptTokens: 1000,
 *   completionTokens: 500
 * })
 * // Returns ~0.00087 USD
 */
export function calculateCost(
  modelId: string,
  usage?: { promptTokens: number; completionTokens: number }
): number {
  if (!usage) return 0
  const pricing = MODEL_PRICING[modelId]
  if (!pricing) return 0
  return (
    (usage.promptTokens / 1_000_000) * pricing.input +
    (usage.completionTokens / 1_000_000) * pricing.output
  )
}
