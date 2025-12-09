/**
 * Eachie - Multi-Model AI Research Orchestrator
 *
 * Main page component that orchestrates the research flow:
 * 1. User enters query (with optional images/voice)
 * 2. Optional clarifying questions refine the query
 * 3. Multiple AI models respond in parallel
 * 4. Orchestrator synthesizes all responses
 * 5. User can ask follow-up questions
 *
 * @module app/page
 */

'use client'

import { useState, useCallback, useEffect, useTransition, useRef } from 'react'
import type { Stage, ResearchResult, ModelOption, HistoryState, Attachment } from '@/types'
import { MODEL_OPTIONS, DEFAULT_MODELS, DEFAULT_ORCHESTRATOR_PROMPT } from '@/config/models'
import { useSettings, useVoiceRecorder, useBrowserHistory } from '@/hooks'
import { readFiles } from '@/lib/attachments'
import {
  InputForm,
  ClarifyingQuestions,
  ResultsView,
  ResearchProgress,
  SettingsModal,
  HelpModal,
} from '@/components'
import { ChalkSettings, ChalkError, ChalkWarning, ChalkQuestion, ChalkDownload, ChalkPlus } from '@/components/ChalkIcons'

// ============================================================
// MAIN COMPONENT
// ============================================================

export default function Home() {
  // ---- Settings & Mode ----
  const { settings, saveSettings, isLoaded } = useSettings()
  const [byokMode, setByokMode] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [showHelp, setShowHelp] = useState(false)

  // ---- Core State ----
  const [query, setQueryRaw] = useState('')
  const [attachments, setAttachments] = useState<Attachment[]>([])
  const [stage, setStage] = useState<Stage>('input')
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [attachmentErrors, setAttachmentErrors] = useState<string[]>([])

  /**
   * Query refs solve a timing issue with useTransition:
   *
   * Problem: useTransition batches state updates for smoother rendering,
   * but this means the state value isn't immediately available after a set call.
   * When the user submits the form, we need the *current* query value synchronously.
   *
   * Solution: Maintain parallel refs that update synchronously.
   * - queryRef.current = immediate value (for form submission)
   * - setQueryRaw via startTransition = batched value (for rendering)
   *
   * This pattern is necessary for INP optimization while keeping form submission accurate.
   */
  const queryRef = useRef('')
  const followUpQueryRef = useRef('')

  // Use transition for non-blocking query updates (fixes INP issue)
  const [, startTransition] = useTransition()
  const setQuery = useCallback((value: string) => {
    queryRef.current = value // Sync update for form submission
    startTransition(() => setQueryRaw(value)) // Async update for rendering
  }, [])

  // ---- Model Selection ----
  const [selectedModels, setSelectedModels] = useState<string[]>(DEFAULT_MODELS)

  // ---- Clarifying Questions ----
  const [clarifyingQuestions, setClarifyingQuestions] = useState<string[]>([])
  const [answers, setAnswers] = useState<string[]>([])
  const [originalQuery, setOriginalQuery] = useState('')

  // ---- Results ----
  const [conversationHistory, setConversationHistory] = useState<ResearchResult[]>([])
  const [followUpQuery, setFollowUpQueryRaw] = useState('')
  const [followUpAttachments, setFollowUpAttachments] = useState<Attachment[]>([])

  // ---- Per-Session Prompt Override (not persisted to localStorage) ----
  const [sessionPrompt, setSessionPrompt] = useState<string | null>(null)

  // Non-blocking follow-up query updates
  const setFollowUpQuery = useCallback((value: string) => {
    followUpQueryRef.current = value // Sync update for form submission
    startTransition(() => setFollowUpQueryRaw(value))
  }, [])

  // ---- Progress Tracking (NEW) ----
  const [completedModels, setCompletedModels] = useState<string[]>([])
  const [pendingModels, setPendingModels] = useState<string[]>([])
  const [researchPhase, setResearchPhase] = useState<'querying' | 'synthesizing'>('querying')

  // ---- Preserved Query for Error Recovery (NEW) ----
  const [preservedQuery, setPreservedQuery] = useState('')

  // ============================================================
  // INITIALIZATION
  // ============================================================

  // Check for BYOK mode from URL parameter
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    setByokMode(params.get('byok') === 'true')
  }, [])

  // ============================================================
  // BROWSER HISTORY (Back Button Support)
  // ============================================================

  const handleNavigateBack = useCallback((state: HistoryState) => {
    // Restore stage
    setStage(state.stage)

    // Restore query if going back to input
    if (state.stage === 'input') {
      const q = state.query || state.originalQuery || ''
      queryRef.current = q
      setQuery(q)
    }

    // Restore clarifying state if going back to clarifying
    if (state.stage === 'clarifying') {
      if (state.originalQuery) {
        setOriginalQuery(state.originalQuery)
        queryRef.current = state.originalQuery
      }
      if (state.clarifyingQuestions) {
        setClarifyingQuestions(state.clarifyingQuestions)
      }
      if (state.answers) {
        setAnswers(state.answers)
      }
    }

    // If going back to before any results, clear history
    if (state.historyLength === 0) {
      setConversationHistory([])
    }
  }, [])

  const { pushState } = useBrowserHistory({
    stage,
    query,
    historyLength: conversationHistory.length,
    onNavigateBack: handleNavigateBack,
  })

  // ============================================================
  // VOICE RECORDING
  // ============================================================

  const { isRecording, isTranscribing, startRecording, stopRecording } = useVoiceRecorder({
    settings,
    byokMode,
    previousContext:
      conversationHistory.length > 0
        ? conversationHistory[conversationHistory.length - 1].query
        : '',
    onTranscription: (text) => setQuery(text),
    onError: (err) => setError(err),
  })

  // Voice recorder for follow-up queries
  const {
    isRecording: isFollowUpRecording,
    isTranscribing: isFollowUpTranscribing,
    startRecording: startFollowUpRecording,
    stopRecording: stopFollowUpRecording,
  } = useVoiceRecorder({
    settings,
    byokMode,
    previousContext:
      conversationHistory.length > 0
        ? conversationHistory[conversationHistory.length - 1].synthesis
        : '',
    onTranscription: (text) => setFollowUpQuery(text),
    onError: (err) => setError(err),
  })

  // ============================================================
  // ATTACHMENT HANDLING
  // ============================================================

  const handleAttach = useCallback(
    async (files: FileList | null) => {
      if (!files) return
      setAttachmentErrors([]) // Clear previous errors

      const result = await readFiles(files, attachments)

      // Add valid attachments
      if (result.attachments.length > 0) {
        setAttachments((prev) => [...prev, ...result.attachments])
      }

      // Show errors for invalid files
      if (result.errors.length > 0) {
        setAttachmentErrors(result.errors)
        // Auto-clear errors after 5 seconds
        setTimeout(() => setAttachmentErrors([]), 5000)
      }
    },
    [attachments]
  )

  const removeAttachment = useCallback((index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index))
  }, [])

  // Follow-up attachment handlers
  const handleFollowUpAttach = useCallback(
    async (files: FileList | null) => {
      if (!files) return
      setAttachmentErrors([])

      const result = await readFiles(files, followUpAttachments)

      if (result.attachments.length > 0) {
        setFollowUpAttachments((prev) => [...prev, ...result.attachments])
      }

      if (result.errors.length > 0) {
        setAttachmentErrors(result.errors)
        setTimeout(() => setAttachmentErrors([]), 5000)
      }
    },
    [followUpAttachments]
  )

  const removeFollowUpAttachment = useCallback((index: number) => {
    setFollowUpAttachments((prev) => prev.filter((_, i) => i !== index))
  }, [])

  // ============================================================
  // MODEL SELECTION
  // ============================================================

  const toggleModel = useCallback((modelId: string) => {
    setSelectedModels((prev) => {
      if (prev.includes(modelId)) {
        return prev.filter((id) => id !== modelId)
      } else if (prev.length < 8) {
        return [...prev, modelId]
      }
      return prev
    })
  }, [])

  // Filter models based on user's hidden models setting
  const visibleModels: ModelOption[] = MODEL_OPTIONS.filter(
    (m) => !settings.hiddenModels.includes(m.id)
  )

  // ============================================================
  // RESEARCH FLOW
  // ============================================================

  /**
   * Compacts conversation history for context in follow-up queries.
   * Keeps last 2 rounds, truncated to ~400 words each.
   */
  const compactContext = (history: ResearchResult[]): string => {
    if (history.length === 0) return ''
    const recent = history.slice(-2)
    return recent
      .map((r, i) => {
        const short = r.synthesis.split(' ').slice(0, 400).join(' ')
        return `Research ${i + 1}: "${r.query.slice(0, 80)}"\nFindings: ${short}`
      })
      .join('\n\n---\n\n')
  }

  /**
   * Gets clarifying questions from Haiku before research.
   * Falls through to full research if questions fail.
   */
  const getClarifyingQuestions = async (userQuery: string) => {
    // Preserve query BEFORE anything else - this ensures we can restore on any error
    setPreservedQuery(userQuery)
    setOriginalQuery(userQuery)
    setIsLoading(true)

    try {
      const response = await fetch('/api/clarify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: userQuery,
          apiKey: settings.openrouterKey || undefined,
          byokMode,
        }),
      })

      if (response.ok) {
        const data = await response.json()
        if (data.questions?.length > 0) {
          const newAnswers = new Array(data.questions.length).fill('')
          setClarifyingQuestions(data.questions)
          setAnswers(newAnswers)
          setStage('clarifying')
          pushState('clarifying', {
            query: userQuery,
            originalQuery: userQuery,
            clarifyingQuestions: data.questions,
            answers: newAnswers,
          })
          setIsLoading(false)
          return
        }
      }
    } catch {
      // Fall through to direct research
    }

    await runFullResearch(userQuery)
  }

  /**
   * Runs the main research flow with SSE streaming:
   * 1. Query all selected models in parallel (with real-time progress)
   * 2. Synthesize responses with orchestrator
   */
  const runFullResearch = async (finalQuery: string, isFollowUp = false) => {
    setIsLoading(true)
    setError(null)
    setResearchPhase('querying')

    // Only change stage to 'research' for initial queries (not follow-ups)
    // This keeps results visible during follow-up loading
    if (!isFollowUp) {
      setStage('research')
    }

    // Set up progress tracking
    const modelNames = selectedModels
      .map((id) => MODEL_OPTIONS.find((m) => m.id === id)?.name || id)
    setCompletedModels([])
    setPendingModels([...modelNames])

    // Preserve query for error recovery (use finalQuery - it's the current value from ref)
    setPreservedQuery(finalQuery)

    // Build query with context for follow-ups
    let enhancedQuery = finalQuery
    if (isFollowUp && conversationHistory.length > 0) {
      const context = compactContext(conversationHistory)
      enhancedQuery = `Context:\n${context}\n\nNew question: ${finalQuery}`
    }

    // Use appropriate attachments based on whether this is a follow-up
    const currentAttachments = isFollowUp ? followUpAttachments : attachments

    try {
      // Use streaming endpoint for real-time progress
      const response = await fetch('/api/research/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: enhancedQuery,
          attachments: currentAttachments.length > 0 ? currentAttachments : undefined,
          modelIds: selectedModels,
          orchestratorId: settings.orchestrator,
          orchestratorPrompt: sessionPrompt ?? settings.orchestratorPrompt ?? undefined,
          apiKey: settings.openrouterKey || undefined,
          byokMode,
        }),
      })

      if (!response.ok) {
        const errText = await response.text()
        throw new Error(errText || 'Research failed')
      }

      // Process SSE stream
      const reader = response.body?.getReader()
      const decoder = new TextDecoder()

      if (!reader) {
        throw new Error('No response body')
      }

      let buffer = ''
      const completed: string[] = []

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })

        // Process complete events from buffer
        const lines = buffer.split('\n')
        buffer = lines.pop() || '' // Keep incomplete line in buffer

        let eventType = ''
        for (const line of lines) {
          if (line.startsWith('event: ')) {
            eventType = line.slice(7)
          } else if (line.startsWith('data: ') && eventType) {
            try {
              const data = JSON.parse(line.slice(6))

              if (eventType === 'model_complete') {
                // Add to completed, remove from pending
                completed.push(data.model)
                setCompletedModels([...completed])
                setPendingModels(modelNames.filter((m) => !completed.includes(m)))
              } else if (eventType === 'synthesis_start') {
                // All models done, synthesis starting
                setResearchPhase('synthesizing')
                setCompletedModels([...modelNames])
                setPendingModels([])
              } else if (eventType === 'complete') {
                // Final result
                const result: ResearchResult = data.result
                setConversationHistory((prev) => [...prev, result])
                setStage('results')
                pushState('results')

                // Clear form data on success
                if (!isFollowUp) {
                  queryRef.current = ''
                  setQuery('')
                  setAttachments([])
                  setOriginalQuery('')
                  setClarifyingQuestions([])
                  setAnswers([])
                } else {
                  followUpQueryRef.current = ''
                  setFollowUpQuery('')
                  setFollowUpAttachments([])
                }
              } else if (eventType === 'error') {
                throw new Error(data.message)
              }
            } catch (parseErr) {
              // Ignore JSON parse errors for incomplete data
              if (eventType === 'error') throw parseErr
            }
            eventType = ''
          }
        }
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Research failed'
      setError(errorMessage)

      // GRACEFUL FAILURE: Restore query for editing
      if (!isFollowUp) {
        queryRef.current = preservedQuery
        setQuery(preservedQuery)
        setStage('input')
        pushState('input', { query: preservedQuery })
      } else {
        followUpQueryRef.current = preservedQuery
        setFollowUpQuery(preservedQuery)
        setStage('results') // Stay on results, show error
      }
    } finally {
      setIsLoading(false)
      setCompletedModels([])
      setPendingModels([])
    }
  }

  // ============================================================
  // EVENT HANDLERS
  // ============================================================

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    // Use ref for current value (state may be stale due to useTransition)
    const currentQuery = queryRef.current || query
    if (!currentQuery.trim()) return
    getClarifyingQuestions(currentQuery)
  }

  const handleAnswersSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    let finalQuery = originalQuery
    const filled = answers.filter((a) => a.trim())
    if (filled.length > 0) {
      finalQuery +=
        '\n\nContext:\n' +
        clarifyingQuestions
          .map((q, i) => (answers[i].trim() ? `${q}: ${answers[i]}` : ''))
          .filter(Boolean)
          .join('\n')
    }
    runFullResearch(finalQuery)
  }

  const handleSkipClarifying = () => {
    runFullResearch(originalQuery)
  }

  const handleFollowUp = (e: React.FormEvent) => {
    e.preventDefault()
    // Use ref for current value (state may be stale due to useTransition)
    const currentFollowUp = followUpQueryRef.current || followUpQuery
    if (!currentFollowUp.trim()) return
    runFullResearch(currentFollowUp, true)
  }

  const updateAnswer = (index: number, value: string) => {
    setAnswers((prev) => {
      const next = [...prev]
      next[index] = value
      return next
    })
  }

  const downloadZip = async () => {
    try {
      const response = await fetch('/api/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ history: conversationHistory }),
      })

      if (!response.ok) throw new Error('Download failed')

      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `eachie-research-${Date.now()}.zip`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      setError('Download failed')
    }
  }

  const startNew = () => {
    setStage('input')
    setConversationHistory([])
    queryRef.current = ''
    followUpQueryRef.current = ''
    setQuery('')
    setFollowUpQuery('')
    setFollowUpAttachments([])
    setOriginalQuery('')
    setClarifyingQuestions([])
    setAnswers([])
    setError(null)
    setSessionPrompt(null) // Reset session prompt on new session
    pushState('input')
  }

  // Handler to save prompt as default (persists to settings)
  const handleSavePromptAsDefault = useCallback((prompt: string) => {
    saveSettings({ orchestratorPrompt: prompt })
  }, [saveSettings])

  // ============================================================
  // RENDER
  // ============================================================

  // Don't render until settings are loaded (prevents flash)
  if (!isLoaded) {
    return null
  }

  return (
    <main className="min-h-screen bg-paper-bg">
      <div className="max-w-2xl mx-auto px-4 py-6 sm:py-10">
        {/* ---- Header ---- */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-end gap-1">
            {/* Chalk wordmark */}
            <img
              src="/eachie-wordmark.png"
              alt="Eachie"
              className="h-12 sm:h-16"
              loading="eager"
              role="img"
            />
            {/* Spider mascot - like a period at the end */}
            <img
              src="/eachie-spider.png"
              alt="Eachie spider mascot"
              className="h-[18px] sm:h-[22px] w-auto object-contain mb-0.5 sm:mb-1"
              loading="eager"
              role="img"
            />
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowHelp(true)}
              className="p-2 text-paper-muted hover:text-paper-text rounded-lg hover:bg-paper-hover"
            >
              <ChalkQuestion size={20} />
            </button>
            <button
              onClick={() => setShowSettings(true)}
              className="p-2 text-paper-muted hover:text-paper-text rounded-lg hover:bg-paper-hover"
            >
              <ChalkSettings size={20} />
            </button>
          </div>
        </div>

        {/* ---- Modals ---- */}
        {showSettings && (
          <SettingsModal
            settings={settings}
            onSave={saveSettings}
            onClose={() => setShowSettings(false)}
            byokMode={byokMode}
          />
        )}
        {showHelp && (
          <HelpModal onClose={() => setShowHelp(false)} byokMode={byokMode} />
        )}

        {/* ---- Error Banner ---- */}
        {error && (
          <div className="bg-paper-error-muted border border-paper-error/30 rounded-xl p-4 mb-4 chalk-frame">
            <p className="text-paper-error text-sm flex items-center gap-2">
              <ChalkError size={16} /> {error}
            </p>
            <button
              onClick={() => setError(null)}
              className="text-xs text-paper-error/70 mt-1 hover:underline"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* ---- Attachment Errors ---- */}
        {attachmentErrors.length > 0 && (
          <div className="bg-paper-warning-muted border border-paper-warning/30 rounded-xl p-4 mb-4 chalk-frame">
            <p className="text-paper-warning text-sm font-medium mb-1 flex items-center gap-2">
              <ChalkWarning size={16} /> Some files couldn't be attached:
            </p>
            <ul className="text-paper-warning/80 text-xs space-y-0.5 ml-6">
              {attachmentErrors.map((err, i) => (
                <li key={i}>{err}</li>
              ))}
            </ul>
            <button
              onClick={() => setAttachmentErrors([])}
              className="text-xs text-paper-warning/70 mt-2 hover:underline"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* ---- Stage: Input ---- */}
        {stage === 'input' && (
          <InputForm
            query={query}
            onQueryChange={setQuery}
            onSubmit={handleSubmit}
            attachments={attachments}
            onAttach={handleAttach}
            onRemoveAttachment={removeAttachment}
            isRecording={isRecording}
            onStartRecording={startRecording}
            onStopRecording={stopRecording}
            isLoading={isLoading || isTranscribing}
            visibleModels={visibleModels}
            selectedModels={selectedModels}
            onToggleModel={toggleModel}
            sessionPrompt={sessionPrompt}
            defaultPrompt={settings.orchestratorPrompt || DEFAULT_ORCHESTRATOR_PROMPT}
            onSessionPromptChange={setSessionPrompt}
            onSavePromptAsDefault={handleSavePromptAsDefault}
          />
        )}

        {/* ---- Stage: Clarifying Questions ---- */}
        {stage === 'clarifying' && (
          <ClarifyingQuestions
            questions={clarifyingQuestions}
            answers={answers}
            onAnswerChange={updateAnswer}
            onSubmit={handleAnswersSubmit}
            onSkip={handleSkipClarifying}
            isLoading={isLoading}
          />
        )}

        {/* ---- Stage: Research Loading (initial query only) ---- */}
        {stage === 'research' && isLoading && conversationHistory.length === 0 && (
          <ResearchProgress
            completedModels={completedModels}
            pendingModels={pendingModels}
            phase={researchPhase}
            isFollowUp={false}
          />
        )}

        {/* ---- Stage: Results ---- */}
        {stage === 'results' && conversationHistory.length > 0 && (
          <div className="space-y-4">
            {/* Existing Results (always visible, even during follow-up loading) */}
            <ResultsView conversationHistory={conversationHistory} />

            {/* Follow-up Loading Progress (NEW: shows above follow-up form) */}
            {isLoading && (
              <ResearchProgress
                completedModels={completedModels}
                pendingModels={pendingModels}
                phase={researchPhase}
                isFollowUp={true}
              />
            )}

            {/* Session Actions */}
            <div className="mt-6 flex items-center gap-3">
              <button
                type="button"
                onClick={downloadZip}
                className="text-sm text-paper-muted hover:text-paper-text inline-flex items-center gap-1"
              >
                <ChalkDownload size={16} /> Download
              </button>
              <button
                type="button"
                onClick={startNew}
                className="text-sm text-paper-muted hover:text-paper-text inline-flex items-center gap-1"
              >
                <ChalkPlus size={16} /> New
              </button>
            </div>

            {/* Follow-up Form (always visible, just disabled during loading) */}
            <div className="mt-4">
              <InputForm
                query={followUpQuery}
                onQueryChange={setFollowUpQuery}
                onSubmit={handleFollowUp}
                attachments={followUpAttachments}
                onAttach={handleFollowUpAttach}
                onRemoveAttachment={removeFollowUpAttachment}
                isRecording={isFollowUpRecording}
                onStartRecording={startFollowUpRecording}
                onStopRecording={stopFollowUpRecording}
                isLoading={isLoading || isFollowUpTranscribing}
                visibleModels={visibleModels}
                selectedModels={selectedModels}
                onToggleModel={toggleModel}
                placeholder="Ask a follow-up question..."
                submitLabel={isLoading ? '⏳' : 'Follow-up'}
                isFollowUp={true}
                sessionPrompt={sessionPrompt}
                defaultPrompt={settings.orchestratorPrompt || DEFAULT_ORCHESTRATOR_PROMPT}
                onSessionPromptChange={setSessionPrompt}
                onSavePromptAsDefault={handleSavePromptAsDefault}
              />
            </div>
          </div>
        )}

        {/* ---- Footer ---- */}
        <footer className="mt-6 text-xs text-paper-muted flex items-center justify-between">
          <div>
            <a href="/terms" className="hover:text-paper-accent">Terms</a>
            <span className="mx-2">·</span>
            <a href="/privacy" className="hover:text-paper-accent">Privacy</a>
          </div>
          <a href="https://eachie.canny.io/feature-requests" target="_blank" rel="noopener noreferrer" className="hover:text-paper-accent">
            Request a Feature
          </a>
        </footer>
      </div>
    </main>
  )
}
