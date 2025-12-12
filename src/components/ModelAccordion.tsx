/**
 * ModelAccordion Component
 *
 * Expandable model selector organized by provider.
 * Shows model names with blended cost per 1M tokens.
 * Limits selection to MAX_SELECTED_MODELS.
 *
 * @module components/ModelAccordion
 */

'use client'

import { useState } from 'react'
import type { ModelOption } from '@/types'
import { PROVIDER_ORDER, MAX_SELECTED_MODELS } from '@/config/models'
import { ChalkTarget, ChalkChevronUp, ChalkChevronDown } from './ChalkIcons'

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
        className="w-full flex items-center justify-between px-3 py-2 bg-paper-card rounded-lg text-sm text-paper-muted hover:bg-paper-hover hover:text-paper-text transition-colors border border-paper-accent/30"
      >
        <span className="flex items-center gap-2">
          <ChalkTarget size={16} className="text-paper-enabled" />
          <span className="font-medium text-paper-text">Models</span>
          <span className="text-paper-muted/70">
            ({selectedModels.length}/{MAX_SELECTED_MODELS} selected)
          </span>
        </span>
        <span>{isExpanded ? <ChalkChevronUp size={14} /> : <ChalkChevronDown size={14} />}</span>
      </button>

      {/* Accordion Content - Model Grid */}
      {isExpanded && (
        <div className="mt-2 p-3 bg-paper-card rounded-lg border border-paper-accent/30 max-h-72 overflow-y-auto">
          {/* Cost explanation note */}
          <div className="text-xs text-paper-muted/70 mb-2">
            Est. cost per 200K tokens
          </div>

          {PROVIDER_ORDER.map((provider) => {
            const providerModels = visibleModels.filter((m) => m.provider === provider)
            if (providerModels.length === 0) return null

            return (
              <div key={provider} className="mb-2 last:mb-0">
                {/* Provider Label */}
                <div className="text-xs font-semibold text-paper-muted/70 mb-1">
                  {provider}
                </div>

                {/* Model Buttons */}
                <div className="flex flex-wrap gap-1.5">
                  {providerModels.map((model) => {
                    const isSelected = selectedModels.includes(model.id)
                    const isDisabled = !isSelected && atLimit

                    // Format cost: per 200K tokens, rounded to nearest $0.05
                    const costPer200K = model.blendedCost / 5
                    const roundedCost = Math.round(costPer200K / 0.05) * 0.05
                    const costDisplay =
                      model.blendedCost === 0
                        ? 'free'
                        : `$${roundedCost.toFixed(2)}`

                    return (
                      <button
                        key={model.id}
                        type="button"
                        onClick={() => onToggleModel(model.id)}
                        disabled={isDisabled}
                        className={`px-2.5 py-1 rounded-md text-xs transition-all ${
                          isSelected
                            ? 'bg-paper-accent text-paper-bg'
                            : 'bg-paper-card text-paper-muted border border-paper-accent/30 hover:border-paper-accent/60 hover:text-paper-text disabled:opacity-40 disabled:cursor-not-allowed'
                        }`}
                      >
                        <span>{model.name}</span>
                        <span className="ml-1 opacity-60">{costDisplay}</span>
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
