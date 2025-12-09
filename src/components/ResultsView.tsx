/**
 * ResultsView Component
 *
 * Displays research results including:
 * - Session cost banner
 * - Conversation thread (queries + syntheses)
 * - Expandable individual model responses
 *
 * @module components/ResultsView
 */

'use client'

import { useState, useRef, useEffect } from 'react'
import ReactMarkdown from 'react-markdown'
import type { ResearchResult } from '@/types'
import { ChalkSparkle } from './ChalkIcons'

interface ResultsViewProps {
  /** All research rounds in this session */
  conversationHistory: ResearchResult[]
}

/** Height threshold for showing expand/collapse button (in pixels) */
const QUERY_COLLAPSE_THRESHOLD = 250
/** Minimum characters before considering collapse */
const MIN_CHARS_TO_COLLAPSE = 300

/**
 * Displays the research results.
 *
 * @example
 * <ResultsView conversationHistory={conversationHistory} />
 */
/**
 * Collapsible query display with scroll for long content
 */
function QueryDisplay({ query, roundIdx }: { query: string; roundIdx: number }) {
  const contentRef = useRef<HTMLDivElement>(null)
  const [isExpanded, setIsExpanded] = useState(false)
  const [needsExpansion, setNeedsExpansion] = useState(false)

  // Check if content exceeds both height AND character thresholds
  useEffect(() => {
    if (contentRef.current) {
      const exceedsHeight = contentRef.current.scrollHeight > QUERY_COLLAPSE_THRESHOLD
      const exceedsChars = query.length > MIN_CHARS_TO_COLLAPSE
      setNeedsExpansion(exceedsHeight && exceedsChars)
    }
  }, [query])

  return (
    <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg overflow-hidden">
      <div
        ref={contentRef}
        className={`px-4 py-2 text-sm text-blue-800 dark:text-blue-200 whitespace-pre-wrap break-words transition-all ${
          !isExpanded && needsExpansion ? 'max-h-24 overflow-hidden' : 'max-h-96 overflow-y-auto'
        }`}
      >
        {query}
      </div>
      {needsExpansion && (
        <button
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full py-1 text-xs text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/40 border-t border-blue-200 dark:border-blue-800"
        >
          {isExpanded ? '▲ Show less' : '▼ Show more'}
        </button>
      )}
    </div>
  )
}

export function ResultsView({ conversationHistory }: ResultsViewProps) {
  // Track which rounds have expanded individual responses
  const [expandedRounds, setExpandedRounds] = useState<Set<number>>(new Set())

  const toggleRoundExpansion = (roundIdx: number) => {
    setExpandedRounds((prev) => {
      const next = new Set(prev)
      if (next.has(roundIdx)) {
        next.delete(roundIdx)
      } else {
        next.add(roundIdx)
      }
      return next
    })
  }

  // Calculate cumulative session cost
  const cumulativeCost = conversationHistory.reduce((sum, r) => sum + (r.totalCost || 0), 0)

  return (
    <div className="space-y-4">
      {/* Cost Banner */}
      {cumulativeCost > 0 && (
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg px-4 py-2 text-sm">
          <span className="font-medium text-green-700 dark:text-green-300">
            Session Cost:{' '}
          </span>
          <span className="text-green-600 dark:text-green-400">
            ${cumulativeCost.toFixed(4)}
          </span>
        </div>
      )}

      {/* Conversation Thread */}
      {conversationHistory.map((result, roundIdx) => (
        <div key={roundIdx} className="space-y-3">
          {/* Round Header */}
          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
            <span className="font-medium">
              {roundIdx === 0 ? '🔍 Query' : `💬 Follow-up ${roundIdx}`}
            </span>
            {result.timestamp && (
              <span>• {new Date(result.timestamp).toLocaleTimeString()}</span>
            )}
            {result.orchestrator && <span>• {result.orchestrator}</span>}
          </div>

          {/* Query Display - Full query with expand/collapse */}
          <QueryDisplay query={result.query} roundIdx={roundIdx} />

          {/* Synthesis Card */}
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                <ChalkSparkle size={18} className="text-yellow-500" />
                Summary
              </h3>
              {result.totalCost !== undefined && result.totalCost > 0 && (
                <span className="text-xs text-green-600 dark:text-green-400">
                  ${result.totalCost.toFixed(4)}
                </span>
              )}
            </div>
            <div className="prose prose-sm dark:prose-invert max-w-none">
              <ReactMarkdown>{result.synthesis}</ReactMarkdown>
            </div>
          </div>

          {/* Individual Responses Accordion */}
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
            <button
              type="button"
              onClick={() => toggleRoundExpansion(roundIdx)}
              className="w-full px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center justify-between"
            >
              <span>
                Individual Responses ({result.successCount}/{result.modelCount})
              </span>
              <span>{expandedRounds.has(roundIdx) ? '▲' : '▼'}</span>
            </button>

            {expandedRounds.has(roundIdx) && (
              <div className="border-t border-slate-200 dark:border-slate-700 p-4 space-y-4">
                {result.responses.map((response, i) => (
                  <div key={i} className="border-l-4 border-slate-200 dark:border-slate-600 pl-4">
                    {/* Response Header */}
                    <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
                      <div className="flex items-center gap-2">
                        <h4 className="font-medium text-sm text-slate-700 dark:text-slate-200">
                          {response.success ? '✓' : '✗'} {response.model}
                        </h4>
                        {response.durationMs && (
                          <span className="text-xs text-slate-400">
                            {(response.durationMs / 1000).toFixed(1)}s
                          </span>
                        )}
                        {response.cost !== undefined && response.cost > 0 && (
                          <span className="text-xs text-green-600">
                            ${response.cost.toFixed(4)}
                          </span>
                        )}
                      </div>
                      {response.usage && (
                        <span className="text-xs text-slate-400">
                          {response.usage.totalTokens.toLocaleString()} tokens
                        </span>
                      )}
                    </div>

                    {/* Response Content */}
                    {response.success ? (
                      <div className="text-sm text-slate-600 dark:text-slate-300 prose prose-sm dark:prose-invert max-w-none">
                        <ReactMarkdown>{response.content}</ReactMarkdown>
                      </div>
                    ) : (
                      <p className="text-sm text-red-600 dark:text-red-400">
                        Error: {response.error}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
