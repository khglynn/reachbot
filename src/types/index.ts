/**
 * Eachie Type Definitions
 *
 * Single source of truth for all TypeScript interfaces used across the app.
 * Import from '@/types' in any component or library file.
 *
 * @module types
 */

// ============================================================
// MODEL & CONFIGURATION TYPES
// ============================================================

/**
 * Configuration for an AI model available for research queries.
 * Used in both the model selector UI and the research library.
 */
export interface ModelOption {
  /** OpenRouter model ID (e.g., 'anthropic/claude-sonnet-4.5:online') */
  id: string
  /** Human-readable display name */
  name: string
  /** Short description shown in model selector */
  description: string
  /** Provider name for grouping (e.g., 'Anthropic', 'OpenAI') */
  provider: string
  /** Blended cost per 1M tokens (assuming 3:1 output:input ratio) */
  blendedCost: number
  /** Whether model can process images */
  supportsVision?: boolean
  /** Reasoning configuration for thinking models */
  reasoning?: 'low' | 'high' | 'enabled'
}

/**
 * Configuration for orchestrator models that synthesize responses.
 */
export interface OrchestratorOption {
  /** OpenRouter model ID */
  id: string
  /** Display name */
  name: string
  /** Description of synthesis style */
  description: string
  /** Blended cost per 1M tokens (assuming 3:1 output:input ratio) */
  blendedCost: number
}

/**
 * Talk to type transcription service configuration.
 * Currently only OpenAI Whisper is supported.
 */
export interface TranscriptionService {
  /** Service identifier */
  id: string
  /** Display name */
  name: string
  /** Settings key for API key */
  key: 'openaiKey'
}

// ============================================================
// ATTACHMENT TYPES
// ============================================================

/**
 * Supported attachment categories.
 * - image: Sent to vision-capable models as base64
 * - pdf: Sent to OpenRouter for parsing, works with all models
 * - text: Read client-side and appended to query
 */
export type AttachmentType = 'image' | 'pdf' | 'text'

/**
 * Supported MIME types for each attachment category.
 */
export const SUPPORTED_MIME_TYPES = {
  image: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'] as const,
  pdf: ['application/pdf'] as const,
  text: [
    'text/plain',
    'text/markdown',
    'text/csv',
    'application/json',
    'text/javascript',
    'application/javascript',
    'text/x-python',
    'application/x-python',
    'text/typescript',
    'text/html',
    'text/css',
    'text/xml',
    'application/xml',
    'text/yaml',
    'application/x-yaml',
  ] as const,
} as const

/**
 * File extensions mapped to attachment types.
 * Used for validation and type detection.
 */
export const EXTENSION_TO_TYPE: Record<string, AttachmentType> = {
  // Images
  jpg: 'image',
  jpeg: 'image',
  png: 'image',
  gif: 'image',
  webp: 'image',
  // PDFs
  pdf: 'pdf',
  // Text files
  txt: 'text',
  md: 'text',
  markdown: 'text',
  csv: 'text',
  json: 'text',
  js: 'text',
  jsx: 'text',
  ts: 'text',
  tsx: 'text',
  py: 'text',
  html: 'text',
  htm: 'text',
  css: 'text',
  xml: 'text',
  yaml: 'text',
  yml: 'text',
}

/**
 * Human-readable list of supported extensions for UI display.
 */
export const SUPPORTED_EXTENSIONS = Object.keys(EXTENSION_TO_TYPE)

/**
 * An attachment ready to be sent with a research request.
 */
export interface Attachment {
  /** Original filename */
  name: string
  /** Detected attachment type */
  type: AttachmentType
  /** MIME type of the file */
  mimeType: string
  /**
   * Content depends on type:
   * - image: base64 encoded data
   * - pdf: base64 encoded data
   * - text: raw text content
   */
  content: string
  /** File size in bytes (for display) */
  size: number
}

// ============================================================
// API REQUEST/RESPONSE TYPES
// ============================================================

/**
 * Image data sent to the research API.
 * @deprecated Use Attachment instead
 */
export interface ResearchImage {
  /** Base64-encoded image data */
  base64: string
  /** MIME type for proper decoding */
  mimeType: 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp'
}

/**
 * Request payload for the /api/research endpoint.
 */
