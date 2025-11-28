'use client'

import { useState, useRef, useCallback, useEffect } from 'react'

interface ModelOption {
  id: string
  name: string
  description: string
  provider: string
  category: string
  cost: number
}

interface ModelResponse {
  model: string
  modelId: string
  content: string
  success: boolean
  error?: string
  durationMs?: number
  usage?: {
    promptTokens: number
    completionTokens: number
    totalTokens: number
  }
  cost?: number
}

interface ResearchResult {
  query: string
  responses: ModelResponse[]
  synthesis: string
  totalDurationMs: number
  modelCount: number
  successCount: number
  totalCost?: number
  timestamp?: string
  orchestrator?: string
}

type Stage = 'input' | 'clarifying' | 'research' | 'results'

// Organized by provider (3 columns of 6 models each)
const MODEL_OPTIONS: ModelOption[] = [
  // Column 1: Anthropic + OpenAI
  { id: 'anthropic/claude-opus-4.5:online', name: 'Claude Opus 4.5', description: 'Top reasoning & writing', provider: 'Anthropic', category: '🏆 Flagship', cost: 5 },
  { id: 'anthropic/claude-sonnet-4.5:online', name: 'Claude Sonnet 4.5', description: 'Best all-rounder', provider: 'Anthropic', category: '🏆 Flagship', cost: 3 },
  { id: 'anthropic/claude-haiku-4.5:online', name: 'Claude Haiku 4.5', description: 'Fast & economical', provider: 'Anthropic', category: '⚡ Fast', cost: 1 },
  { id: 'openai/gpt-5.1-high:online', name: 'GPT-5.1 High', description: 'Maximum reasoning', provider: 'OpenAI', category: '🏆 Flagship', cost: 4 },
  { id: 'openai/gpt-5.1:online:medium', name: 'GPT-5.1 Medium', description: 'Balanced reasoning', provider: 'OpenAI', category: '🏆 Flagship', cost: 4 },
  { id: 'openai/o3-mini:online', name: 'o3-mini', description: 'STEM-focused', provider: 'OpenAI', category: '🧠 Reasoning', cost: 2 },
  
  // Column 2: Google + Perplexity
  { id: 'google/gemini-3-pro-preview:online', name: 'Gemini 3 Pro', description: 'Top multimodal', provider: 'Google', category: '🏆 Flagship', cost: 3 },
  { id: 'google/gemini-2.5-pro:online', name: 'Gemini 2.5 Pro', description: 'High-end creative', provider: 'Google', category: '🏆 Flagship', cost: 3 },
  { id: 'google/gemini-2.5-flash:online', name: 'Gemini 2.5 Flash', description: 'Built-in thinking', provider: 'Google', category: '⚡ Fast', cost: 1 },
  { id: 'google/gemini-2.0-flash:online', name: 'Gemini 2.0 Flash', description: 'Fastest & cheapest', provider: 'Google', category: '⚡ Fast', cost: 0 },
  { id: 'perplexity/sonar-deep-research', name: 'Perplexity Deep', description: 'Exhaustive research', provider: 'Perplexity', category: '🧠 Reasoning', cost: 3 },
  { id: 'perplexity/sonar-pro', name: 'Perplexity Sonar', description: 'Fast search-native', provider: 'Perplexity', category: '🔍 Search', cost: 2 },
  
  // Column 3: X.AI + DeepSeek + Others
  { id: 'x-ai/grok-4:online', name: 'Grok 4', description: 'Creative real-time', provider: 'X.AI', category: '🏆 Flagship', cost: 2 },
  { id: 'deepseek/deepseek-r1:online', name: 'DeepSeek R1', description: 'Open reasoning', provider: 'DeepSeek', category: '🧠 Reasoning', cost: 1 },
  { id: 'qwen/qwen3-235b-a22b:online', name: 'Qwen3-Max', description: 'Multilingual creative', provider: 'Alibaba', category: '🏆 Flagship', cost: 2 },
  { id: 'moonshotai/kimi-k2:online', name: 'Kimi K2', description: 'Long-context', provider: 'Moonshot', category: '🧠 Reasoning', cost: 2 },
  { id: 'meta-llama/llama-4-maverick:online', name: 'Llama 4 Maverick', description: 'Open multimodal', provider: 'Meta', category: '⚡ Fast', cost: 0 },
  { id: 'minimax/minimax-m1-80k:online', name: 'MiniMax M1', description: 'Extended context', provider: 'MiniMax', category: '🧠 Reasoning', cost: 2 },
]

