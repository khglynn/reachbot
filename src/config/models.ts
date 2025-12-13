/**
 * Model Configuration
 *
 * Central configuration for all AI models available in Eachie.
 * Edit this file to add/remove models or change their properties.
 *
 * @module config/models
 */

import type { ModelOption, OrchestratorOption, TranscriptionService, Settings } from '@/types'

// ============================================================
// RESEARCH MODELS
// Models available for the main research queries.
// All have web search enabled via OpenRouter's :online suffix.
// ============================================================

/**
 * Blended cost = (0.25 × input) + (0.75 × output) per 1M tokens
 * Assumes typical 3:1 output:input ratio for research queries.
 */
export const MODEL_OPTIONS: ModelOption[] = [
  // ---- Anthropic ----
  {
    id: 'anthropic/claude-opus-4.5:online',
    name: 'Claude Opus 4.5',
    description: 'Top reasoning & writing',
    provider: 'Anthropic',
    blendedCost: 60.0, // $15 in, $75 out
    supportsVision: true,
  },
  {
    id: 'anthropic/claude-sonnet-4.5:online',
    name: 'Claude Sonnet 4.5',
    description: 'Best all-rounder',
    provider: 'Anthropic',
    blendedCost: 12.0, // $3 in, $15 out
    supportsVision: true,
  },
  {
    id: 'anthropic/claude-haiku-4.5:online',
    name: 'Claude Haiku 4.5',
    description: 'Fast & economical',
    provider: 'Anthropic',
    blendedCost: 1.0, // $0.25 in, $1.25 out
    supportsVision: true,
  },

  // ---- OpenAI ----
  {
    id: 'openai/gpt-5.1:online',
    name: 'GPT-5.1 (high)',
    description: 'Deep reasoning',
    provider: 'OpenAI',
    blendedCost: 7.81, // $1.25 in, $10 out
    supportsVision: true,
    reasoning: 'high',
  },
  {
    id: 'openai/o3:online',
    name: 'o3 (high)',
    description: 'Top reasoning model',
    provider: 'OpenAI',
    blendedCost: 32.5, // $10 in, $40 out
    supportsVision: false,
    reasoning: 'high',
  },
  {
    id: 'openai/o3-mini:online',
    name: 'o3-mini (low)',
    description: 'STEM-focused, efficient',
    provider: 'OpenAI',
    blendedCost: 4.69, // $0.75 in, $6 out
    supportsVision: false,
    reasoning: 'low',
  },

  // ---- Google ----
  {
    id: 'google/gemini-3-pro-preview:online',
    name: 'Gemini 3 Pro',
    description: 'Top multimodal',
    provider: 'Google',
    blendedCost: 8.13, // $2.5 in, $10 out
    supportsVision: true,
  },
  {
    id: 'google/gemini-2.5-pro:online',
    name: 'Gemini 2.5 Pro',
    description: 'High-end creative',
    provider: 'Google',
    blendedCost: 4.06, // $1.25 in, $5 out
    supportsVision: true,
  },
  {
    id: 'google/gemini-2.5-flash:online',
    name: 'Gemini 2.5 Flash',
    description: 'Built-in thinking',
    provider: 'Google',
    blendedCost: 0.49, // $0.15 in, $0.6 out
    supportsVision: true,
  },
  {
    id: 'google/gemini-2.0-flash:online',
    name: 'Gemini 2.0 Flash',
    description: 'Fastest & cheapest',
    provider: 'Google',
    blendedCost: 0.24, // $0.075 in, $0.3 out
    supportsVision: true,
  },

  // ---- Perplexity ----
  {
    id: 'perplexity/sonar-deep-research',
    name: 'Perplexity Deep',
    description: 'Exhaustive research',
    provider: 'Perplexity',
    blendedCost: 12.0, // $3 in, $15 out
    supportsVision: false,
  },
  {
    id: 'perplexity/sonar-pro',
    name: 'Perplexity Sonar',
    description: 'Fast search-native',
    provider: 'Perplexity',
    blendedCost: 4.0, // $1 in, $5 out
    supportsVision: false,
  },

  // ---- X.AI ----
  {
    id: 'x-ai/grok-4:online',
    name: 'Grok 4',
    description: 'Creative real-time',
    provider: 'X.AI',
    blendedCost: 4.0, // $1 in, $5 out
    supportsVision: true,
  },
  {
    id: 'x-ai/grok-4.1-fast',
    name: 'Grok Fast (thinking)',
    description: 'Fast with reasoning',
    provider: 'X.AI',
    blendedCost: 1.63, // $0.5 in, $2 out
    supportsVision: true,
    reasoning: 'enabled',
  },

  // ---- Others ----
  {
    id: 'deepseek/deepseek-r1:online',
    name: 'DeepSeek R1',
    description: 'Open reasoning champ',
    provider: 'DeepSeek',
    blendedCost: 3.43, // $0.2 in, $4.5 out
    supportsVision: false,
  },
  {
    id: 'qwen/qwen3-235b-a22b:online',
    name: 'Qwen3-Max',
    description: 'Multilingual creative',
    provider: 'Alibaba',
    blendedCost: 1.19, // $0.3 in, $1.49 out
    supportsVision: false,
  },
  {
    id: 'moonshotai/kimi-k2:online',
    name: 'Kimi K2',
    description: 'Long-context master',
    provider: 'Moonshot',
    blendedCost: 4.0, // $1 in, $5 out
    supportsVision: false,
  },
  {
    id: 'meta-llama/llama-4-maverick:online',
    name: 'Llama 4 Maverick',
    description: 'Open multimodal',
    provider: 'Meta',
    blendedCost: 0, // Free
    supportsVision: true,
  },
  {
    id: 'minimax/minimax-m1',
    name: 'MiniMax M1',
    description: 'Extended context',
    provider: 'MiniMax',
    blendedCost: 1.75, // $0.4 in, $2.2 out
    supportsVision: false,
  },
]

