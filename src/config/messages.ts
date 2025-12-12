/**
 * Centralized Messages
 *
 * Single source of truth for all user-facing messages.
 * This makes it easy to:
 * - Review and edit all copy in one place
 * - Test different messages in Storybook
 * - Ensure consistent tone and branding
 *
 * @module config/messages
 * Created: December 2024
 */

export type MessageType = 'modal' | 'banner' | 'toast' | 'warning' | 'inline'

export interface Message {
  id: string
  title: string
  body: string
  type: MessageType
  action?: string
  actionUrl?: string
}

/**
 * All user-facing messages organized by category.
 */
export const MESSAGES = {
  // ============================================================
  // USAGE & LIMITS
  // ============================================================

  freeTierExhausted: {
    id: 'free_exhausted',
    title: 'Free research limit reached',
    body: "You've used your $12 in free research. Sign in to continue with credits.",
    type: 'modal' as MessageType,
    action: 'Sign In',
  },

  freeTierPaused: {
    id: 'free_paused',
    title: 'Free research temporarily paused',
    body: 'Due to high demand, free research is paused. Sign in to continue, or check back soon.',
    type: 'banner' as MessageType,
    action: 'Sign In',
  },

  rateLimited: {
    id: 'rate_limited',
    title: 'Slow down',
    body: "You've made too many requests. Please wait a moment before trying again.",
    type: 'toast' as MessageType,
  },

  rateLimitedHourly: {
    id: 'rate_limited_hourly',
    title: 'Hourly limit reached',
    body: "You've hit the hourly request limit. Try again in about an hour, or sign in for unlimited access.",
    type: 'toast' as MessageType,
    action: 'Sign In',
  },

  rateLimitedDaily: {
    id: 'rate_limited_daily',
    title: 'Daily limit reached',
    body: "You've hit the daily request limit. Come back tomorrow, or sign in for unlimited access.",
    type: 'toast' as MessageType,
    action: 'Sign In',
  },

  // ============================================================
  // CREDITS & PAYMENTS
  // ============================================================

  insufficientCredits: {
    id: 'insufficient_credits',
    title: 'Out of credits',
    body: "You're out of credits. Add more to continue researching.",
    type: 'modal' as MessageType,
    action: 'Add Credits',
  },

  lowBalance: {
    id: 'low_balance',
    title: 'Low balance',
    body: 'Your balance is running low. Auto top-up will add credits soon if enabled.',
    type: 'banner' as MessageType,
  },

  paymentFailed: {
    id: 'payment_failed',
    title: 'Payment failed',
    body: "We couldn't process your payment. Please update your payment method.",
    type: 'toast' as MessageType,
    action: 'Update Payment',
  },

  paymentSucceeded: {
    id: 'payment_succeeded',
    title: 'Credits added',
    body: 'Your payment was successful. Credits have been added to your account.',
    type: 'toast' as MessageType,
  },

  // ============================================================
  // QUERY WARNINGS
  // ============================================================

  queryTooExpensive: {
    id: 'too_expensive',
    title: 'Query cost warning',
    body: 'This combination of models would cost over $15. Consider selecting fewer or cheaper models.',
    type: 'warning' as MessageType,
  },

  queryEmpty: {
    id: 'query_empty',
    title: 'Enter a research question',
    body: 'Type a question or topic to research.',
    type: 'inline' as MessageType,
  },

  // ============================================================
  // API & ERRORS
  // ============================================================

  apiKeyRequired: {
    id: 'api_key_required',
    title: 'API key required',
    body: 'Please add your OpenRouter API key in Settings to continue.',
    type: 'toast' as MessageType,
    action: 'Open Settings',
  },

  apiKeyInvalid: {
    id: 'api_key_invalid',
    title: 'Invalid API key',
    body: 'Your API key appears to be invalid. Please check it in Settings.',
    type: 'toast' as MessageType,
    action: 'Open Settings',
  },

  allModelsFailed: {
    id: 'all_models_failed',
    title: 'Research failed',
    body: 'All models failed to respond. Please check your API key and try again.',
    type: 'toast' as MessageType,
  },

  networkError: {
    id: 'network_error',
    title: 'Connection error',
    body: 'Unable to reach the server. Please check your internet connection.',
    type: 'toast' as MessageType,
  },

  // ============================================================
  // OPENROUTER-SPECIFIC ERRORS
  // ============================================================

  openrouterCreditsExhausted: {
    id: 'openrouter_credits_exhausted',
    title: 'Service temporarily unavailable',
    body: 'Our API credits are being replenished. Please try again in a few minutes.',
    type: 'banner' as MessageType,
  },

  openrouterRateLimited: {
    id: 'openrouter_rate_limited',
    title: 'Too many requests',
    body: 'Please wait a moment before trying again.',
    type: 'toast' as MessageType,
  },

  openrouterQuotaExceeded: {
    id: 'openrouter_quota_exceeded',
    title: 'Model temporarily unavailable',
    body: 'This model has reached its usage limit. Try a different model.',
    type: 'toast' as MessageType,
  },

  // ============================================================
  // GENERAL
  // ============================================================

  researchComplete: {
    id: 'research_complete',
    title: 'Research complete',
    body: 'Your research is ready.',
    type: 'inline' as MessageType,
  },

  copied: {
    id: 'copied',
    title: 'Copied',
    body: 'Copied to clipboard.',
    type: 'toast' as MessageType,
  },

  downloadStarted: {
    id: 'download_started',
    title: 'Download started',
    body: 'Your download has started.',
    type: 'toast' as MessageType,
  },
} as const

/**
 * Get a message by its ID (for dynamic lookups).
 */
export function getMessageById(id: string): Message | undefined {
  return Object.values(MESSAGES).find((msg) => msg.id === id) as Message | undefined
}

/**
 * Error codes returned by the API, mapped to messages.
 */
export const ERROR_CODE_MESSAGES: Record<string, keyof typeof MESSAGES> = {
  FREE_TIER_EXHAUSTED: 'freeTierExhausted',
  FREE_TIER_PAUSED: 'freeTierPaused',
  RATE_LIMITED: 'rateLimited',
  INSUFFICIENT_CREDITS: 'insufficientCredits',
  API_KEY_REQUIRED: 'apiKeyRequired',
  API_KEY_INVALID: 'apiKeyInvalid',
  ALL_MODELS_FAILED: 'allModelsFailed',
  NETWORK_ERROR: 'networkError',
  // OpenRouter-specific errors
  openrouter_credits_exhausted: 'openrouterCreditsExhausted',
  openrouter_rate_limited: 'openrouterRateLimited',
  openrouter_quota_exceeded: 'openrouterQuotaExceeded',
}

/**
 * Get the message for an API error code.
 */
export function getMessageForErrorCode(code: string): Message | undefined {
  const messageKey = ERROR_CODE_MESSAGES[code]
  if (!messageKey) return undefined
  return MESSAGES[messageKey] as Message
}
