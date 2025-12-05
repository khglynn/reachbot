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

export const MODEL_OPTIONS: ModelOption[] = [
  // ---- Anthropic ----
  {
    id: 'anthropic/claude-opus-4.5:online',
    name: 'Claude Opus 4.5',
    description: 'Top reasoning & writing',
    provider: 'Anthropic',
    cost: 5,
    supportsVision: true,
  },
  {
    id: 'anthropic/claude-sonnet-4.5:online',
    name: 'Claude Sonnet 4.5',
    description: 'Best all-rounder',
    provider: 'Anthropic',
    cost: 3,
    supportsVision: true,
  },
  {
    id: 'anthropic/claude-haiku-4.5:online',
    name: 'Claude Haiku 4.5',
    description: 'Fast & economical',
    provider: 'Anthropic',
    cost: 1,
    supportsVision: true,
  },

  // ---- OpenAI ----
  {
    id: 'openai/gpt-5.1:online',
    name: 'GPT-5.1 (high)',
    description: 'Deep reasoning',
    provider: 'OpenAI',
    cost: 4,
    supportsVision: true,
    reasoning: 'high',
  },
  {
    id: 'openai/o3:online',
    name: 'o3 (high)',
    description: 'Top reasoning model',
    provider: 'OpenAI',
    cost: 5,
    supportsVision: false,
    reasoning: 'high',
  },
  {
    id: 'openai/o3-mini:online',
    name: 'o3-mini (low)',
    description: 'STEM-focused, efficient',
    provider: 'OpenAI',
    cost: 2,
    supportsVision: false,
    reasoning: 'low',
  },

  // ---- Google ----
  {
    id: 'google/gemini-3-pro-preview:online',
    name: 'Gemini 3 Pro',
    description: 'Top multimodal',
    provider: 'Google',
    cost: 3,
    supportsVision: true,
  },
  {
    id: 'google/gemini-2.5-pro:online',
    name: 'Gemini 2.5 Pro',
    description: 'High-end creative',
    provider: 'Google',
    cost: 3,
    supportsVision: true,
  },
  {
    id: 'google/gemini-2.5-flash:online',
    name: 'Gemini 2.5 Flash',
    description: 'Built-in thinking',
    provider: 'Google',
    cost: 1,
    supportsVision: true,
  },
  {
    id: 'google/gemini-2.0-flash:online',
    name: 'Gemini 2.0 Flash',
    description: 'Fastest & cheapest',
    provider: 'Google',
    cost: 0,
    supportsVision: true,
  },

  // ---- Perplexity ----
  {
    id: 'perplexity/sonar-deep-research',
    name: 'Perplexity Deep',
    description: 'Exhaustive research',
    provider: 'Perplexity',
    cost: 3,
    supportsVision: false,
  },
  {
    id: 'perplexity/sonar-pro',
    name: 'Perplexity Sonar',
    description: 'Fast search-native',
    provider: 'Perplexity',
    cost: 2,
    supportsVision: false,
  },

  // ---- X.AI ----
  {
    id: 'x-ai/grok-4:online',
    name: 'Grok 4',
    description: 'Creative real-time',
    provider: 'X.AI',
    cost: 2,
    supportsVision: true,
  },
  {
    id: 'x-ai/grok-4.1-fast',
    name: 'Grok Fast (thinking)',
    description: 'Fast with reasoning',
    provider: 'X.AI',
    cost: 2,
    supportsVision: true,
    reasoning: 'enabled',
  },

  // ---- Others ----
  {
    id: 'deepseek/deepseek-r1:online',
    name: 'DeepSeek R1',
    description: 'Open reasoning champ',
    provider: 'DeepSeek',
    cost: 1,
    supportsVision: false,
  },
  {
    id: 'qwen/qwen3-235b-a22b:online',
    name: 'Qwen3-Max',
    description: 'Multilingual creative',
    provider: 'Alibaba',
    cost: 2,
    supportsVision: false,
  },
  {
    id: 'moonshotai/kimi-k2:online',
    name: 'Kimi K2',
    description: 'Long-context master',
    provider: 'Moonshot',
    cost: 2,
    supportsVision: false,
  },
  {
    id: 'meta-llama/llama-4-maverick:online',
    name: 'Llama 4 Maverick',
    description: 'Open multimodal',
    provider: 'Meta',
    cost: 0,
    supportsVision: true,
  },
  {
    id: 'minimax/minimax-m1',
    name: 'MiniMax M1',
    description: 'Extended context',
    provider: 'MiniMax',
    cost: 2,
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
    description: 'Balanced & reliable',
  },
  {
    id: 'anthropic/claude-opus-4.5',
    name: 'Claude Opus 4.5',
    description: 'Maximum quality',
  },
  {
    id: 'openai/gpt-5.1',
    name: 'GPT-5.1',
    description: 'Deep reasoning',
  },
  {
    id: 'google/gemini-3-pro-preview',
    name: 'Gemini 3 Pro',
    description: 'Multimodal synthesis',
  },
]

// ============================================================
// TRANSCRIPTION SERVICES
// Voice-to-text options for the voice input feature.
// ============================================================

export const TRANSCRIPTION_SERVICES: TranscriptionService[] = [
  { id: 'openai', name: 'OpenAI Whisper', key: 'openaiKey' },
  { id: 'deepgram', name: 'Deepgram Nova-2', key: 'deepgramKey' },
  { id: 'groq', name: 'Groq Whisper', key: 'groqKey' },
]

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
  'deepseek/deepseek-r1:online',
]

/**
 * Default orchestrator for synthesis.
 */
export const DEFAULT_ORCHESTRATOR = 'anthropic/claude-sonnet-4.5'

/**
 * Default settings for new users.
 */
export const DEFAULT_SETTINGS: Settings = {
  openrouterKey: '',
  openaiKey: '',
  deepgramKey: '',
  groqKey: '',
  orchestrator: DEFAULT_ORCHESTRATOR,
  transcriptionService: 'openai',
  hiddenModels: [],
}

/**
 * Maximum number of models that can be selected at once.
 */
export const MAX_SELECTED_MODELS = 8

/**
 * Maximum number of images that can be attached.
 */
export const MAX_IMAGES = 4
