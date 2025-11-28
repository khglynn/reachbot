'use client'

import { useState, useRef, useCallback, useEffect } from 'react'

interface ModelOption {
  id: string
  name: string
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
}

interface ResearchResult {
  query: string
  responses: ModelResponse[]
  synthesis: string
  totalDurationMs: number
  modelCount: number
  successCount: number
  timestamp?: string
}

type Stage = 'input' | 'clarifying' | 'research' | 'results'

const MODEL_OPTIONS: ModelOption[] = [
  { id: 'anthropic/claude-sonnet-4.5:online', name: 'Claude Sonnet 4.5', category: '🏆 Flagship', cost: 3 },
  { id: 'anthropic/claude-opus-4.5:online', name: 'Claude Opus 4.5', category: '🏆 Flagship', cost: 5 },
  { id: 'openai/gpt-5.1:online', name: 'GPT-5.1', category: '🏆 Flagship', cost: 4 },
  { id: 'google/gemini-3-pro-preview:online', name: 'Gemini 3 Pro', category: '🏆 Flagship', cost: 3 },
  { id: 'anthropic/claude-haiku-4.5:online', name: 'Claude Haiku 4.5', category: '⚡ Fast', cost: 1 },
  { id: 'google/gemini-2.5-flash-preview-05-20:online', name: 'Gemini Flash', category: '⚡ Fast', cost: 1 },
  { id: 'meta-llama/llama-4-maverick:online', name: 'Llama 4 Maverick', category: '⚡ Fast', cost: 0 },
  { id: 'deepseek/deepseek-r1:online', name: 'DeepSeek R1', category: '🧠 Reasoning', cost: 1 },
  { id: 'moonshotai/kimi-k2:online', name: 'Kimi K2', category: '🧠 Reasoning', cost: 2 },
  { id: 'perplexity/sonar-deep-research', name: 'Perplexity Deep', category: '🧠 Reasoning', cost: 3 },
  { id: 'openai/gpt-5.1-codex:online', name: 'GPT-5.1 Codex', category: '🎯 Grounding', cost: 4 },
  { id: 'x-ai/grok-4:online', name: 'Grok 4', category: '🎯 Grounding', cost: 2 },
  { id: 'qwen/qwen3-max:online', name: 'Qwen3-Max', category: '🎯 Grounding', cost: 2 },
  { id: 'perplexity/sonar-pro', name: 'Perplexity Sonar', category: '🔍 Search', cost: 2 },
]

const DEFAULT_QUICK = ['anthropic/claude-haiku-4.5:online', 'google/gemini-2.5-flash-preview-05-20:online', 'deepseek/deepseek-r1:online']
const DEFAULT_DEEP = ['anthropic/claude-sonnet-4.5:online', 'openai/gpt-5.1:online', 'google/gemini-3-pro-preview:online', 'deepseek/deepseek-r1:online', 'perplexity/sonar-deep-research']

