/**
 * InputForm Component
 *
 * The main query input form with:
 * - Textarea for query text
 * - Attachment upload (images, PDFs, text files)
 * - Voice recording button
 * - Model selection accordion
 * - Submit button
 *
 * Used for both initial queries and follow-ups.
 *
 * @module components/InputForm
 */

'use client'

import { useRef, useCallback, useState } from 'react'
import type { ModelOption, Attachment } from '@/types'
import { Pill } from './Pill'
import { ModelAccordion } from './ModelAccordion'
import {
  ChalkAttach,
  ChalkMic,
  ChalkLoading,
  ChalkChevronDown,
  ChalkChevronRight,
  ChalkClose,
} from './ChalkIcons'
import {
  MAX_ATTACHMENTS,
  SUPPORTED_EXTENSIONS,
  getAttachmentIcon,
  createPreviewUrl,
  formatSize,
} from '@/lib/attachments'

interface InputFormProps {
  /** Current query text */
  query: string
  /** Update query text */
  onQueryChange: (query: string) => void
  /** Form submit handler */
  onSubmit: (e: React.FormEvent) => void
  /** Currently attached files */
  attachments: Attachment[]
  /** Handle new file attachments */
  onAttach: (files: FileList | null) => void
  /** Remove an attachment by index */
  onRemoveAttachment: (index: number) => void
  /** Whether voice is currently recording */
  isRecording: boolean
  /** Start voice recording */
  onStartRecording: () => void
  /** Stop voice recording */
  onStopRecording: () => void
  /** Whether form is disabled (loading) */
  isLoading: boolean
  /** Models available for selection */
  visibleModels: ModelOption[]
  /** Currently selected model IDs */
  selectedModels: string[]
  /** Toggle model selection */
  onToggleModel: (modelId: string) => void
  /** Placeholder text for textarea */
  placeholder?: string
  /** Submit button text */
  submitLabel?: string
  /** Whether this is a follow-up form */
  isFollowUp?: boolean
  /** Per-session prompt override (null = use default) */
  sessionPrompt?: string | null
  /** Default orchestrator prompt from settings */
  defaultPrompt?: string
  /** Update session prompt callback */
  onSessionPromptChange?: (prompt: string | null) => void
  /** Save prompt as new default callback */
  onSavePromptAsDefault?: (prompt: string) => void
}

/**
 * Query input form with all input methods.
 *
 * @example
 * <InputForm
 *   query={query}
 *   onQueryChange={setQuery}
 *   onSubmit={handleSubmit}
 *   attachments={attachments}
 *   onAttach={handleAttach}
 *   onRemoveAttachment={removeAttachment}
 *   isRecording={isRecording}
 *   onStartRecording={startRecording}
 *   onStopRecording={stopRecording}
 *   isLoading={isLoading}
 *   visibleModels={visibleModels}
 *   selectedModels={selectedModels}
 *   onToggleModel={toggleModel}
 * />
 */
