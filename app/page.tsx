'use client'

import { useState, useRef, useCallback, useEffect } from 'react'

// ============ Types ============
interface ModelOption {
  id: string
  name: string
  description: string
  provider: string
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

interface Settings {
  openrouterKey: string
  openaiKey: string
  deepgramKey: string
  groqKey: string
  orchestrator: string
  transcriptionService: string
  hiddenModels: string[]
}

type Stage = 'input' | 'clarifying' | 'research' | 'results'

// ============ Constants ============
const MODEL_OPTIONS: ModelOption[] = [
  // Anthropic
  { id: 'anthropic/claude-opus-4.5:online', name: 'Claude Opus 4.5', description: 'Top reasoning & writing', provider: 'Anthropic', cost: 5 },
  { id: 'anthropic/claude-sonnet-4.5:online', name: 'Claude Sonnet 4.5', description: 'Best all-rounder', provider: 'Anthropic', cost: 3 },
  { id: 'anthropic/claude-haiku-4.5:online', name: 'Claude Haiku 4.5', description: 'Fast & economical', provider: 'Anthropic', cost: 1 },
  // OpenAI
  { id: 'openai/gpt-5.1:online', name: 'GPT-5.1', description: 'High reasoning depth', provider: 'OpenAI', cost: 4 },
  { id: 'openai/o3-mini:online', name: 'o3-mini', description: 'STEM-focused', provider: 'OpenAI', cost: 2 },
  // Google
  { id: 'google/gemini-3-pro-preview:online', name: 'Gemini 3 Pro', description: 'Top multimodal', provider: 'Google', cost: 3 },
  { id: 'google/gemini-2.5-pro:online', name: 'Gemini 2.5 Pro', description: 'High-end creative', provider: 'Google', cost: 3 },
  { id: 'google/gemini-2.5-flash:online', name: 'Gemini 2.5 Flash', description: 'Built-in thinking', provider: 'Google', cost: 1 },
  { id: 'google/gemini-2.0-flash:online', name: 'Gemini 2.0 Flash', description: 'Fastest & cheapest', provider: 'Google', cost: 0 },
  // Perplexity
  { id: 'perplexity/sonar-deep-research', name: 'Perplexity Deep', description: 'Exhaustive research', provider: 'Perplexity', cost: 3 },
  { id: 'perplexity/sonar-pro', name: 'Perplexity Sonar', description: 'Fast search-native', provider: 'Perplexity', cost: 2 },
  // Others
  { id: 'x-ai/grok-4:online', name: 'Grok 4', description: 'Creative real-time', provider: 'X.AI', cost: 2 },
  { id: 'deepseek/deepseek-r1:online', name: 'DeepSeek R1', description: 'Open reasoning', provider: 'DeepSeek', cost: 1 },
  { id: 'qwen/qwen3-235b-a22b:online', name: 'Qwen3-Max', description: 'Multilingual creative', provider: 'Alibaba', cost: 2 },
  { id: 'moonshotai/kimi-k2:online', name: 'Kimi K2', description: 'Long-context', provider: 'Moonshot', cost: 2 },
  { id: 'meta-llama/llama-4-maverick:online', name: 'Llama 4 Maverick', description: 'Open multimodal', provider: 'Meta', cost: 0 },
  { id: 'minimax/minimax-m1-80k:online', name: 'MiniMax M1', description: 'Extended context', provider: 'MiniMax', cost: 2 },
]

const ORCHESTRATOR_OPTIONS = [
  { id: 'anthropic/claude-sonnet-4.5', name: 'Claude Sonnet 4.5', description: 'Balanced & reliable' },
  { id: 'anthropic/claude-opus-4.5', name: 'Claude Opus 4.5', description: 'Maximum quality' },
  { id: 'openai/gpt-5.1', name: 'GPT-5.1', description: 'High reasoning depth' },
  { id: 'google/gemini-3-pro-preview', name: 'Gemini 3 Pro', description: 'Multimodal synthesis' },
]

const TRANSCRIPTION_SERVICES = [
  { id: 'openai', name: 'OpenAI Whisper', key: 'openaiKey' },
  { id: 'deepgram', name: 'Deepgram Nova-2', key: 'deepgramKey' },
  { id: 'groq', name: 'Groq Whisper', key: 'groqKey' },
]

const DEFAULT_QUICK = ['anthropic/claude-haiku-4.5:online', 'google/gemini-2.5-flash:online', 'deepseek/deepseek-r1:online']
const DEFAULT_DEEP = ['anthropic/claude-sonnet-4.5:online', 'openai/gpt-5.1:online', 'google/gemini-3-pro-preview:online', 'deepseek/deepseek-r1:online', 'perplexity/sonar-deep-research']

const DEFAULT_SETTINGS: Settings = {
  openrouterKey: '',
  openaiKey: '',
  deepgramKey: '',
  groqKey: '',
  orchestrator: 'anthropic/claude-sonnet-4.5',
  transcriptionService: 'openai',
  hiddenModels: [],
}

// ============ Main Component ============
export default function Home() {
  // Core state
  const [query, setQuery] = useState('')
  const [images, setImages] = useState<File[]>([])
  const [imagePreviews, setImagePreviews] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [stage, setStage] = useState<Stage>('input')
  
  // Model selection
  const [selectedModels, setSelectedModels] = useState<string[]>(DEFAULT_QUICK)
  const [isDeepMode, setIsDeepMode] = useState(false)
  const [showModelSelector, setShowModelSelector] = useState(false)
  
  // Clarifying questions
  const [clarifyingQuestions, setClarifyingQuestions] = useState<string[]>([])
  const [answers, setAnswers] = useState<string[]>([])
  const [originalQuery, setOriginalQuery] = useState('')
  
  // Results
  const [followUpQuery, setFollowUpQuery] = useState('')
  const [conversationHistory, setConversationHistory] = useState<ResearchResult[]>([])
  const [expandedRounds, setExpandedRounds] = useState<Set<number>>(new Set())
  
  // Voice recording
  const [isRecording, setIsRecording] = useState(false)
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null)
  