/**
 * Provider names in display order for the model accordion.
 * Models are grouped under these headings.
 */
export const PROVIDER_ORDER = [
  'Anthropic',
  'OpenAI',
  'Google',
  'Perplexity',
  'X.AI',
  'DeepSeek',
  'Alibaba',
  'Moonshot',
  'Meta',
  'MiniMax',
]

// ============================================================
// ORCHESTRATOR MODELS
// Models available for synthesizing responses.
// These don't need :online suffix since they're summarizing, not searching.
// ============================================================

export const ORCHESTRATOR_OPTIONS: OrchestratorOption[] = [
  {
    id: 'anthropic/claude-sonnet-4.5',
    name: 'Claude Sonnet 4.5',
    description: 'Balanced, exploratory',
    blendedCost: 12.0, // $3 in, $15 out
  },
  {
    id: 'anthropic/claude-opus-4.5',
    name: 'Claude Opus 4.5',
    description: 'Precise, decisive',
    blendedCost: 60.0, // $15 in, $75 out
  },
  {
    id: 'openai/gpt-5.1',
    name: 'GPT-5.1',
    description: 'Warm, structured',
    blendedCost: 7.81, // $1.25 in, $10 out
  },
  {
    id: 'google/gemini-3-pro-preview',
    name: 'Gemini 3 Pro',
    description: 'Direct, insight-focused',
    blendedCost: 8.13, // $2.5 in, $10 out
  },
]

// ============================================================
// TRANSCRIPTION SERVICE
// Talk to type via OpenAI Whisper.
// ============================================================

export const TRANSCRIPTION_SERVICE: TranscriptionService = {
  id: 'openai',
  name: 'OpenAI Whisper',
  key: 'openaiKey',
}

// ============================================================
// DEFAULTS
// ============================================================

/**
 * Default models for new users.
 * Chosen for balance of quality, speed, and cost.
 */
export const DEFAULT_MODELS = [
  'anthropic/claude-haiku-4.5:online',
  'google/gemini-2.5-flash:online',
  'x-ai/grok-4.1-fast',
]

/**
 * Default orchestrator for synthesis.
 */
export const DEFAULT_ORCHESTRATOR = 'anthropic/claude-sonnet-4.5'

/**
 * Default orchestrator synthesis prompt.
 * Uses {{QUERY}} and {{RESPONSES}} placeholders.
 */
export const DEFAULT_ORCHESTRATOR_PROMPT = `Create a synthesis that:
1. Identifies key consensus points
2. Highlights disagreements or unique insights
3. Provides actionable takeaways

Guidelines:
- 300-500 words, use markdown formatting
- Be substantive and specific`

/**
 * Default settings for new users.
 */
export const DEFAULT_SETTINGS: Settings = {
  openrouterKey: '',
  openaiKey: '',
  orchestrator: DEFAULT_ORCHESTRATOR,
  hiddenModels: [],
}

/**
 * Maximum number of models that can be selected at once.
 */
export const MAX_SELECTED_MODELS = 12

/**
 * Maximum number of images that can be attached.
 */
export const MAX_IMAGES = 4
