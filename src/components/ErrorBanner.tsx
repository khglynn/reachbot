/**
 * ErrorBanner Component
 *
 * Displays user-friendly error messages with support for:
 * - Raw error strings
 * - Error codes mapped to predefined messages
 * - Different visual styles based on error severity
 *
 * @module components/ErrorBanner
 * Created: December 2024
 */

'use client'

import { ChalkError, ChalkWarning } from '@/components/ChalkIcons'
import { getMessageForErrorCode } from '@/config/messages'

interface ErrorBannerProps {
  /** Error message or error code */
  error: string
  /** Error code (if different from error string) */
  errorCode?: string
  /** Callback when user dismisses the error */
  onDismiss: () => void
}

/**
 * Determine if an error is service-level (our fault) vs user-level (their fault).
 */
function isServiceError(errorCode?: string): boolean {
  if (!errorCode) return false
  return (
    errorCode === 'openrouter_credits_exhausted' ||
    errorCode === 'openrouter_quota_exceeded'
  )
}

/**
 * Error banner with support for error code lookups.
 */
export function ErrorBanner({ error, errorCode, onDismiss }: ErrorBannerProps) {
  // Try to get a predefined message for the error code
  const code = errorCode || error
  const message = getMessageForErrorCode(code)

  // Use predefined message if available, otherwise show raw error
  const title = message?.title || 'Error'
  const body = message?.body || error

  // Service errors get a softer warning style (it's our fault)
  const isService = isServiceError(errorCode)

  if (isService) {
    return (
      <div className="bg-paper-warning-muted border border-paper-warning/30 rounded-xl p-4 mb-4 chalk-frame">
        <p className="text-paper-warning text-sm font-medium flex items-center gap-2">
          <ChalkWarning size={16} /> {title}
        </p>
        <p className="text-paper-warning/80 text-xs mt-1 ml-6">
          {body}
        </p>
        <button
          onClick={onDismiss}
          className="text-xs text-paper-warning/70 mt-2 hover:underline"
        >
          Dismiss
        </button>
      </div>
    )
  }

  // Default error style
  return (
    <div className="bg-paper-error-muted border border-paper-error/30 rounded-xl p-4 mb-4 chalk-frame">
      <p className="text-paper-error text-sm font-medium flex items-center gap-2">
        <ChalkError size={16} /> {title}
      </p>
      {body !== title && (
        <p className="text-paper-error/80 text-xs mt-1 ml-6">
          {body}
        </p>
      )}
      <button
        onClick={onDismiss}
        className="text-xs text-paper-error/70 mt-2 hover:underline"
      >
        Dismiss
      </button>
    </div>
  )
}
