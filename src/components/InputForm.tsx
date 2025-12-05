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

import { useRef, useCallback } from 'react'
import type { ModelOption, Attachment } from '@/types'
import { Pill } from './Pill'
import { ModelAccordion } from './ModelAccordion'
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
  /** Whether this is a follow-up form (shows additional actions) */
  isFollowUp?: boolean
  /** Download action for follow-up form */
  onDownload?: () => void
  /** Start new action for follow-up form */
  onStartNew?: () => void
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
  placeholder = 'What would you like to research?',
  submitLabel = 'Research',
  isFollowUp = false,
  onDownload,
  onStartNew,
}: InputFormProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)

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
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
        {/* Query Textarea */}
        <textarea
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder={placeholder}
          className={`w-full p-4 text-base resize-y border-0 focus:ring-0 focus:outline-none placeholder:text-slate-400 dark:placeholder:text-slate-500 min-h-[120px] bg-transparent dark:text-slate-100 transition-opacity ${
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
                      className="h-16 w-16 object-cover rounded-lg border border-slate-300 dark:border-slate-600"
                    />
                  ) : (
                    <div className="h-16 w-16 flex flex-col items-center justify-center rounded-lg border border-slate-300 dark:border-slate-600 bg-slate-100 dark:bg-slate-700">
                      <span className="text-xl">{getAttachmentIcon(attachment.type)}</span>
                      <span className="text-[10px] text-slate-500 dark:text-slate-400 truncate w-14 text-center">
                        {attachment.name.split('.').pop()?.toUpperCase()}
                      </span>
                    </div>
                  )}

                  {/* Remove button */}
                  <button
                    type="button"
                    onClick={() => onRemoveAttachment(i)}
                    className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-5 h-5 text-xs hover:bg-red-600 opacity-0 group-hover:opacity-100 transition-opacity"
                    aria-label={`Remove ${attachment.name}`}
                  >
                    ×
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
        <div className="border-t border-slate-100 dark:border-slate-700 p-3 bg-slate-50 dark:bg-slate-900 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 flex-wrap">
              {/* Follow-up actions */}
              {isFollowUp && onDownload && onStartNew && (
                <>
                  <button
                    type="button"
                    onClick={onDownload}
                    className="text-sm text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
                  >
                    💾 Download
                  </button>
                  <button
                    type="button"
                    onClick={onStartNew}
                    className="text-sm text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
                  >
                    ← New
                  </button>
                </>
              )}

              {/* Attach pill - only show for initial query */}
              {!isFollowUp && (
                <>
                  <Pill
                    icon="📎"
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
                    icon="🎤"
                    label={isRecording ? 'Stop' : 'Voice'}
                    recording={isRecording}
                    onClick={isRecording ? onStopRecording : onStartRecording}
                    disabled={isLoading}
                  />
                </>
              )}
            </div>

            {/* Submit button */}
            <button
              type="submit"
              disabled={isLoading || !query.trim()}
              className="px-5 py-2 bg-blue-600 dark:bg-blue-500 text-white rounded-lg font-medium hover:bg-blue-700 dark:hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed text-sm whitespace-nowrap"
            >
              {isLoading ? '⏳ Working...' : submitLabel}
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
