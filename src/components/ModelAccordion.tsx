/**
 * ModelAccordion Component
 *
 * Expandable model selector organized by provider.
 * Shows model names with cost indicators ($-$$$$).
 * Limits selection to MAX_SELECTED_MODELS.
 *
 * @module components/ModelAccordion
 */

'use client'

import { useState } from 'react'
import type { ModelOption } from '@/types'
import { PROVIDER_ORDER, MAX_SELECTED_MODELS } from '@/config/models'

interface ModelAccordionProps {
  /** All available models (filtered by user's hidden models setting) */
  visibleModels: ModelOption[]
  /** Currently selected model IDs */
  selectedModels: string[]
  /** Callback when selection changes */
  onToggleModel: (modelId: string) => void
  /** Optional: start expanded */
  defaultExpanded?: boolean
}

/**
 * Accordion-style model selector.
 *
 * @example
 * <ModelAccordion
 *   visibleModels={visibleModels}
 *   selectedModels={selectedModels}
 *   onToggleModel={(id) => toggleModel(id)}
 * />
 */
export function ModelAccordion({
  visibleModels,
  selectedModels,
  onToggleModel,
  defaultExpanded = false,
}: ModelAccordionProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded)

  const atLimit = selectedModels.length >= MAX_SELECTED_MODELS

  return (
    <div className="mt-2">
      {/* Accordion Header */}
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between px-3 py-2 bg-slate-100 dark:bg-slate-700 rounded-lg text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
      >
        <span className="flex items-center gap-2">
          <span>🎯</span>
          <span className="font-medium">Models</span>
          <span className="text-slate-400">
            ({selectedModels.length}/{MAX_SELECTED_MODELS} selected)
          </span>
        </span>
        <span className="text-xs">{isExpanded ? '▲' : '▼'}</span>
      </button>

      {/* Accordion Content - Model Grid */}
      {isExpanded && (
        <div className="mt-2 p-3 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 max-h-64 overflow-y-auto">
          {PROVIDER_ORDER.map((provider) => {
            const providerModels = visibleModels.filter((m) => m.provider === provider)
            if (providerModels.length === 0) return null

            return (
              <div key={provider} className="mb-2 last:mb-0">
                {/* Provider Label */}
                <div className="text-xs font-semibold text-slate-400 dark:text-slate-500 mb-1">
                  {provider}
                </div>

                {/* Model Buttons */}
                <div className="flex flex-wrap gap-1.5">
                  {providerModels.map((model) => {
                    const isSelected = selectedModels.includes(model.id)
                    const isDisabled = !isSelected && atLimit

                    return (
                      <button
                        key={model.id}
                        type="button"
                        onClick={() => onToggleModel(model.id)}
                        disabled={isDisabled}
                        className={`px-2.5 py-1 rounded-md text-xs transition-all ${
                          isSelected
                            ? 'bg-blue-500 text-white'
                            : 'bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-600 hover:border-blue-300 disabled:opacity-40 disabled:cursor-not-allowed'
                        }`}
                      >
                        <span>{model.name}</span>
                        {/* Cost indicator: $ symbols based on cost level */}
                        {model.cost > 0 && (
                          <span className="ml-1 opacity-60">
                            {'$'.repeat(Math.min(model.cost, 4))}
                          </span>
                        )}
                      </button>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