  // Settings & modals
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS)
  const [showSettings, setShowSettings] = useState(false)
  const [showHelp, setShowHelp] = useState(false)
  
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Load settings from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('researchAgentSettings')
    if (saved) {
      try {
        setSettings({ ...DEFAULT_SETTINGS, ...JSON.parse(saved) })
      } catch { /* ignore */ }
    }
  }, [])

  // Save settings to localStorage
  const saveSettings = (newSettings: Settings) => {
    setSettings(newSettings)
    localStorage.setItem('researchAgentSettings', JSON.stringify(newSettings))
  }

  // Filter visible models
  const visibleModels = MODEL_OPTIONS.filter(m => !settings.hiddenModels.includes(m.id))

  // Update selected models when deep mode changes
  useEffect(() => {
    const visible = visibleModels.map(m => m.id)
    const defaults = isDeepMode ? DEFAULT_DEEP : DEFAULT_QUICK
    setSelectedModels(defaults.filter(id => visible.includes(id)).slice(0, 5))
  }, [isDeepMode, settings.hiddenModels])

  // ============ Model Selection ============
  const toggleModel = (modelId: string) => {
    if (selectedModels.includes(modelId)) {
      setSelectedModels(selectedModels.filter(id => id !== modelId))
    } else if (selectedModels.length < 5) {
      setSelectedModels([...selectedModels, modelId])
    }
  }

  // ============ Image Handling ============
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

  // ============ Voice Recording ============
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
      setIsRecording(true)
    } catch {
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
      formData.append('service', settings.transcriptionService)
      formData.append('context', conversationHistory.length > 0 ? conversationHistory[conversationHistory.length - 1].query : '')
      
      // Add user API key if provided
      const keyMap: Record<string, string> = {
        openai: settings.openaiKey,
        deepgram: settings.deepgramKey,
        groq: settings.groqKey,
      }
      if (keyMap[settings.transcriptionService]) {
        formData.append('apiKey', keyMap[settings.transcriptionService])
      }
      
      const response = await fetch('/api/transcribe', {
        method: 'POST',
        body: formData,
      })
      
      if (response.ok) {
        const data = await response.json()
        setQuery(data.text)
      } else {
        const errData = await response.json()
        throw new Error(errData.error || 'Transcription failed')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Transcription failed')
    } finally {
      setIsLoading(false)
    }
  }

  // ============ Research Flow ============
  const compactContext = (history: ResearchResult[]): string => {
    if (history.length === 0) return ''
    const recent = history.slice(-2)
    return recent.map((r, i) => {
      const short = r.synthesis.split(' ').slice(0, 400).join(' ')
      return `Research ${i + 1}: "${r.query.slice(0, 80)}"\nFindings: ${short}`
    }).join('\n\n---\n\n')
  }

  const getClarifyingQuestions = async (userQuery: string) => {
    setIsLoading(true)
    setOriginalQuery(userQuery)
    
    try {
      const response = await fetch('/api/clarify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          query: userQuery,
          apiKey: settings.openrouterKey || undefined
        }),
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
    } catch { /* fallthrough */ }
    
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
          return { base64, mimeType: file.type }
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
          orchestratorId: settings.orchestrator,
          apiKey: settings.openrouterKey || undefined,
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

  // ============ Event Handlers ============
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
      next.has(roundIdx) ? next.delete(roundIdx) : next.add(roundIdx)
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
    } catch {
      setError('Download failed')
    }
  }

  const startNew = () => {
    setStage('input')
    setConversationHistory([])
    setQuery('')
    setFollowUpQuery('')
    setError(null)
  }

  const cumulativeCost = conversationHistory.reduce((sum, r) => sum + (r.totalCost || 0), 0)

  // ============ Sub-Components ============
  
  // Pill Button Component
  const Pill = ({ active, onClick, icon, label, recording }: { 
    active?: boolean, onClick: () => void, icon: string, label: string, recording?: boolean 
  }) => (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-all
        ${recording ? 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 animate-pulse' :
          active ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300' : 
          'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'}`}
    >
      <span>{icon}</span>
      <span>{label}</span>
    </button>
  )

  // Settings Modal
  const SettingsModal = () => (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowSettings(false)}>
      <div className="bg-white dark:bg-slate-800 rounded-xl max-w-lg w-full max-h-[90vh] overflow-y-auto shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="sticky top-0 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-6 py-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100">⚙️ Settings</h2>
          <button onClick={() => setShowSettings(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xl">×</button>
        </div>
        
        <div className="p-6 space-y-6">
          {/* API Keys */}
          <div>
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1">API Keys</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">Optional. Uses server keys if empty. Keys are stored locally in your browser.</p>
            
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">OpenRouter (for all models)</label>
                <input
                  type="password"
                  value={settings.openrouterKey}
                  onChange={(e) => saveSettings({ ...settings, openrouterKey: e.target.value })}
                  placeholder="sk-or-..."
                  className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 dark:text-slate-100"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">OpenAI (for voice transcription)</label>
                <input
                  type="password"
                  value={settings.openaiKey}
                  onChange={(e) => saveSettings({ ...settings, openaiKey: e.target.value })}
                  placeholder="sk-..."
                  className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 dark:text-slate-100"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">Deepgram (for voice transcription)</label>
                <input
                  type="password"
                  value={settings.deepgramKey}
                  onChange={(e) => saveSettings({ ...settings, deepgramKey: e.target.value })}
                  placeholder="..."
                  className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 dark:text-slate-100"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">Groq (for voice transcription)</label>
                <input
                  type="password"
                  value={settings.groqKey}
                  onChange={(e) => saveSettings({ ...settings, groqKey: e.target.value })}
                  placeholder="gsk_..."
                  className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 dark:text-slate-100"
                />
              </div>
            </div>
          </div>

          {/* Synthesis Model */}
          <div>
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-2">Synthesis Model</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">Which model combines all responses into a final answer.</p>
            <div className="grid grid-cols-2 gap-2">
              {ORCHESTRATOR_OPTIONS.map(orch => (
                <button
                  key={orch.id}
                  onClick={() => saveSettings({ ...settings, orchestrator: orch.id })}
                  className={`text-left p-2 rounded-lg text-sm transition-colors
                    ${settings.orchestrator === orch.id 
                      ? 'bg-blue-100 dark:bg-blue-900/30 border-2 border-blue-400' 
                      : 'bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 hover:border-slate-300'}`}
                >
                  <div className="font-medium text-slate-700 dark:text-slate-200">{orch.name}</div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">{orch.description}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Transcription Service */}
          <div>
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-2">Voice Transcription</h3>
            <div className="flex gap-2 flex-wrap">
              {TRANSCRIPTION_SERVICES.map(svc => (
                <button
                  key={svc.id}
                  onClick={() => saveSettings({ ...settings, transcriptionService: svc.id })}
                  className={`px-3 py-1.5 rounded-full text-sm transition-colors
                    ${settings.transcriptionService === svc.id 
                      ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300' 
                      : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200'}`}
                >
                  {svc.name}
                </button>
              ))}
            </div>
          </div>

          {/* Model Visibility */}
          <div>
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-2">Available Models</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">Uncheck models to hide them from selection.</p>
            <div className="grid grid-cols-2 gap-1.5 max-h-48 overflow-y-auto">
              {MODEL_OPTIONS.map(model => (
                <label key={model.id} className="flex items-center gap-2 p-1.5 rounded text-sm cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700">
                  <input
                    type="checkbox"
                    checked={!settings.hiddenModels.includes(model.id)}
                    onChange={(e) => {
                      const hidden = e.target.checked
                        ? settings.hiddenModels.filter(id => id !== model.id)
                        : [...settings.hiddenModels, model.id]
                      saveSettings({ ...settings, hiddenModels: hidden })
                    }}
                    className="rounded text-blue-600 w-3.5 h-3.5"
                  />
                  <span className="text-slate-600 dark:text-slate-300 truncate">{model.name}</span>
                </label>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )

  // Help Modal
  const HelpModal = () => (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowHelp(false)}>
      <div className="bg-white dark:bg-slate-800 rounded-xl max-w-lg w-full max-h-[90vh] overflow-y-auto shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="sticky top-0 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-6 py-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100">📖 How to Use</h2>
          <button onClick={() => setShowHelp(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xl">×</button>
        </div>
        
        <div className="p-6 space-y-4 text-sm text-slate-600 dark:text-slate-300">
          <section>
            <h3 className="font-semibold text-slate-800 dark:text-slate-100 mb-2">🔬 What is Research Agent?</h3>
            <p>A multi-model AI research tool that queries multiple AI models simultaneously, then synthesizes their responses into a single comprehensive answer. All models have web search enabled.</p>
          </section>
          
          <section>
            <h3 className="font-semibold text-slate-800 dark:text-slate-100 mb-2">⚡ Quick Mode vs Deep Mode</h3>
            <p><strong>Quick</strong> uses 3 fast, economical models (~20 sec). <strong>Deep</strong> uses 5 flagship models for thorough research (~60 sec).</p>
          </section>
          
          <section>
            <h3 className="font-semibold text-slate-800 dark:text-slate-100 mb-2">🎯 Custom Model Selection</h3>
            <p>Click "Models" to choose which models to query (max 5). Different models have different strengths - mix flagship reasoning models with fast search-focused ones.</p>
          </section>
          
          <section>
            <h3 className="font-semibold text-slate-800 dark:text-slate-100 mb-2">📷 Images & 🎤 Voice</h3>
            <p>Add up to 4 images for visual context (product photos, charts, screenshots). Use voice to speak your query instead of typing.</p>
          </section>
          
          <section>
            <h3 className="font-semibold text-slate-800 dark:text-slate-100 mb-2">💬 Follow-up Questions</h3>
            <p>After getting results, ask follow-up questions. Context from previous rounds is automatically included.</p>
          </section>
          
          <section>
            <h3 className="font-semibold text-slate-800 dark:text-slate-100 mb-2">💾 Download</h3>
            <p>Download all research as a ZIP file with markdown files - perfect for saving to Obsidian or other note apps.</p>
          </section>
          
          <section>
            <h3 className="font-semibold text-slate-800 dark:text-slate-100 mb-2">⚙️ Settings</h3>
            <p>Configure your own API keys (optional), choose which model synthesizes answers, select voice transcription service, or hide models you don't want to use.</p>
          </section>
        </div>
      </div>
    </div>
  )

  // Model Selector Accordion
  const ModelAccordion = () => (
    <div className="mt-2">
      <button
        type="button"
        onClick={() => setShowModelSelector(!showModelSelector)}
        className="w-full flex items-center justify-between px-3 py-2 bg-slate-100 dark:bg-slate-700 rounded-lg text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
      >
        <span className="flex items-center gap-2">
          <span>🎯</span>
          <span className="font-medium">Models</span>
          <span className="text-slate-400">({selectedModels.length}/5 selected)</span>
        </span>
        <span className="text-xs">{showModelSelector ? '▲' : '▼'}</span>
      </button>
      
      {showModelSelector && (
        <div className="mt-2 p-3 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
          {/* Group by provider */}
          {['Anthropic', 'OpenAI', 'Google', 'Perplexity', 'X.AI', 'DeepSeek', 'Alibaba', 'Moonshot', 'Meta', 'MiniMax'].map(provider => {
            const providerModels = visibleModels.filter(m => m.provider === provider)
            if (providerModels.length === 0) return null
            return (
              <div key={provider} className="mb-2 last:mb-0">
                <div className="text-xs font-semibold text-slate-400 dark:text-slate-500 mb-1">{provider}</div>
                <div className="flex flex-wrap gap-1.5">
                  {providerModels.map(model => (
                    <button
                      key={model.id}
                      type="button"
                      onClick={() => toggleModel(model.id)}
                      disabled={!selectedModels.includes(model.id) && selectedModels.length >= 5}
                      className={`px-2.5 py-1 rounded-md text-xs transition-all
                        ${selectedModels.includes(model.id)
                          ? 'bg-blue-500 text-white'
                          : 'bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-600 hover:border-blue-300 disabled:opacity-40 disabled:cursor-not-allowed'}`}
                    >
                      <span>{model.name}</span>
                      {model.cost > 0 && <span className="ml-1 opacity-60">{'$'.repeat(Math.min(model.cost, 4))}</span>}
                    </button>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )

  // ============ Render ============
  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
      <div className="max-w-2xl mx-auto px-4 py-6 sm:py-10">
        
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-800 dark:text-slate-100">🔬 Research Agent</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">Multi-model AI with web search</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setShowHelp(true)} className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700">
              <span className="text-lg">?</span>
            </button>
            <button onClick={() => setShowSettings(true)} className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700">
              <span className="text-lg">⚙️</span>
            </button>
          </div>
        </div>

        {/* Modals */}
        {showSettings && <SettingsModal />}
        {showHelp && <HelpModal />}

        {/* Error Banner */}
        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4 mb-4">
            <p className="text-red-700 dark:text-red-300 text-sm">❌ {error}</p>
            <button onClick={() => setError(null)} className="text-xs text-red-500 mt-1 hover:underline">Dismiss</button>
          </div>
        )}

        {/* Input Stage */}
        {stage === 'input' && (
          <form onSubmit={handleSubmit}>
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
              <textarea
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="What would you like to research?"
                className="w-full p-4 text-base resize-y border-0 focus:ring-0 focus:outline-none placeholder:text-slate-400 dark:placeholder:text-slate-500 min-h-[120px] bg-transparent dark:text-slate-100"
                disabled={isLoading}
              />

              {/* Image Previews */}
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

              {/* Toolbar */}
              <div className="border-t border-slate-100 dark:border-slate-700 p-3 bg-slate-50 dark:bg-slate-900 space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Pill 
                      icon="📷" 
                      label={images.length > 0 ? `${images.length}/4` : 'Image'} 
                      active={images.length > 0}
                      onClick={() => fileInputRef.current?.click()} 
                    />
                    <input ref={fileInputRef} type="file" accept="image/*" multiple
                      onChange={(e) => handleImageChange(e.target.files)} className="hidden" />
                    
                    <Pill 
                      icon="🎤" 
                      label={isRecording ? 'Stop' : 'Voice'} 
                      recording={isRecording}
                      onClick={isRecording ? stopRecording : startRecording} 
                    />
                    
                    <Pill 
                      icon="⚡" 
                      label="Deep" 
                      active={isDeepMode}
                      onClick={() => setIsDeepMode(!isDeepMode)} 
                    />
                  </div>
                  
                  <button
                    type="submit"
                    disabled={isLoading || !query.trim()}
                    className="px-5 py-2 bg-blue-600 dark:bg-blue-500 text-white rounded-lg font-medium hover:bg-blue-700 dark:hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed text-sm whitespace-nowrap"
                  >
                    {isLoading ? '⏳ Working...' : 'Research'}
                  </button>
                </div>

                <ModelAccordion />
              </div>
            </div>
          </form>
        )}

        {/* Clarifying Questions */}
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
                      placeholder="Optional" 
                      className="w-full px-3 py-2 border border-slate-200 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-900 dark:text-slate-100" />
                  </div>
                ))}
              </div>
              <div className="border-t border-slate-100 dark:border-slate-700 p-3 bg-slate-50 dark:bg-slate-900 flex justify-between">
                <button type="button" onClick={() => runFullResearch(originalQuery)} 
                  className="text-sm text-slate-500 dark:text-slate-400 hover:text-slate-700">Skip →</button>
                <button type="submit" disabled={isLoading} 
                  className="px-5 py-2 bg-blue-600 dark:bg-blue-500 text-white rounded-lg text-sm font-medium disabled:opacity-50">
                  {isLoading ? '⏳' : 'Research'}
                </button>
              </div>
            </div>
          </form>
        )}

        {/* Research Loading */}
        {stage === 'research' && isLoading && (
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-8 text-center">
            <div className="animate-pulse">
              <div className="text-4xl mb-3">🔬</div>
              <p className="text-slate-600 dark:text-slate-300">Querying {selectedModels.length} models...</p>
              <p className="text-sm text-slate-400 dark:text-slate-500 mt-1">{isDeepMode ? '~60 sec' : '~20 sec'}</p>
            </div>
          </div>
        )}

        {/* Results */}
        {stage === 'results' && conversationHistory.length > 0 && (
          <div className="space-y-4">
            {/* Cost Banner */}
            {cumulativeCost > 0 && (
              <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg px-4 py-2 text-sm">
                <span className="font-medium text-green-700 dark:text-green-300">Session Cost: </span>
                <span className="text-green-600 dark:text-green-400">${cumulativeCost.toFixed(4)}</span>
              </div>
            )}

            {/* Conversation Thread */}
            {conversationHistory.map((result, roundIdx) => (
              <div key={roundIdx} className="space-y-3">
                {/* Round Header */}
                <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                  <span className="font-medium">{roundIdx === 0 ? '🔍 Query' : `💬 Follow-up ${roundIdx}`}</span>
                  {result.timestamp && <span>• {new Date(result.timestamp).toLocaleTimeString()}</span>}
                  {result.orchestrator && <span>• {result.orchestrator}</span>}
                </div>

                {/* Query */}
                <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg px-4 py-2 text-sm text-blue-800 dark:text-blue-200">
                  {result.query.length > 200 ? result.query.slice(0, 200) + '...' : result.query}
                </div>

                {/* Synthesis */}
                <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold text-slate-800 dark:text-slate-100">✨ Synthesis</h3>
                    {result.totalCost && <span className="text-xs text-green-600 dark:text-green-400">${result.totalCost.toFixed(4)}</span>}
                  </div>
                  <div className="prose prose-sm dark:prose-invert max-w-none">
                    {result.synthesis.split('\n').map((para, i) => <p key={i}>{para}</p>)}
                  </div>
                </div>

                {/* Individual Responses Accordion */}
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
                              {response.durationMs && <span className="text-xs text-slate-400">{(response.durationMs / 1000).toFixed(1)}s</span>}
                              {response.cost !== undefined && response.cost > 0 && <span className="text-xs text-green-600">${response.cost.toFixed(4)}</span>}
                            </div>
                            {response.usage && <span className="text-xs text-slate-400">{response.usage.totalTokens.toLocaleString()} tokens</span>}
                          </div>
                          {response.success ? (
                            <div className="text-sm text-slate-600 dark:text-slate-300 prose prose-sm dark:prose-invert max-w-none">
                              {response.content.split('\n').map((para, j) => <p key={j}>{para}</p>)}
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
                  placeholder="Ask a follow-up question..."
                  className="w-full p-4 text-base resize-y border-0 focus:ring-0 focus:outline-none placeholder:text-slate-400 dark:placeholder:text-slate-500 min-h-[100px] bg-transparent dark:text-slate-100"
                  disabled={isLoading}
                />
                <div className="border-t border-slate-100 dark:border-slate-700 p-3 bg-slate-50 dark:bg-slate-900 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <button type="button" onClick={downloadZip} className="text-sm text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200">
                      💾 Download
                    </button>
                    <button type="button" onClick={startNew} className="text-sm text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200">
                      ← New Research
                    </button>
                  </div>
                  <button type="submit" disabled={isLoading || !followUpQuery.trim()}
                    className="px-5 py-2 bg-blue-600 dark:bg-blue-500 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 text-sm">
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
