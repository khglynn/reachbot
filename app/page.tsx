'use client'

import { useState, useRef, useCallback } from 'react'

interface ModelResponse {
  model: string
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
}

export default function Home() {
  const [query, setQuery] = useState('')
  const [images, setImages] = useState<File[]>([])
  const [imagePreviews, setImagePreviews] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [result, setResult] = useState<ResearchResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [showIndividual, setShowIndividual] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleImageChange = useCallback((files: FileList | null) => {
    if (!files) return
    
    const newFiles = Array.from(files).filter(f => 
      ['image/jpeg', 'image/png', 'image/gif', 'image/webp'].includes(f.type)
    )
    
    // Limit to 4 images
    const combined = [...images, ...newFiles].slice(0, 4)
    setImages(combined)
    
    // Generate previews
    const previews = combined.map(f => URL.createObjectURL(f))
    setImagePreviews(prev => {
      prev.forEach(url => URL.revokeObjectURL(url))
      return previews
    })
  }, [images])

  const removeImage = (index: number) => {
    const newImages = images.filter((_, i) => i !== index)
    setImages(newImages)
    URL.revokeObjectURL(imagePreviews[index])
    setImagePreviews(imagePreviews.filter((_, i) => i !== index))
  }

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    handleImageChange(e.dataTransfer.files)
  }, [handleImageChange])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!query.trim()) return

    setIsLoading(true)
    setError(null)
    setResult(null)

    const formData = new FormData()
    formData.append('query', query)
    images.forEach(img => formData.append('images', img))

    try {
      const response = await fetch('/api/research', {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Research failed')
      }

      const data = await response.json()
      setResult(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setIsLoading(false)
    }
  }

  const clearForm = () => {
    setQuery('')
    setImages([])
    imagePreviews.forEach(url => URL.revokeObjectURL(url))
    setImagePreviews([])
    setResult(null)
    setError(null)
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100">
      <div className="max-w-3xl mx-auto px-4 py-8 sm:py-12">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl sm:text-4xl font-bold text-slate-800 mb-2">
            🔬 Research Agent
          </h1>
          <p className="text-slate-600">
            Query multiple AI models and get synthesized insights
          </p>
        </div>

        {/* Input Form */}
        <form onSubmit={handleSubmit} className="mb-8">
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            {/* Query Input */}
            <textarea
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="What would you like to research?"
              className="w-full p-4 text-lg resize-none border-0 focus:ring-0 focus:outline-none placeholder:text-slate-400"
              rows={3}
              disabled={isLoading}
            />

            {/* Image Upload Area */}
            <div
              onDrop={handleDrop}
              onDragOver={(e) => e.preventDefault()}
              className="border-t border-slate-100 p-4"
            >
              {imagePreviews.length > 0 ? (
                <div className="flex flex-wrap gap-2 mb-3">
                  {imagePreviews.map((preview, i) => (
                    <div key={i} className="relative group">
                      <img
                        src={preview}
                        alt={`Upload ${i + 1}`}
                        className="h-20 w-20 object-cover rounded-lg border border-slate-200"
                      />
                      <button
                        type="button"
                        onClick={() => removeImage(i)}
                        className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-5 h-5 text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              ) : null}
              
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700 transition-colors"
                  disabled={isLoading || images.length >= 4}
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  {images.length > 0 ? `${images.length}/4 images` : 'Add images'}
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/gif,image/webp"
                  multiple
                  onChange={(e) => handleImageChange(e.target.files)}
                  className="hidden"
                />
                <span className="text-xs text-slate-400">
                  Drop images or click to upload
                </span>
              </div>
            </div>

            {/* Submit Button */}
            <div className="border-t border-slate-100 p-4 bg-slate-50 flex justify-between items-center">
              <span className="text-xs text-slate-500">
                Claude Haiku • Gemini Flash • DeepSeek R1
              </span>
              <button
                type="submit"
                disabled={isLoading || !query.trim()}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
              >
                {isLoading ? (
                  <>
                    <span className="animate-spin">⏳</span>
                    Researching...
                  </>
                ) : (
                  <>Research</>
                )}
              </button>
            </div>
          </div>
        </form>

        {/* Loading State */}
        {isLoading && (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8 text-center">
            <div className="animate-pulse">
              <div className="text-4xl mb-4">🔬</div>
              <p className="text-slate-600 mb-2">Querying 3 AI models in parallel...</p>
              <p className="text-sm text-slate-400">This typically takes 15-30 seconds</p>
            </div>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-8">
            <p className="text-red-700">❌ {error}</p>
          </div>
        )}

        {/* Results */}
        {result && (
          <div className="space-y-6">
            {/* Synthesis */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="p-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
                <h2 className="font-semibold text-slate-800">✨ Synthesis</h2>
                <span className="text-xs text-slate-500">
                  {result.successCount}/{result.modelCount} models • {(result.totalDurationMs / 1000).toFixed(1)}s
                </span>
              </div>
              <div className="p-6 prose prose-slate max-w-none">
                <div dangerouslySetInnerHTML={{ __html: formatMarkdown(result.synthesis) }} />
              </div>
            </div>

            {/* Individual Responses Toggle */}
            <button
              onClick={() => setShowIndividual(!showIndividual)}
              className="w-full text-center text-sm text-slate-500 hover:text-slate-700 py-2"
            >
              {showIndividual ? '▼ Hide' : '▶ Show'} individual model responses
            </button>

            {/* Individual Model Responses */}
            {showIndividual && (
              <div className="space-y-4">
                {result.responses.map((response, i) => (
                  <div key={i} className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                    <div className="p-3 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
                      <h3 className="font-medium text-slate-700">{response.model}</h3>
                      {response.success ? (
                        <span className="text-xs text-green-600">
                          ✓ {((response.durationMs || 0) / 1000).toFixed(1)}s
                        </span>
                      ) : (
                        <span className="text-xs text-red-500">✗ Failed</span>
                      )}
                    </div>
                    <div className="p-4 text-sm text-slate-600 max-h-64 overflow-y-auto">
                      {response.success ? (
                        <div dangerouslySetInnerHTML={{ __html: formatMarkdown(response.content) }} />
                      ) : (
                        <p className="text-red-500">{response.error}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* New Research Button */}
            <div className="text-center">
              <button
                onClick={clearForm}
                className="text-blue-600 hover:text-blue-700 font-medium"
              >
                ← Start new research
              </button>
            </div>
          </div>
        )}

        {/* Footer */}
        <footer className="mt-12 text-center text-sm text-slate-400">
          <p>Also available via Slack: @ResearchBot</p>
        </footer>
      </div>
    </main>
  )
}

// Simple markdown to HTML (basic implementation)
function formatMarkdown(text: string): string {
  return text
    // Headers
    .replace(/^### (.+)$/gm, '<h3 class="text-lg font-semibold mt-4 mb-2">$1</h3>')
    .replace(/^## (.+)$/gm, '<h2 class="text-xl font-semibold mt-4 mb-2">$1</h2>')
    .replace(/^# (.+)$/gm, '<h1 class="text-2xl font-bold mt-4 mb-2">$1</h1>')
    // Bold and italic
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    // Lists
    .replace(/^- (.+)$/gm, '<li class="ml-4">$1</li>')
    .replace(/^(\d+)\. (.+)$/gm, '<li class="ml-4 list-decimal">$2</li>')
    // Paragraphs
    .replace(/\n\n/g, '</p><p class="mb-4">')
    // Line breaks
    .replace(/\n/g, '<br />')
    // Wrap in paragraph
    .replace(/^/, '<p class="mb-4">')
    .replace(/$/, '</p>')
}
