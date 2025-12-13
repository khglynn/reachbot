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

import { useRef, useCallback, useState, useEffect } from 'react'
import type { ModelOption, Attachment } from '@/types'
import { Pill } from './Pill'
import { ModelAccordion } from './ModelAccordion'
import {
  ChalkAttach,
  ChalkMic,
  ChalkLoading,
  ChalkClose,
} from './ChalkIcons'
import {
  MAX_ATTACHMENTS,
  SUPPORTED_EXTENSIONS,
  getAttachmentIcon,
  createPreviewUrl,
  formatSize,
} from '@/lib/attachments'

/** Spider-themed placeholder messages */
const PLACEHOLDER_MESSAGES = [
  'What should we find on the web?',
  'What threads should we follow?',
  'What should we weave together?',
  'What strands should we pull together?',
  "What's caught your curiosity?",
  'What insights should we catch?',
  'What questions are you tangled in?',
  'Where should we crawl today?',
  'What corners should we explore?',
  'How should we connect the dots?',
  "What's glistening in your thoughts?",
  "What ideas are flitting by?",
]

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
  placeholder = 'What should we research?',
  submitLabel = 'Research',
  isFollowUp = false,
}: InputFormProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [randomPlaceholder, setRandomPlaceholder] = useState('')

  // Pick a random placeholder on mount
  useEffect(() => {
    const randomIndex = Math.floor(Math.random() * PLACEHOLDER_MESSAGES.length)
    setRandomPlaceholder(PLACEHOLDER_MESSAGES[randomIndex])
  }, [])

  // Use random placeholder for main form, passed placeholder for follow-ups
  const effectivePlaceholder = isFollowUp ? placeholder : (randomPlaceholder || placeholder)

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
          placeholder={effectivePlaceholder}
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

              {/* Talk to type pill */}
              <Pill
                icon={<ChalkMic size={16} />}
                label={isRecording ? 'Stop' : 'Talk'}
                recording={isRecording}
                onClick={isRecording ? onStopRecording : onStartRecording}
                disabled={isLoading}
              />
            </div>

            {/* Submit button - cream when enabled, purple when disabled */}
            <button
              type="submit"
              disabled={isLoading || !query.trim()}
              className={`px-5 py-2 text-paper-bg rounded-lg font-medium text-sm whitespace-nowrap inline-flex items-center gap-1.5 transition-colors ${
                isLoading || !query.trim()
                  ? 'bg-paper-accent cursor-not-allowed'
                  : 'bg-paper-enabled hover:bg-paper-enabled/90'
              }`}
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
        </div>
      </div>
    </form>
  )
}
