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

import { useState, useCallback, useEffect } from 'react'
import type { Stage, ResearchResult, ModelOption, HistoryState, Attachment } from '@/types'
import { MODEL_OPTIONS, DEFAULT_MODELS } from '@/config/models'
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
  const [query, setQuery] = useState('')
  const [attachments, setAttachments] = useState<Attachment[]>([])
  const [stage, setStage] = useState<Stage>('input')
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [attachmentErrors, setAttachmentErrors] = useState<string[]>([])

  // ---- Model Selection ----
  const [selectedModels, setSelectedModels] = useState<string[]>(DEFAULT_MODELS)

  // ---- Clarifying Questions ----
  const [clarifyingQuestions, setClarifyingQuestions] = useState<string[]>([])
  const [answers, setAnswers] = useState<string[]>([])
  const [originalQuery, setOriginalQuery] = useState('')

  // ---- Results ----
  const [conversationHistory, setConversationHistory] = useState<ResearchResult[]>([])
  const [followUpQuery, setFollowUpQuery] = useState('')

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
    if (state.stage === 'input' && state.query) {
      setQuery(state.query)
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
          setClarifyingQuestions(data.questions)
          setAnswers(new Array(data.questions.length).fill(''))
          setStage('clarifying')
          pushState('clarifying', userQuery)
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
   * Runs the main research flow:
   * 1. Query all selected models in parallel
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
    setPendingModels(modelNames)

    // Preserve query for error recovery
    if (!isFollowUp) {
      setPreservedQuery(finalQuery)
    } else {
      setPreservedQuery(followUpQuery)
    }

    // Build query with context for follow-ups
    let enhancedQuery = finalQuery
    if (isFollowUp && conversationHistory.length > 0) {
      const context = compactContext(conversationHistory)
      enhancedQuery = `Context:\n${context}\n\nNew question: ${finalQuery}`
    }

    try {
      const response = await fetch('/api/research', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: enhancedQuery,
          attachments: attachments.length > 0 ? attachments : undefined,
          modelIds: selectedModels,
          orchestratorId: settings.orchestrator,
          apiKey: settings.openrouterKey || undefined,
          byokMode,
        }),
      })

      if (!response.ok) {
        const errText = await response.text()
        throw new Error(errText || 'Research failed')
      }

      // Simulate progress (since we don't have streaming yet)
      // In a real streaming implementation, these would update as each model responds
      setResearchPhase('synthesizing')
      setCompletedModels(modelNames)
      setPendingModels([])

      const result: ResearchResult = await response.json()

      // Success! Add to history and go to results
      setConversationHistory((prev) => [...prev, result])
      setStage('results')
      pushState('results')

      // Clear form data on success
      if (!isFollowUp) {
        setQuery('')
        setAttachments([])
        setOriginalQuery('')
        setClarifyingQuestions([])
        setAnswers([])
      } else {
        setFollowUpQuery('')
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Research failed'
      setError(errorMessage)

      // GRACEFUL FAILURE: Restore query for editing
      if (!isFollowUp) {
        setQuery(preservedQuery)
        setStage('input')
        pushState('input', preservedQuery)
      } else {
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
    if (!query.trim()) return
    getClarifyingQuestions(query)
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
    if (!followUpQuery.trim()) return
    runFullResearch(followUpQuery, true)
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
    setQuery('')
    setFollowUpQuery('')
    setOriginalQuery('')
    setClarifyingQuestions([])
    setAnswers([])
    setError(null)
    pushState('input')
  }

  // ============================================================
  // RENDER
  // ============================================================

  // Don't render until settings are loaded (prevents flash)
  if (!isLoaded) {
    return null
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
      <div className="max-w-2xl mx-auto px-4 py-6 sm:py-10">
        {/* ---- Header ---- */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-800 dark:text-slate-100">
              🔬 Eachie
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Multi-model AI research
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowHelp(true)}
              className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700"
            >
              <span className="text-lg">?</span>
            </button>
            <button
              onClick={() => setShowSettings(true)}
              className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700"
            >
              <span className="text-lg">⚙️</span>
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
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4 mb-4">
            <p className="text-red-700 dark:text-red-300 text-sm">❌ {error}</p>
            <button
              onClick={() => setError(null)}
              className="text-xs text-red-500 mt-1 hover:underline"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* ---- Attachment Errors ---- */}
        {attachmentErrors.length > 0 && (
          <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4 mb-4">
            <p className="text-amber-700 dark:text-amber-300 text-sm font-medium mb-1">⚠️ Some files couldn't be attached:</p>
            <ul className="text-amber-600 dark:text-amber-400 text-xs space-y-0.5">
              {attachmentErrors.map((err, i) => (
                <li key={i}>{err}</li>
              ))}
            </ul>
            <button
              onClick={() => setAttachmentErrors([])}
              className="text-xs text-amber-500 mt-2 hover:underline"
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

            {/* Follow-up Form (always visible, just disabled during loading) */}
            <div className="mt-6">
              <InputForm
                query={followUpQuery}
                onQueryChange={setFollowUpQuery}
                onSubmit={handleFollowUp}
                attachments={[]}
                onAttach={() => {}}
                onRemoveAttachment={() => {}}
                isRecording={false}
                onStartRecording={() => {}}
                onStopRecording={() => {}}
                isLoading={isLoading}
                visibleModels={visibleModels}
                selectedModels={selectedModels}
                onToggleModel={toggleModel}
                placeholder="Ask a follow-up question..."
                submitLabel={isLoading ? '⏳' : 'Follow-up'}
                isFollowUp={true}
                onDownload={downloadZip}
                onStartNew={startNew}
              />
            </div>
          </div>
        )}
      </div>
    </main>
  )
}