export default function Home() {
  const [query, setQuery] = useState('')
  const [images, setImages] = useState<File[]>([])
  const [imagePreviews, setImagePreviews] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showModelSelector, setShowModelSelector] = useState(false)
  const [showFollowUpModels, setShowFollowUpModels] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  
  const [selectedModels, setSelectedModels] = useState<string[]>(DEFAULT_QUICK)
  const [isDeepMode, setIsDeepMode] = useState(false)
  
  const [stage, setStage] = useState<Stage>('input')
  const [clarifyingQuestions, setClarifyingQuestions] = useState<string[]>([])
  const [answers, setAnswers] = useState<string[]>([])
  const [originalQuery, setOriginalQuery] = useState('')
  
  const [followUpQuery, setFollowUpQuery] = useState('')
  const [conversationHistory, setConversationHistory] = useState<ResearchResult[]>([])
  const [expandedRounds, setExpandedRounds] = useState<Set<number>>(new Set())

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
    } catch {}
    
    await runFullResearch(userQuery)
  }

  const runFullResearch = async (finalQuery: string, isFollowUp = false) => {
    setIsLoading(true)
    setStage('research')
    setError(null)

    let enhancedQuery = finalQuery
    if (isFollowUp && conversationHistory.length > 0) {
      const context = compactContext(conversationHistory)
      enhancedQuery = `${finalQuery}\n\n---\nContext:\n${context}`
    }

    const formData = new FormData()
    formData.append('query', enhancedQuery)
    formData.append('mode', isDeepMode ? 'deep' : 'quick')
    formData.append('modelIds', JSON.stringify(selectedModels))
    images.forEach(img => formData.append('images', img))

    try {
      const response = await fetch('/api/research', { method: 'POST', body: formData })
      if (!response.ok) throw new Error((await response.json()).error || 'Research failed')

      const data = await response.json()
      // Add timestamp to result
      const resultWithTimestamp = {
        ...data,
        query: finalQuery, // Store original query, not enhanced
        timestamp: new Date().toISOString()
      }
      setConversationHistory(prev => [...prev, resultWithTimestamp])
      setStage('results')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
      setStage('results')
    } finally {
      setIsLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!query.trim()) return
    await getClarifyingQuestions(query.trim())
    setQuery('')
  }

  const handleAnswersSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const answeredQuestions = clarifyingQuestions
      .map((q, i) => answers[i] ? `Q: ${q}\nA: ${answers[i]}` : null)
      .filter(Boolean).join('\n\n')
    
    const enhancedQuery = answeredQuestions 
      ? `${originalQuery}\n\n---\nContext:\n${answeredQuestions}`
      : originalQuery
    
    await runFullResearch(enhancedQuery)
  }

  const handleFollowUp = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!followUpQuery.trim()) return
    await runFullResearch(followUpQuery.trim(), true)
    setFollowUpQuery('')
  }

  const downloadZip = async () => {
    if (conversationHistory.length === 0) return
    const response = await fetch('/api/download', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ history: conversationHistory }),
    })
    if (response.ok) {
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `research-${new Date().toISOString().slice(0, 10)}.zip`
      a.click()
      URL.revokeObjectURL(url)
    }
  }

  const clearAll = () => {
    setQuery('')
    setImages([])
    imagePreviews.forEach(url => URL.revokeObjectURL(url))
    setImagePreviews([])
    setError(null)
    setStage('input')
    setClarifyingQuestions([])
    setAnswers([])
    setOriginalQuery('')
    setFollowUpQuery('')
    setConversationHistory([])
    setExpandedRounds(new Set())
  }

  const toggleRound = (roundIdx: number) => {
    setExpandedRounds(prev => {
      const next = new Set(prev)
      if (next.has(roundIdx)) next.delete(roundIdx)
      else next.add(roundIdx)
      return next
    })
  }

  const ModelSelector = ({ showState, setShowState }: { showState: boolean, setShowState: (v: boolean) => void }) => (
    <div>
      <button type="button" onClick={() => setShowState(!showState)}
        className="text-xs text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200">
        {showState ? '▼' : '▶'} Models ({selectedModels.length}/5)
      </button>
      
      {showState && (
        <div className="mt-2 grid grid-cols-2 sm:grid-cols-3 gap-1">
          {MODEL_OPTIONS.map(model => (
            <label key={model.id} className={`flex items-center gap-1.5 p-1.5 rounded text-xs cursor-pointer
              ${selectedModels.includes(model.id) 
                ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300' 
                : 'hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300'}`}>
              <input type="checkbox" checked={selectedModels.includes(model.id)}
                onChange={() => toggleModel(model.id)}
                disabled={!selectedModels.includes(model.id) && selectedModels.length >= 5}
                className="rounded text-blue-600 w-3 h-3" />
              <span className="truncate">{model.name}</span>
              <span className="text-slate-400 dark:text-slate-500">{'$'.repeat(model.cost) || '∅'}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  )

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
                className="w-full p-4 text-base sm:text-lg resize-none border-0 focus:ring-0 focus:outline-none placeholder:text-slate-400 dark:placeholder:text-slate-500 min-h-[120px] bg-transparent dark:text-slate-100"
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

                <ModelSelector showState={showModelSelector} setShowState={setShowModelSelector} />
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
                </div>
                
                {/* Query text */}
                <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg px-4 py-2 text-sm text-blue-800 dark:text-blue-200">
                  {result.query}
                </div>

                {/* Synthesis */}
                <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
                  <div className="p-3 bg-slate-50 dark:bg-slate-900 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center">
                    <h2 className="font-semibold text-slate-800 dark:text-slate-100 text-sm sm:text-base">✨ Synthesis</h2>
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                      {result.successCount}/{result.modelCount} • {(result.totalDurationMs / 1000).toFixed(0)}s
                    </span>
                  </div>
                  <div className="p-4 prose prose-sm prose-slate dark:prose-invert max-w-none">
                    <div dangerouslySetInnerHTML={{ __html: formatMarkdown(result.synthesis) }} />
                  </div>
                </div>

                {/* Individual responses toggle */}
                <button onClick={() => toggleRound(roundIdx)}
                  className="w-full text-center text-xs text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 py-1">
                  {expandedRounds.has(roundIdx) ? '▼ Hide' : '▶ Show'} individual responses
                </button>

                {expandedRounds.has(roundIdx) && (
                  <div className="space-y-2">
                    {result.responses.map((r, i) => (
                      <div key={i} className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
                        <div className="p-2 bg-slate-50 dark:bg-slate-900 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center">
                          <span className="font-medium text-slate-700 dark:text-slate-200 text-sm">{r.model}</span>
                          <span className={`text-xs ${r.success ? 'text-green-600 dark:text-green-400' : 'text-red-500 dark:text-red-400'}`}>
                            {r.success ? `✓ ${((r.durationMs || 0) / 1000).toFixed(1)}s` : '✗'}
                          </span>
                        </div>
                        <div className="p-3 text-sm text-slate-600 dark:text-slate-300 max-h-48 overflow-y-auto prose prose-sm dark:prose-invert">
                          {r.success ? (
                            <div dangerouslySetInnerHTML={{ __html: formatMarkdown(r.content) }} />
                          ) : <p className="text-red-500 dark:text-red-400">{r.error}</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}

            {/* Follow-up Form */}
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
              <form onSubmit={handleFollowUp} className="p-3 space-y-3">
                <textarea 
                  value={followUpQuery} 
                  onChange={(e) => setFollowUpQuery(e.target.value)}
                  placeholder="Ask a follow-up question..."
                  className="w-full px-3 py-2 border border-slate-200 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-900 dark:text-slate-100 min-h-[120px] resize-y" 
                  disabled={isLoading} 
                />
                <ModelSelector showState={showFollowUpModels} setShowState={setShowFollowUpModels} />
                <div className="flex justify-between items-center">
                  <span className="text-xs text-slate-400 dark:text-slate-500">Context from previous research included</span>
                  <button type="submit" disabled={isLoading || !followUpQuery.trim()}
                    className="px-4 py-1.5 bg-blue-600 dark:bg-blue-500 text-white rounded-lg text-sm font-medium disabled:opacity-50">
                    {isLoading ? '⏳' : 'Research'}
                  </button>
                </div>
              </form>
            </div>

            {/* Actions */}
            <div className="flex justify-center gap-4">
              <button onClick={downloadZip} className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 text-sm">
                📥 Download All ({conversationHistory.length} rounds)
              </button>
              <button onClick={clearAll} className="text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 text-sm">
                ← New research
              </button>
            </div>
          </div>
        )}
      </div>
    </main>
  )
}

function formatMarkdown(text: string): string {
  return text
    .replace(/^### (.+)$/gm, '<h3 class="text-base font-semibold mt-3 mb-1">$1</h3>')
    .replace(/^## (.+)$/gm, '<h2 class="text-lg font-semibold mt-3 mb-1">$1</h2>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/^- (.+)$/gm, '<li class="ml-4">$1</li>')
    .replace(/\n\n/g, '</p><p class="mb-2">')
    .replace(/\n/g, '<br />')
    .replace(/^/, '<p class="mb-2">')
    .replace(/$/, '</p>')
}