const ORCHESTRATOR_OPTIONS = [
  { id: 'anthropic/claude-sonnet-4.5', name: 'Claude Sonnet 4.5', description: 'Balanced & reliable' },
  { id: 'anthropic/claude-opus-4.5', name: 'Claude Opus 4.5', description: 'Maximum quality' },
  { id: 'openai/gpt-5.1-high', name: 'GPT-5.1 High', description: 'Deep reasoning' },
  { id: 'openai/gpt-5.1:medium', name: 'GPT-5.1 Medium', description: 'Balanced reasoning' },
  { id: 'openai/gpt-5.1-low', name: 'GPT-5.1 Low', description: 'Fast reasoning' },
  { id: 'google/gemini-3-pro-preview', name: 'Gemini 3 Pro', description: 'Multimodal synthesis' },
]

const TRANSCRIPTION_SERVICES = [
  { id: 'groq', name: 'Groq Whisper', description: '$0.0001/min', cost: 0.0001 },
  { id: 'openai', name: 'OpenAI Whisper', description: '$0.006/min', cost: 0.006 },
  { id: 'deepgram', name: 'Deepgram Nova-2', description: '$0.0043/min', cost: 0.0043 },
]

const DEFAULT_QUICK = ['anthropic/claude-haiku-4.5:online', 'google/gemini-2.5-flash:online', 'deepseek/deepseek-r1:online']
const DEFAULT_DEEP = ['anthropic/claude-sonnet-4.5:online', 'openai/gpt-5.1:online:medium', 'google/gemini-3-pro-preview:online', 'deepseek/deepseek-r1:online', 'perplexity/sonar-deep-research']

