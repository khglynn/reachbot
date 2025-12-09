/**
 * Pill Component
 *
 * A rounded button used for toolbar actions like Image and Voice.
 * Changes appearance based on active/recording state.
 *
 * @module components/Pill
 */

'use client'

interface PillProps {
  /** Icon to display (emoji, text, or React component) */
  icon: React.ReactNode
  /** Button label */
  label: string
  /** Click handler */
  onClick: () => void
  /** Whether the pill is in active state (e.g., images attached) */
  active?: boolean
  /** Whether currently recording (shows red pulsing state) */
  recording?: boolean
  /** Whether the button is disabled */
  disabled?: boolean
}

/**
 * Pill button for toolbar actions.
 *
 * @example
 * <Pill
 *   icon="📷"
 *   label={images.length > 0 ? `${images.length}/4` : 'Image'}
 *   active={images.length > 0}
 *   onClick={() => fileInputRef.current?.click()}
 * />
 */
export function Pill({ icon, label, onClick, active, recording, disabled }: PillProps) {
  // Determine style based on state
  let className =
    'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-all'

  if (recording) {
    // Recording state: red pulsing
    className += ' bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 animate-pulse'
  } else if (active) {
    // Active state: blue highlight
    className += ' bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
  } else {
    // Default state: neutral with hover
    className +=
      ' bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
  }

  if (disabled) {
    className += ' opacity-50 cursor-not-allowed'
  }

  return (
    <button type="button" onClick={onClick} disabled={disabled} className={className}>
      <span>{icon}</span>
      <span>{label}</span>
    </button>
  )
}
