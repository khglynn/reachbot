/**
 * HelpModal Component
 *
 * Modal explaining how to use Eachie.
 * Content adapts based on BYOK mode.
 *
 * @module components/HelpModal
 */

'use client'

interface HelpModalProps {
  /** Close modal callback */
  onClose: () => void
  /** Whether in BYOK mode (shows additional instructions) */
  byokMode: boolean
}

/**
 * Help/instructions modal.
 *
 * @example
 * {showHelp && (
 *   <HelpModal onClose={() => setShowHelp(false)} byokMode={byokMode} />
 * )}
 */
export function HelpModal({ onClose, byokMode }: HelpModalProps) {
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
          <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100">
            📖 How to Use
          </h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xl"
          >
            ×
          </button>
        </div>

        <div className="p-6 space-y-4 text-sm text-slate-600 dark:text-slate-300">
          <section>
            <h3 className="font-semibold text-slate-800 dark:text-slate-100 mb-2">
              🔬 What is Eachie?
            </h3>
            <p>
              A multi-model AI research tool that queries multiple models simultaneously,
              then synthesizes their responses. All models have web search enabled for
              current information.
            </p>
          </section>

          <section>
            <h3 className="font-semibold text-slate-800 dark:text-slate-100 mb-2">
              🎯 Model Selection
            </h3>
            <p>
              Click "Models" to choose which models to query (up to 8). Mix different
              types: flagship reasoning models, fast search-focused ones, or specialized
              tools.
            </p>
          </section>

          <section>
            <h3 className="font-semibold text-slate-800 dark:text-slate-100 mb-2">
              📎 Attachments & 🎤 Voice
            </h3>
            <p className="mb-2">
              Add up to 4 files for context. Use voice to speak your query instead
              of typing.
            </p>
            <div className="bg-slate-50 dark:bg-slate-700/50 rounded-lg p-3 text-xs">
              <p className="font-medium mb-1">Supported file types:</p>
              <ul className="space-y-1 text-slate-500 dark:text-slate-400">
                <li><span className="text-slate-700 dark:text-slate-300">Images:</span> jpg, png, gif, webp</li>
                <li><span className="text-slate-700 dark:text-slate-300">Documents:</span> pdf, txt, md, csv</li>
                <li><span className="text-slate-700 dark:text-slate-300">Code:</span> js, jsx, ts, tsx, py, html, css, json, xml, yaml</li>
              </ul>
              <p className="mt-2 text-slate-400 dark:text-slate-500">Max 20MB per file</p>
            </div>
          </section>

          <section>
            <h3 className="font-semibold text-slate-800 dark:text-slate-100 mb-2">
              💬 Follow-up Questions
            </h3>
            <p>
              Ask follow-up questions after results. Context from previous rounds is
              automatically included.
            </p>
          </section>

          <section>
            <h3 className="font-semibold text-slate-800 dark:text-slate-100 mb-2">
              💾 Download
            </h3>
            <p>
              Download research as a ZIP with markdown files - perfect for Obsidian or
              other note apps.
            </p>
          </section>

          <section>
            <h3 className="font-semibold text-slate-800 dark:text-slate-100 mb-2">
              ⚙️ Settings
            </h3>
            <p>
              Configure API keys (required in BYOK mode), choose synthesis model, select
              voice service, or hide models you don't use.
            </p>
          </section>

          {/* BYOK-specific section */}
          {byokMode && (
            <section>
              <h3 className="font-semibold text-slate-800 dark:text-slate-100 mb-2">
                🔑 BYOK Mode
              </h3>
              <p>
                This URL requires you to provide your own OpenRouter API key. Get one at{' '}
                <a
                  href="https://openrouter.ai"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline"
                >
                  openrouter.ai
                </a>
                .
              </p>
            </section>
          )}
        </div>
      </div>
    </div>
  )
}
