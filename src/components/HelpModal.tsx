/**
 * HelpModal Component
 *
 * Modal explaining how to use Eachie.
 * Content adapts based on BYOK mode.
 *
 * @module components/HelpModal
 */

'use client'

import {
  ChalkBook,
  ChalkSpider,
  ChalkTarget,
  ChalkAttach,
  ChalkMic,
  ChalkChat,
  ChalkDownload,
  ChalkSettings,
  ChalkKey,
  ChalkClose,
} from './ChalkIcons'

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
      className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-paper-card rounded-xl max-w-lg w-full max-h-[90vh] overflow-y-auto shadow-2xl chalk-frame"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 bg-paper-card border-b border-paper-divider px-6 py-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-paper-text flex items-center gap-2">
            <ChalkBook size={20} className="text-paper-accent" />
            How to Use
          </h2>
          <button
            onClick={onClose}
            className="text-paper-muted hover:text-paper-text"
          >
            <ChalkClose size={20} />
          </button>
        </div>

        <div className="p-6 space-y-4 text-sm text-paper-text/80">
          <section>
            <h3 className="font-semibold text-paper-text mb-2 flex items-center gap-2">
              <ChalkSpider size={16} className="text-paper-accent" />
              What is Eachie?
            </h3>
            <p>
              A multi-model AI research tool that queries multiple models simultaneously,
              then synthesizes their responses. All models have web search enabled for
              current information.
            </p>
          </section>

          <section>
            <h3 className="font-semibold text-paper-text mb-2 flex items-center gap-2">
              <ChalkTarget size={16} className="text-paper-accent" />
              Model Selection
            </h3>
            <p>
              Click "Models" to choose which models to query (up to 8). Mix different
              types: flagship reasoning models, fast search-focused ones, or specialized
              tools.
            </p>
          </section>

          <section>
            <h3 className="font-semibold text-paper-text mb-2 flex items-center gap-2">
              <ChalkAttach size={16} className="text-paper-accent" />
              Attachments &amp;
              <ChalkMic size={16} className="text-paper-accent" />
              Talk to type
            </h3>
            <p className="mb-2">
              Add up to 4 files for context. Use talk to type to speak your query
              instead of typing.
            </p>
            <div className="bg-paper-bg rounded-lg p-3 text-xs border border-paper-accent/20">
              <p className="font-medium mb-1 text-paper-text">Supported file types:</p>
              <ul className="space-y-1 text-paper-muted">
                <li><span className="text-paper-text/80">Images:</span> jpg, png, gif, webp</li>
                <li><span className="text-paper-text/80">Documents:</span> pdf, txt, md, csv</li>
                <li><span className="text-paper-text/80">Code:</span> js, jsx, ts, tsx, py, html, css, json, xml, yaml</li>
              </ul>
              <p className="mt-2 text-paper-muted/70">Max 20MB per file</p>
            </div>
          </section>

          <section>
            <h3 className="font-semibold text-paper-text mb-2 flex items-center gap-2">
              <ChalkChat size={16} className="text-paper-accent" />
              Follow-up Questions
            </h3>
            <p>
              Ask follow-up questions after results. Context from previous rounds is
              automatically included.
            </p>
          </section>

          <section>
            <h3 className="font-semibold text-paper-text mb-2 flex items-center gap-2">
              <ChalkDownload size={16} className="text-paper-accent" />
              Download
            </h3>
            <p>
              Download research as a ZIP with markdown files - perfect for Obsidian or
              other note apps.
            </p>
          </section>

          <section>
            <h3 className="font-semibold text-paper-text mb-2 flex items-center gap-2">
              <ChalkSettings size={16} className="text-paper-accent" />
              Settings
            </h3>
            <p>
              Configure API keys (required in BYOK mode), choose synthesis model, or
              hide models you don't use.
            </p>
          </section>

          {/* BYOK-specific section */}
          {byokMode && (
            <section>
              <h3 className="font-semibold text-paper-text mb-2 flex items-center gap-2">
                <ChalkKey size={16} className="text-paper-accent" />
                BYOK Mode
              </h3>
              <p>
                This URL requires you to provide your own OpenRouter API key. Get one at{' '}
                <a
                  href="https://openrouter.ai"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-paper-accent hover:underline"
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
