/**
 * useBrowserHistory Hook
 *
 * Manages browser history state so users can use back/forward buttons.
 * Preserves query text when going back, allowing users to edit failed queries.
 *
 * @module hooks/useBrowserHistory
 */

import { useEffect, useCallback } from 'react'
import type { Stage, HistoryState } from '@/types'

interface UseBrowserHistoryOptions {
  /** Current app stage */
  stage: Stage
  /** Current query text */
  query: string
  /** Number of results in conversation history */
  historyLength: number
  /** Callback when user navigates back */
  onNavigateBack: (state: HistoryState) => void
}

/**
 * Hook for browser history management.
 *
 * Pushes state to browser history on stage changes, and restores
 * state when user clicks back button.
 *
 * @example
 * useBrowserHistory({
 *   stage,
 *   query,
 *   historyLength: conversationHistory.length,
 *   onNavigateBack: (state) => {
 *     setStage(state.stage)
 *     if (state.query) setQuery(state.query)
 *   },
 * })
 */
export function useBrowserHistory({
  stage,
  query,
  historyLength,
  onNavigateBack,
}: UseBrowserHistoryOptions) {
  /**
   * Push current state to browser history.
   * Called when stage changes.
   *
   * Also updates URL query params so state survives page refresh.
   */
  const pushState = useCallback(
    (newStage: Stage, extraState?: Partial<HistoryState>) => {
      const state: HistoryState = {
        stage: newStage,
        historyLength,
        ...extraState,
      }

      // Build URL with query params to survive refresh
      const url = new URL(window.location.href)

      // Preserve query in URL during research (so refresh works)
      if (extraState?.query) {
        url.searchParams.set('q', extraState.query)
      } else if ((newStage === 'input' || newStage === 'results') && !extraState?.query) {
        // Clear query param when returning to empty input or after results
        url.searchParams.delete('q')
      }

      // Only push if we're moving forward in the flow
      window.history.pushState(state, '', url.toString())
    },
    [historyLength]
  )

  /**
   * Replace current state without adding to history.
   * Used for initial page load.
   */
  const replaceState = useCallback(
    (newStage: Stage, extraState?: Partial<HistoryState>) => {
      const state: HistoryState = {
        stage: newStage,
        historyLength,
        ...extraState,
      }
      // Keep existing URL (preserve query params like ?q= and ?byok=)
      window.history.replaceState(state, '', window.location.href)
    },
    [historyLength]
  )

  // Set initial state on mount
  useEffect(() => {
    replaceState('input')
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Listen for popstate (back/forward buttons)
  useEffect(() => {
    const handlePopState = (event: PopStateEvent) => {
      const state = event.state as HistoryState | null
      if (state) {
        onNavigateBack(state)
      } else {
        // No state means we went back to initial load
        onNavigateBack({ stage: 'input', query: '', historyLength: 0 })
      }
    }

    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [onNavigateBack])

  return { pushState, replaceState }
}