export function InputForm({
  query,
  onQueryChange,
  onSubmit,
  attachments,
  onAttach,
  onRemoveAttachment,
  isRecording,
  onStartRecording,
  onStopRecording,
  isLoading,
  visibleModels,
  selectedModels,
  onToggleModel,
  placeholder = 'What should we eachsearch?',
  submitLabel = 'Research',
  isFollowUp = false,
  sessionPrompt,
  defaultPrompt = '',
  onSessionPromptChange,
  onSavePromptAsDefault,
}: InputFormProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [promptExpanded, setPromptExpanded] = useState(false)

  // Current effective prompt (session override or default)
  const currentPrompt = sessionPrompt ?? defaultPrompt

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onAttach(e.target.files)
      // Reset input so same file can be selected again
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    },
    [onAttach]
  )

  // Build accept string from supported extensions
  const acceptTypes = SUPPORTED_EXTENSIONS.map((ext) => `.${ext}`).join(',')

  return (
    <form onSubmit={onSubmit}>
      <div className="bg-paper-card rounded-xl border border-paper-accent/30 overflow-hidden chalk-frame">
        {/* Query Textarea */}
        <textarea
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder={placeholder}
          className={`w-full p-4 text-base resize-y border-0 focus:ring-0 focus:outline-none placeholder:text-paper-muted min-h-[120px] bg-transparent text-paper-text transition-opacity ${
            isLoading ? 'opacity-50 cursor-not-allowed' : ''
          }`}
          disabled={isLoading}
        />

        {/* Attachment Previews */}
        {attachments.length > 0 && (
          <div className="flex flex-wrap gap-2 px-4 pb-3">
            {attachments.map((attachment, i) => {
              const previewUrl = createPreviewUrl(attachment)

              return (
                <div
                  key={i}
                  className="relative group"
                  title={`${attachment.name} (${formatSize(attachment.size)})`}
                >
                  {/* Image preview or icon */}
                  {previewUrl ? (
                    <img
                      src={previewUrl}
                      alt={attachment.name}
                      className="h-16 w-16 object-cover rounded-lg border border-paper-accent/30"
                    />
                  ) : (
                    <div className="h-16 w-16 flex flex-col items-center justify-center rounded-lg border border-paper-accent/30 bg-paper-card">
                      <span className="text-xl">{getAttachmentIcon(attachment.type)}</span>
                      <span className="text-[10px] text-paper-muted truncate w-14 text-center">
                        {attachment.name.split('.').pop()?.toUpperCase()}
                      </span>
                    </div>
                  )}

                  {/* Remove button */}
                  <button
                    type="button"
                    onClick={() => onRemoveAttachment(i)}
                    className="absolute -top-1 -right-1 bg-paper-error text-paper-bg rounded-full w-5 h-5 flex items-center justify-center hover:bg-paper-error/80 opacity-0 group-hover:opacity-100 transition-opacity"
                    aria-label={`Remove ${attachment.name}`}
                  >
                    <ChalkClose size={12} />
                  </button>

                  {/* Filename tooltip on hover */}
                  <div className="absolute bottom-0 left-0 right-0 bg-black/70 text-white text-[9px] px-1 py-0.5 rounded-b-lg truncate opacity-0 group-hover:opacity-100 transition-opacity">
                    {attachment.name}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Toolbar */}
        <div className="border-t border-paper-divider p-3 bg-paper-card space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 flex-wrap">
              {/* Attach pill */}
              <Pill
                icon={<ChalkAttach size={16} />}
                label={
                  attachments.length > 0
                    ? `${attachments.length}/${MAX_ATTACHMENTS}`
                    : 'Attach'
                }
                active={attachments.length > 0}
                onClick={() => fileInputRef.current?.click()}
                disabled={isLoading || attachments.length >= MAX_ATTACHMENTS}
              />
              <input
                ref={fileInputRef}
                type="file"
                accept={acceptTypes}
                multiple
                onChange={handleFileSelect}
                className="hidden"
              />

              {/* Voice pill */}
              <Pill
                icon={<ChalkMic size={16} />}
                label={isRecording ? 'Stop' : 'Voice'}
                recording={isRecording}
                onClick={isRecording ? onStopRecording : onStartRecording}
                disabled={isLoading}
              />
            </div>

            {/* Submit button */}
            <button
              type="submit"
              disabled={isLoading || !query.trim()}
              className="px-5 py-2 bg-paper-accent text-paper-bg rounded-lg font-medium hover:bg-paper-accent/80 disabled:opacity-50 disabled:cursor-not-allowed text-sm whitespace-nowrap inline-flex items-center gap-1.5"
            >
              {isLoading ? <><ChalkLoading size={16} /> Working...</> : submitLabel}
            </button>
          </div>

          {/* Model Selection Accordion */}
          <ModelAccordion
            visibleModels={visibleModels}
            selectedModels={selectedModels}
            onToggleModel={onToggleModel}
          />

          {/* Per-Session Prompt Editor */}
          {onSessionPromptChange && (
            <div className="pt-2">
              <button
                type="button"
                onClick={() => setPromptExpanded(!promptExpanded)}
                className="flex items-center gap-1 text-xs text-paper-muted hover:text-paper-text"
              >
                <span className="w-4">{promptExpanded ? <ChalkChevronDown size={14} /> : <ChalkChevronRight size={14} />}</span>
                <span>{isFollowUp ? 'Customize context' : 'Customize summary prompt'}</span>
                {sessionPrompt !== null && (
                  <span className="ml-1 text-paper-accent text-[10px]">(modified)</span>
                )}
              </button>

              {promptExpanded && (
                <div className="mt-2 space-y-2">
                  <textarea
                    value={currentPrompt}
                    onChange={(e) => onSessionPromptChange(e.target.value)}
                    rows={8}
                    className="w-full px-3 py-2 text-xs border border-paper-accent/30 rounded-lg bg-paper-bg text-paper-text font-mono resize-y placeholder:text-paper-muted"
                    placeholder="Enter custom instructions for the summary..."
                  />
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-paper-muted">
                      This session only
                    </span>
                    {onSavePromptAsDefault && sessionPrompt !== null && (
                      <button
                        type="button"
                        onClick={() => {
                          onSavePromptAsDefault(currentPrompt)
                          onSessionPromptChange(null) // Reset to default since default now equals session
                        }}
                        className="text-[10px] text-paper-accent hover:underline"
                      >
                        Save as default
                      </button>
                    )}
                    {sessionPrompt !== null && (
                      <button
                        type="button"
                        onClick={() => onSessionPromptChange(null)}
                        className="text-[10px] text-paper-muted hover:text-paper-text"
                      >
                        Reset
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </form>
  )
}
