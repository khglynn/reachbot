/**
 * SettingsModal Component
 *
 * Modal for configuring API keys, orchestrator, transcription service,
 * and model visibility. Settings are persisted to localStorage.
 *
 * @module components/SettingsModal
 */

'use client'

import { useState, useEffect, useCallback } from 'react'
import type { Settings } from '@/types'
import {
  MODEL_OPTIONS,
  ORCHESTRATOR_OPTIONS,
  DEFAULT_ORCHESTRATOR_PROMPT,
} from '@/config/models'

interface SettingsModalProps {
  /** Current settings */
  settings: Settings
  /** Save settings callback */
  onSave: (settings: Partial<Settings>) => void
  /** Close modal callback */
  onClose: () => void
  /** Whether in BYOK mode (requires user API keys) */
  byokMode: boolean
}

/**
 * Settings configuration modal.
 *
 * @example
 * {showSettings && (
 *   <SettingsModal
 *     settings={settings}
 *     onSave={saveSettings}
 *     onClose={() => setShowSettings(false)}
 *     byokMode={byokMode}
 *   />
 * )}
 */
export function SettingsModal({ settings, onSave, onClose, byokMode }: SettingsModalProps) {
  // Show "Saved" notification briefly after changes
  const [showSaved, setShowSaved] = useState(false)
  const [saveTimeout, setSaveTimeout] = useState<NodeJS.Timeout | null>(null)

  // Wrap onSave to show notification
  const handleSave = useCallback(
    (newSettings: Partial<Settings>) => {
      onSave(newSettings)
      setShowSaved(true)

      // Clear any existing timeout
      if (saveTimeout) {
        clearTimeout(saveTimeout)
      }

      // Hide after 1.5 seconds
      const timeout = setTimeout(() => setShowSaved(false), 1500)
      setSaveTimeout(timeout)
    },
    [onSave, saveTimeout]
  )

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (saveTimeout) {
        clearTimeout(saveTimeout)
      }
    }
  }, [saveTimeout])

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-slate-800 rounded-xl max-w-lg w-full max-h-[90vh] overflow-y-auto shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100">
              ⚙️ Settings
            </h2>
            {/* Save notification */}
            {showSaved && (
              <span className="text-xs text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/30 px-2 py-0.5 rounded animate-pulse">
                ✓ Saved
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xl"
          >
            ×
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* BYOK Notice */}
          {byokMode && (
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
              <p className="text-sm text-blue-700 dark:text-blue-300">
                <strong>BYOK Mode Active</strong> - You must provide your own API keys to
                use this app.
              </p>
            </div>
          )}

          {/* API Keys Section */}
          <section>
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1">
              API Keys
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
              {byokMode
                ? 'Required for BYOK mode.'
                : 'Optional. Uses server keys if empty.'}{' '}
              Keys are stored locally in your browser.
            </p>

            <div className="space-y-3">
              {/* OpenRouter Key */}
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
                  OpenRouter <span className="text-red-500">{byokMode ? '*' : ''}</span>
                </label>
                <input
                  type="password"
                  value={settings.openrouterKey}
                  onChange={(e) => handleSave({ openrouterKey: e.target.value })}
                  placeholder="sk-or-..."
                  className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 dark:text-slate-100"
                />
              </div>

              {/* OpenAI Key (for voice transcription) */}
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
                  OpenAI (for voice)
                </label>
                <input
                  type="password"
                  value={settings.openaiKey}
                  onChange={(e) => handleSave({ openaiKey: e.target.value })}
                  placeholder="sk-..."
                  className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 dark:text-slate-100"
                />
              </div>
            </div>
          </section>

          {/* Summary Model Section */}
          <section>
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-2">
              Summary Model
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
              Which model combines all responses.
            </p>
            <div className="grid grid-cols-2 gap-2">
              {ORCHESTRATOR_OPTIONS.map((orch) => {
                // Format cost: per 200K tokens, rounded to nearest $0.05
                const costPer200K = orch.blendedCost / 5
                const roundedCost = Math.round(costPer200K / 0.05) * 0.05
                const costDisplay = `$${roundedCost.toFixed(2)}`

                return (
                  <button
                    key={orch.id}
                    type="button"
                    onClick={() => handleSave({ orchestrator: orch.id })}
                    className={`text-left p-2 rounded-lg text-sm transition-colors ${
                      settings.orchestrator === orch.id
                        ? 'bg-blue-100 dark:bg-blue-900/30 border-2 border-blue-400'
                        : 'bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex justify-between items-center">
                      <span className="font-medium text-slate-700 dark:text-slate-200">
                        {orch.name}
                      </span>
                      <span className="text-xs text-slate-400 dark:text-slate-500">
                        {costDisplay}
                      </span>
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">
                      {orch.description}
                    </div>
                  </button>
                )
              })}
            </div>
          </section>

          {/* Summary Prompt Section */}
          <section>
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-2">
              Summary Prompt
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
              Instructions for how the orchestrator should summarize responses.
            </p>
            <textarea
              value={settings.orchestratorPrompt ?? DEFAULT_ORCHESTRATOR_PROMPT}
              onChange={(e) => handleSave({ orchestratorPrompt: e.target.value })}
              rows={5}
              className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 dark:text-slate-100 font-mono resize-y"
              placeholder={DEFAULT_ORCHESTRATOR_PROMPT}
            />
            {settings.orchestratorPrompt && settings.orchestratorPrompt !== DEFAULT_ORCHESTRATOR_PROMPT && (
              <button
                type="button"
                onClick={() => handleSave({ orchestratorPrompt: '' })}
                className="mt-2 text-xs text-blue-600 dark:text-blue-400 hover:underline"
              >
                Reset to default
              </button>
            )}
          </section>

          {/* Model Visibility Section */}
          <section>
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-2">
              Available Models
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
              Uncheck models to hide them from selection.
            </p>
            <div className="grid grid-cols-2 gap-1.5 max-h-48 overflow-y-auto">
              {MODEL_OPTIONS.map((model) => (
                <label
                  key={model.id}
                  className="flex items-center gap-2 p-1.5 rounded text-sm cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700"
                >
                  <input
                    type="checkbox"
                    checked={!settings.hiddenModels.includes(model.id)}
                    onChange={(e) => {
                      const hidden = e.target.checked
                        ? settings.hiddenModels.filter((id) => id !== model.id)
                        : [...settings.hiddenModels, model.id]
                      handleSave({ hiddenModels: hidden })
                    }}
                    className="rounded text-blue-600 w-3.5 h-3.5"
                  />
                  <span className="text-slate-600 dark:text-slate-300 truncate text-xs">
                    {model.name}
                  </span>
                </label>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
