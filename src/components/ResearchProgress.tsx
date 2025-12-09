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

import { ChalkProgressBar } from './ChalkProgressBar'

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
  // Include synthesis as a step: total = models + 1
  const totalSteps = totalModels + 1
  const completedSteps = phase === 'synthesizing' ? totalModels : completedModels.length
  const progress = totalSteps > 0 ? (completedSteps / totalSteps) * 100 : 0

  return (
    <div className="bg-blue-900/20 border border-blue-800 rounded-xl p-4">
      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        <div className="animate-spin text-lg">⏳</div>
        <p className="text-sm font-medium text-blue-300">
          {phase === 'synthesizing'
            ? 'Creating summary...'
            : isFollowUp
            ? `Processing follow-up with ${totalModels} models...`
            : `Querying ${totalModels} models...`}
        </p>
      </div>

      {/* Chalk Progress Bar */}
      <div className="mb-3 flex justify-center">
        <ChalkProgressBar progress={progress} width={400} height={28} />
      </div>

      {/* Model Status Grid - always show */}
      <div className="flex flex-wrap gap-1.5">
        {/* Completed models */}
        {completedModels.map((model) => (
          <span
            key={model}
            className="px-2 py-0.5 bg-green-900/30 text-green-300 rounded text-xs"
          >
            ✓ {model}
          </span>
        ))}
        {/* Pending models */}
        {pendingModels.map((model) => (
          <span
            key={model}
            className="px-2 py-0.5 bg-slate-700 text-slate-400 rounded text-xs animate-pulse"
          >
            ○ {model}
          </span>
        ))}
        {/* Synthesis step */}
        <span
          className={`px-2 py-0.5 rounded text-xs ${
            phase === 'synthesizing'
              ? 'bg-blue-900/50 text-blue-300 animate-pulse'
              : 'bg-slate-700 text-slate-500'
          }`}
        >
          {phase === 'synthesizing' ? '◉ Summary' : '○ Summary'}
        </span>
      </div>
    </div>
  )
}