export default function Home() {
  const [query, setQuery] = useState('')
  const [images, setImages] = useState<File[]>([])
  const [imagePreviews, setImagePreviews] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showModelSelector, setShowModelSelector] = useState(false)
  const [showFollowUpModels, setShowFollowUpModels] = useState(false)
  const [showOrchestratorSelector, setShowOrchestratorSelector] = useState(false)
  const [showTranscriptionSelector, setShowTranscriptionSelector] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  
  const [selectedModels, setSelectedModels] = useState<string[]>(DEFAULT_QUICK)
  const [isDeepMode, setIsDeepMode] = useState(false)
  const [selectedOrchestrator, setSelectedOrchestrator] = useState('anthropic/claude-sonnet-4.5')
  const [selectedTranscriptionService, setSelectedTranscriptionService] = useState('groq')
  
  const [stage, setStage] = useState<Stage>('input')
  const [clarifyingQuestions, setClarifyingQuestions] = useState<string[]>([])
  const [answers, setAnswers] = useState<string[]>([])
  const [originalQuery, setOriginalQuery] = useState('')
  
  const [followUpQuery, setFollowUpQuery] = useState('')
  const [conversationHistory, setConversationHistory] = useState<ResearchResult[]>([])
  const [expandedRounds, setExpandedRounds] = useState<Set<number>>(new Set())
  
  const [isRecording, setIsRecording] = useState(false)
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null)
  const [audioChunks, setAudioChunks] = useState<Blob[]>([])

  useEffect(() => {
    if (!showModelSelector) {
      setSelectedModels(isDeepMode ? DEFAULT_DEEP : DEFAULT_QUICK)
    }
  }, [isDeepMode, showModelSelector])

  const toggleModel = (modelId: string) => {
    if (selectedModels.includes(modelId)) {
      setSelectedModels(selectedModels.filter(id => id !== modelId))
    } else if (selectedModels.length < 5) {
      setSelectedModels([...selectedModels, modelId])
    }
  }

  const handleImageChange = useCallback((files: FileList | null) => {
    if (!files) return
    const newFiles = Array.from(files).filter(f => 
      ['image/jpeg', 'image/png', 'image/gif', 'image/webp'].includes(f.type)
    )
    const combined = [...images, ...newFiles].slice(0, 4)
    setImages(combined)
    setImagePreviews(prev => {
      prev.forEach(url => URL.revokeObjectURL(url))
      return combined.map(f => URL.createObjectURL(f))
    })
  }, [images])

  const removeImage = (index: number) => {
    setImages(images.filter((_, i) => i !== index))
    URL.revokeObjectURL(imagePreviews[index])
    setImagePreviews(imagePreviews.filter((_, i) => i !== index))
  }

  const compactContext = (history: ResearchResult[]): string => {
    if (history.length === 0) return ''
    const recent = history.slice(-2)
    return recent.map((r, i) => {
      const short = r.synthesis.split(' ').slice(0, 400).join(' ')
      return `Research ${i + 1}: "${r.query.slice(0, 80)}"\nFindings: ${short}`
    }).join('\n\n---\n\n')
  }

  // Voice transcription
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const recorder = new MediaRecorder(stream)
      const chunks: Blob[] = []
      
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data)
      }
      
      recorder.onstop = async () => {
        const audioBlob = new Blob(chunks, { type: 'audio/webm' })
        await transcribeAudio(audioBlob)
        stream.getTracks().forEach(track => track.stop())
      }
      
      recorder.start()
      setMediaRecorder(recorder)
      setAudioChunks(chunks)
      setIsRecording(true)
    } catch (err) {
      setError('Microphone access denied')
    }
  }

  const stopRecording = () => {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      mediaRecorder.stop()
      setIsRecording(false)
    }
  }

  const transcribeAudio = async (audioBlob: Blob) => {
    setIsLoading(true)
    try {
      const formData = new FormData()
      formData.append('audio', audioBlob)
      formData.append('service', selectedTranscriptionService)
      formData.append('context', conversationHistory.length > 0 ? conversationHistory[conversationHistory.length - 1].query : '')
      
      const response = await fetch('/api/transcribe', {
        method: 'POST',
        body: formData,
      })
      
      if (response.ok) {
        const data = await response.json()
        setQuery(data.text)
      } else {
        throw new Error('Transcription failed')
      }
    } catch (err) {
      setError('Transcription failed. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  const getClarifyingQuestions = async (userQuery: string) => {
    setIsLoading(true)
    setOriginalQuery(userQuery)
    
    try {
      const response = await fetch('/api/clarify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: userQuery }),
      })
      
      if (response.ok) {
        const data = await response.json()
        if (data.questions?.length > 0) {
          setClarifyingQuestions(data.questions)
          setAnswers(new Array(data.questions.length).fill(''))
          setStage('clarifying')
          setIsLoading(false)
          return
        }
      }
    } catch {/* fallthrough */}
    
    await runFullResearch(userQuery)
  }

  const runFullResearch = async (finalQuery: string, isFollowUp = false) => {
    setIsLoading(true)
    setStage('research')
    setError(null)

    let enhancedQuery = finalQuery
    if (isFollowUp && conversationHistory.length > 0) {
      const context = compactContext(conversationHistory)
      enhancedQuery = `Context:\n${context}\n\nNew question: ${finalQuery}`
    }

    try {
      const base64Images = await Promise.all(
        images.map(async (file) => {
          const buf = await file.arrayBuffer()
          const base64 = btoa(String.fromCharCode(...new Uint8Array(buf)))
          return { base64, mimeType: file.type as any }
        })
      )

      const response = await fetch('/api/research', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: enhancedQuery,
          images: base64Images.length > 0 ? base64Images : undefined,
          mode: isDeepMode ? 'deep' : 'quick',
          modelIds: selectedModels,
          orchestratorId: selectedOrchestrator,
        }),
      })

      if (!response.ok) throw new Error(await response.text())
      const result: ResearchResult = await response.json()
      
      setConversationHistory(prev => [...prev, result])
      setStage('results')
      
      if (!isFollowUp) {
        setQuery('')
        setImages([])
        setImagePreviews([])
      } else {
        setFollowUpQuery('')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Research failed')
      setStage('results')
    } finally {
      setIsLoading(false)
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!query.trim()) return
    getClarifyingQuestions(query)
  }

  const handleAnswersSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    let finalQuery = originalQuery
    const filled = answers.filter(a => a.trim())
    if (filled.length > 0) {
      finalQuery += '\n\nContext:\n' + clarifyingQuestions
        .map((q, i) => answers[i].trim() ? `${q}: ${answers[i]}` : '')
        .filter(Boolean).join('\n')
    }
    runFullResearch(finalQuery)
  }

  const handleFollowUp = (e: React.FormEvent) => {
    e.preventDefault()
    if (!followUpQuery.trim()) return
    runFullResearch(followUpQuery, true)
  }

  const toggleRoundExpansion = (roundIdx: number) => {
    setExpandedRounds(prev => {
      const next = new Set(prev)
      if (next.has(roundIdx)) {
        next.delete(roundIdx)
      } else {
        next.add(roundIdx)
      }
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
      a.download = `research-${Date.now()}.zip`
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      setError('Download failed')
    }
  }

  const ModelSelector = ({ showState, setShowState }: { showState: boolean, setShowState: (v: boolean) => void }) => (
    <div>
      <button
        type="button"
        onClick={() => setShowState(!showState)}
        className="text-xs text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 flex items-center gap-1"
      >
        <span>⚙️</span>
        <span>{selectedModels.length}/5 models</span>
        <span>{showState ? '▲' : '▼'}</span>
      </button>
      {showState && (
        <div className="mt-2 p-2 bg-slate-100 dark:bg-slate-800 rounded-lg grid grid-cols-3 gap-2 max-h-64 overflow-y-auto">
          {MODEL_OPTIONS.map((model) => (
            <label key={model.id} className={`flex flex-col gap-0.5 p-1.5 rounded text-xs cursor-pointer
              ${selectedModels.includes(model.id) 
                ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300' 
                : 'hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300'}`}>
              <div className="flex items-center gap-1">
                <input type="checkbox" checked={selectedModels.includes(model.id)}
                  onChange={() => toggleModel(model.id)}
                  disabled={!selectedModels.includes(model.id) && selectedModels.length >= 5}
                  className="rounded text-blue-600 w-3 h-3 flex-shrink-0" />
                <span className="font-medium truncate">{model.name}</span>
              </div>
              <span className="text-[10px] text-slate-500 dark:text-slate-400 pl-4">{model.description}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  )

  const OrchestratorSelector = () => (
    <div>
      <button
        type="button"
        onClick={() => setShowOrchestratorSelector(!showOrchestratorSelector)}
        className="text-xs text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 flex items-center gap-1"
      >
        <span>🎯</span>
        <span>Orchestrator</span>
        <span>{showOrchestratorSelector ? '▲' : '▼'}</span>
      </button>
      {showOrchestratorSelector && (
        <div className="mt-2 p-2 bg-slate-100 dark:bg-slate-800 rounded-lg space-y-1">
          {ORCHESTRATOR_OPTIONS.map((orch) => (
            <label key={orch.id} className={`flex items-center gap-2 p-1.5 rounded text-xs cursor-pointer
              ${selectedOrchestrator === orch.id
                ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                : 'hover:bg-slate-200 dark:hover:bg-slate-700'}`}>
              <input type="radio" checked={selectedOrchestrator === orch.id}
                onChange={() => setSelectedOrchestrator(orch.id)}
                className="w-3 h-3" />
              <div className="flex flex-col">
                <span className="font-medium">{orch.name}</span>
                <span className="text-[10px] text-slate-500 dark:text-slate-400">{orch.description}</span>
              </div>
            </label>
          ))}
        </div>
      )}
    </div>
  )

  const TranscriptionSelector = () => (
    <div>
      <button
        type="button"
        onClick={() => setShowTranscriptionSelector(!showTranscriptionSelector)}
        className="text-xs text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 flex items-center gap-1"
      >
        <span>🎤</span>
        <span>{showTranscriptionSelector ? '▲' : '▼'}</span>
      </button>
      {showTranscriptionSelector && (
        <div className="mt-2 p-2 bg-slate-100 dark:bg-slate-800 rounded-lg space-y-1">
          {TRANSCRIPTION_SERVICES.map((service) => (
            <label key={service.id} className={`flex items-center gap-2 p-1.5 rounded text-xs cursor-pointer
              ${selectedTranscriptionService === service.id
                ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                : 'hover:bg-slate-200 dark:hover:bg-slate-700'}`}>
              <input type="radio" checked={selectedTranscriptionService === service.id}
                onChange={() => setSelectedTranscriptionService(service.id)}
                className="w-3 h-3" />
              <div className="flex flex-col">
                <span className="font-medium">{service.name}</span>
                <span className="text-[10px] text-slate-500 dark:text-slate-400">{service.description}</span>
              </div>
            </label>
          ))}
        </div>
      )}
    </div>
  )

  // Calculate cumulative cost
  const cumulativeCost = conversationHistory.reduce((sum, r) => sum + (r.totalCost || 0), 0)

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
      <div className="max-w-2xl mx-auto px-4 py-6 sm:py-10">
        <div className="text-center mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-800 dark:text-slate-100 mb-1">🔬 Research Agent</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">Multi-model AI with web search</p>
        </div>

        {stage === 'input' && (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
              <textarea
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="What would you like to research?"
                className="w-full p-4 text-base sm:text-lg resize-y border-0 focus:ring-0 focus:outline-none placeholder:text-slate-400 dark:placeholder:text-slate-500 min-h-[120px] bg-transparent dark:text-slate-100"
                disabled={isLoading}
              />

              {imagePreviews.length > 0 && (
                <div className="flex flex-wrap gap-2 px-4 pb-3">
                  {imagePreviews.map((preview, i) => (
                    <div key={i} className="relative">
                      <img src={preview} alt="" className="h-16 w-16 object-cover rounded-lg border border-slate-300 dark:border-slate-600" />
                      <button type="button" onClick={() => removeImage(i)}
                        className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-5 h-5 text-xs hover:bg-red-600">×</button>
                    </div>
                  ))}
                </div>
              )}

              <div className="border-t border-slate-100 dark:border-slate-700 p-3 bg-slate-50 dark:bg-slate-900 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <button type="button" onClick={() => fileInputRef.current?.click()}
                      className="text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 text-sm flex items-center gap-1">
                      <span>📷</span>
                      <span className="hidden sm:inline">{images.length > 0 ? `${images.length}/4` : 'Images'}</span>
                    </button>
                    <input ref={fileInputRef} type="file" accept="image/*" multiple
                      onChange={(e) => handleImageChange(e.target.files)} className="hidden" />
                    
                    <button type="button" 
                      onClick={isRecording ? stopRecording : startRecording}
                      className={`text-sm flex items-center gap-1 ${isRecording ? 'text-red-500 animate-pulse' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700'}`}>
                      <span>🎤</span>
                      <span className="hidden sm:inline">{isRecording ? 'Stop' : 'Voice'}</span>
                    </button>
                    
                    <label className="flex items-center gap-2 text-sm cursor-pointer">
                      <input type="checkbox" checked={isDeepMode} onChange={(e) => setIsDeepMode(e.target.checked)}
                        className="rounded text-blue-600 w-4 h-4" />
                      <span className="text-slate-600 dark:text-slate-300">Deep</span>
                    </label>
                  </div>
                  
                  <button type="submit" disabled={isLoading || !query.trim()}
                    className="px-5 py-2 bg-blue-600 dark:bg-blue-500 text-white rounded-lg font-medium hover:bg-blue-700 dark:hover:bg-blue-600 disabled:opacity-50 text-sm sm:text-base">
                    {isLoading ? '⏳' : 'Research'}
                  </button>
                </div>

                <div className="flex items-center gap-3 flex-wrap">
                  <ModelSelector showState={showModelSelector} setShowState={setShowModelSelector} />
                  <OrchestratorSelector />
                  <TranscriptionSelector />
                </div>
              </div>
            </div>
          </form>
        )}

        {stage === 'clarifying' && (
          <form onSubmit={handleAnswersSubmit} className="space-y-4">
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
              <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border-b border-blue-100 dark:border-blue-800">
                <p className="text-sm text-blue-700 dark:text-blue-300">💬 Quick context for better results (optional)</p>
              </div>
              <div className="p-4 space-y-3">
                {clarifyingQuestions.map((q, i) => (
                  <div key={i}>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">{i + 1}. {q}</label>
                    <input type="text" value={answers[i]}
                      onChange={(e) => { const a = [...answers]; a[i] = e.target.value; setAnswers(a) }}
                      placeholder="Optional" className="w-full px-3 py-2 border border-slate-200 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-900 dark:text-slate-100" />
                  </div>
                ))}
              </div>
              <div className="border-t border-slate-100 dark:border-slate-700 p-3 bg-slate-50 dark:bg-slate-900 flex justify-between">
                <button type="button" onClick={() => runFullResearch(originalQuery)} 
                  className="text-sm text-slate-500 dark:text-slate-400">Skip →</button>
                <button type="submit" disabled={isLoading} 
                  className="px-5 py-2 bg-blue-600 dark:bg-blue-500 text-white rounded-lg text-sm font-medium">
                  {isLoading ? '⏳' : 'Research'}
                </button>
              </div>
            </div>
          </form>
        )}

        {stage === 'research' && isLoading && (
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-8 text-center">
            <div className="animate-pulse">
              <div className="text-4xl mb-3">🔬</div>
              <p className="text-slate-600 dark:text-slate-300">Querying {selectedModels.length} models...</p>
              <p className="text-sm text-slate-400 dark:text-slate-500 mt-1">{isDeepMode ? '~60 sec' : '~20 sec'}</p>
            </div>
          </div>
        )}

        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4 mb-4">
            <p className="text-red-700 dark:text-red-300 text-sm">❌ {error}</p>
          </div>
        )}

        {stage === 'results' && conversationHistory.length > 0 && (
          <div className="space-y-4">
            {/* Cumulative Cost Banner */}
            {cumulativeCost > 0 && (
              <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg px-4 py-2 text-sm">
                <span className="font-medium text-green-700 dark:text-green-300">Total Session Cost: </span>
                <span className="text-green-600 dark:text-green-400">${cumulativeCost.toFixed(4)}</span>
              </div>
            )}

            {/* Conversation Thread */}
            {conversationHistory.map((result, roundIdx) => (
              <div key={roundIdx} className="space-y-3">
                {/* Query label */}
                <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                  <span className="font-medium">
                    {roundIdx === 0 ? '🔍 Initial Query' : `💬 Follow-up ${roundIdx}`}
                  </span>
                  {result.timestamp && (
                    <span>• {new Date(result.timestamp).toLocaleTimeString()}</span>
                  )}
                  {result.orchestrator && (
                    <span>• Synthesized by {result.orchestrator}</span>
                  )}
                </div>
                
                {/* Query text */}
                <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg px-4 py-2 text-sm text-blue-800 dark:text-blue-200">
                  {result.query}
                </div>

                {/* Synthesis */}
                <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold text-slate-800 dark:text-slate-100">✨ Synthesis</h3>
                    {result.totalCost && (
                      <span className="text-xs text-green-600 dark:text-green-400">
                        ${result.totalCost.toFixed(4)}
                      </span>
                    )}
                  </div>
                  <div className="prose prose-sm dark:prose-invert max-w-none">
                    {result.synthesis.split('\n').map((para, i) => (
                      <p key={i}>{para}</p>
                    ))}
                  </div>
                </div>

                {/* Individual Responses - Expandable */}
                <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
                  <button
                    type="button"
                    onClick={() => toggleRoundExpansion(roundIdx)}
                    className="w-full px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center justify-between"
                  >
                    <span>Individual Responses ({result.successCount}/{result.modelCount})</span>
                    <span>{expandedRounds.has(roundIdx) ? '▲' : '▼'}</span>
                  </button>
                  
                  {expandedRounds.has(roundIdx) && (
                    <div className="border-t border-slate-200 dark:border-slate-700 p-4 space-y-4">
                      {result.responses.map((response, i) => (
                        <div key={i} className="border-l-4 border-slate-200 dark:border-slate-600 pl-4">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <h4 className="font-medium text-sm text-slate-700 dark:text-slate-200">
                                {response.success ? '✓' : '✗'} {response.model}
                              </h4>
                              {response.durationMs && (
                                <span className="text-xs text-slate-400 dark:text-slate-500">
                                  {(response.durationMs / 1000).toFixed(1)}s
                                </span>
                              )}
                              {response.cost !== undefined && response.cost > 0 && (
                                <span className="text-xs text-green-600 dark:text-green-400">
                                  ${response.cost.toFixed(4)}
                                </span>
                              )}
                            </div>
                            {response.usage && (
                              <span className="text-xs text-slate-400 dark:text-slate-500">
                                {response.usage.totalTokens.toLocaleString()} tokens
                              </span>
                            )}
                          </div>
                          {response.success ? (
                            <div className="text-sm text-slate-600 dark:text-slate-300 prose prose-sm dark:prose-invert max-w-none">
                              {response.content.split('\n').map((para, j) => (
                                <p key={j}>{para}</p>
                              ))}
                            </div>
                          ) : (
                            <p className="text-sm text-red-600 dark:text-red-400">Error: {response.error}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}

            {/* Follow-up Form */}
            <form onSubmit={handleFollowUp} className="mt-6">
              <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
                <textarea
                  value={followUpQuery}
                  onChange={(e) => setFollowUpQuery(e.target.value)}
                  placeholder="Follow-up question..."
                  className="w-full p-4 text-base resize-y border-0 focus:ring-0 focus:outline-none placeholder:text-slate-400 dark:placeholder:text-slate-500 min-h-[120px] bg-transparent dark:text-slate-100"
                  disabled={isLoading}
                />
                <div className="border-t border-slate-100 dark:border-slate-700 p-3 bg-slate-50 dark:bg-slate-900 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <button type="button" onClick={downloadZip}
                      className="text-sm text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200">
                      💾 Download
                    </button>
                    <ModelSelector showState={showFollowUpModels} setShowState={setShowFollowUpModels} />
                  </div>
                  <button type="submit" disabled={isLoading || !followUpQuery.trim()}
                    className="px-5 py-2 bg-blue-600 dark:bg-blue-500 text-white rounded-lg font-medium hover:bg-blue-700 dark:hover:bg-blue-600 disabled:opacity-50 text-sm">
                    {isLoading ? '⏳' : 'Follow-up'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        )}
      </div>
    </main>
  )
}