export interface ResearchRequest {
  /** User's research question */
  query: string
  /** Optional images for vision-capable models (legacy) */
  images?: ResearchImage[]
  /** Attachments (images, PDFs, text files) */
  attachments?: Attachment[]
  /** Model IDs to query (uses defaults if empty) */
  modelIds?: string[]
  /** Which model synthesizes the responses */
  orchestratorId?: string
  /** Custom orchestrator synthesis prompt */
  orchestratorPrompt?: string
  /** User's OpenRouter API key (required in BYOK mode) */
  apiKey?: string
  /** True when user must provide their own API key */
  byokMode?: boolean
}

/**
 * Response from a single AI model.
 */
export interface ModelResponse {
  /** Human-readable model name */
  model: string
  /** OpenRouter model ID */
  modelId: string
  /** Model's response text (empty if failed) */
  content: string
  /** Whether the query succeeded */
  success: boolean
  /** Error message if failed */
  error?: string
  /** Specific error code (e.g., 'openrouter_credits_exhausted') */
  errorCode?: string
  /** How long this model took to respond (ms) */
  durationMs?: number
  /** Token usage for cost calculation */
  usage?: {
    promptTokens: number
    completionTokens: number
    totalTokens: number
  }
  /** Calculated cost in USD */
  cost?: number
  /** True when cost is estimated (text-length based), not from API */
  isEstimatedCost?: boolean
}

/**
 * Complete result from a research round.
 * Includes all model responses plus the synthesized summary.
 */
export interface ResearchResult {
  /** Original query (may include context from previous rounds) */
  query: string
  /** Individual responses from each model */
  responses: ModelResponse[]
  /** Orchestrator's synthesis of all responses */
  synthesis: string
  /** Total time for all queries + synthesis (ms) */
  totalDurationMs: number
  /** Number of models queried */
  modelCount: number
  /** Number that responded successfully */
  successCount: number
  /** Total cost for this round */
  totalCost?: number
  /** True if any cost in this round is estimated */
  hasEstimatedCosts?: boolean
  /** ISO timestamp when completed */
  timestamp?: string
  /** Name of model that created synthesis */
  orchestrator?: string
}

// ============================================================
// UI STATE TYPES
// ============================================================

/**
 * Application stages for controlling which UI to show.
 *
 * Flow: input → clarifying (optional) → research → results
 *
 * - input: User typing their query
 * - clarifying: Optional questions to refine the query
 * - research: Loading state while models respond
 * - results: Showing synthesis and individual responses
 */
export type Stage = 'input' | 'clarifying' | 'research' | 'results'

/**
 * User settings stored in localStorage.
 * Persisted across sessions.
 */
export interface Settings {
  /** OpenRouter API key (required for BYOK mode) */
  openrouterKey: string
  /** OpenAI key for talk to type (Whisper) */
  openaiKey: string
  /** Which model synthesizes responses */
  orchestrator: string
  /** Model IDs the user has hidden from selection */
  hiddenModels: string[]
  /** Custom orchestrator synthesis prompt (uses default if empty) */
  orchestratorPrompt?: string
}

/**
 * Tracks progress of an in-flight research request.
 * Used to show real-time status as models respond.
 */
export interface ResearchProgress {
  /** Which models have completed (success or fail) */
  completedModels: string[]
  /** Which models are still processing */
  pendingModels: string[]
  /** Current status message */
  status: 'querying' | 'synthesizing' | 'complete' | 'error'
  /** Error message if status is 'error' */
  error?: string
}

/**
 * Browser history state for back button support.
 * Allows returning to previous stages without losing work.
 */
export interface HistoryState {
  /** Which stage the user was on */
  stage: Stage
  /** Query text (preserved for editing on back) */
  query?: string
  /** Number of results in history */
  historyLength?: number
  /** Clarifying questions (for back to clarifying stage) */
  clarifyingQuestions?: string[]
  /** User's answers to clarifying questions */
  answers?: string[]
  /** Original query before clarifying (for back to input from clarifying) */
  originalQuery?: string
}

// ============================================================
// USER SETTINGS TYPES (Server-side)
// ============================================================

/**
 * User settings returned from /api/user/settings.
 * Combines Clerk user info with database settings.
 */
export interface UserSettings {
  /** User's email from Clerk */
  email: string
  /** User's display name (may be null) */
  name: string | null
  /** Account creation date */
  createdAt: string
  /** Credit balance in cents */
  creditsCents: number
  /** Total spent in cents */
  totalSpentCents: number
  /** Whether user has a Stripe customer ID */
  hasStripeCustomer: boolean
  /** Whether user has a saved payment method */
  hasPaymentMethod: boolean
  /** Auto top-up settings */
  autoTopup: {
    enabled: boolean
    thresholdCents: number
    amountCents: number
  }
}
