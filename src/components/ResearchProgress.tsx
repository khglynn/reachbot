/**
 * ResearchProgress Component
 *
 * Shows real-time progress during research:
 * - Which models have responded
 * - Which are still pending
 * - Current phase (querying vs synthesizing)
 *
 * @module components/ResearchProgress
 */

'use client'

interface ResearchProgressProps {
  /** Models that have completed (success or error) */
  completedModels: string[]
  /** Models still waiting for response */
  pendingModels: string[]
  /** Current phase of research */
  phase: 'querying' | 'synthesizing'
  /** Whether this is a follow-up query */
  isFollowUp?: boolean
}

/**
 * Progress indicator during research.
 *
 * @example
 * <ResearchProgress
 *   completedModels={['Claude Haiku', 'Gemini Flash']}
 *   pendingModels={['DeepSeek R1']}
 *   phase="querying"
 * />
 */
export function ResearchProgress({
  completedModels,
  pendingModels,
  phase,
  isFollowUp = false,
}: ResearchProgressProps) {
  const totalModels = completedModels.length + pendingModels.length
  const progress = totalModels > 0 ? (completedModels.length / totalModels) * 100 : 0

  return (
    <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4">
      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        <div className="animate-spin text-lg">⏳</div>
        <p className="text-sm font-medium text-blue-700 dark:text-blue-300">
          {phase === 'synthesizing'
            ? 'Synthesizing responses...'
            : isFollowUp
            ? `Processing follow-up with ${totalModels} models...`
            : `Querying ${totalModels} models...`}
        </p>
      </div>

      {/* Progress Bar */}
      <div className="w-full bg-blue-200 dark:bg-blue-800 rounded-full h-2 mb-3">
        <div
          className="bg-blue-500 dark:bg-blue-400 h-2 rounded-full transition-all duration-300"
          style={{ width: `${phase === 'synthesizing' ? 100 : progress}%` }}
        />
      </div>

      {/* Model Status Grid */}
      {phase === 'querying' && (
        <div className="flex flex-wrap gap-1.5">
          {/* Completed models */}
          {completedModels.map((model) => (
            <span
              key={model}
              className="px-2 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded text-xs"
            >
              ✓ {model}
            </span>
          ))}
          {/* Pending models */}
          {pendingModels.map((model) => (
            <span
              key={model}
              className="px-2 py-0.5 bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 rounded text-xs animate-pulse"
            >
              ○ {model}
            </span>
          ))}
        </div>
      )}

      {/* Synthesizing indicator */}
      {phase === 'synthesizing' && (
        <p className="text-xs text-blue-600 dark:text-blue-400">
          All models responded. Creating synthesis...
        </p>
      )}
    </div>
  )
}
