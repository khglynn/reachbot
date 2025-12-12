/**
 * AccountSection Component
 *
 * Account info and data controls for the settings page.
 * Shows email, sign out, export data, and delete data options.
 *
 * @module components/settings/AccountSection
 */

'use client'

import { useState } from 'react'
import { useClerk, UserButton } from '@clerk/nextjs'
import { ChalkDownload } from '@/components/ChalkIcons'
import type { UserSettings } from '@/types'

interface AccountSectionProps {
  /** User settings from API (null while loading) */
  settings: UserSettings | null
  /** Whether user is in BYOK mode */
  isByok: boolean
  /** Callback to export session data */
  onExport?: () => void
  /** Whether settings are still loading */
  isLoading?: boolean
}

/**
 * Account info and data management section.
 */
export function AccountSection({
  settings,
  isByok,
  onExport,
  isLoading,
}: AccountSectionProps) {
  const { signOut } = useClerk()
  const [isSigningOut, setIsSigningOut] = useState(false)

  const handleSignOut = async () => {
    setIsSigningOut(true)
    try {
      await signOut({ redirectUrl: '/' })
    } catch (error) {
      console.error('Sign out error:', error)
      setIsSigningOut(false)
    }
  }

  // Format date nicely
  const formatDate = (isoString: string) => {
    const date = new Date(isoString)
    return date.toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    })
  }

  // Loading state - show skeleton
  if (isLoading || !settings) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="space-y-2">
          <div className="flex items-center justify-between py-2">
            <div className="w-12 h-4 bg-paper-surface rounded" />
            <div className="w-32 h-4 bg-paper-surface rounded" />
          </div>
          <div className="flex items-center justify-between py-2 border-t border-paper-divider">
            <div className="w-24 h-4 bg-paper-surface rounded" />
            <div className="w-28 h-4 bg-paper-surface rounded" />
          </div>
        </div>
        <div className="pt-2 space-y-3">
          <div className="w-full h-10 bg-paper-surface rounded-lg" />
          <div className="w-full h-10 bg-paper-surface rounded-lg" />
          <div className="w-full h-10 bg-paper-surface rounded-lg" />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Account Info */}
      <div className="space-y-2">
        {/* Profile Access */}
        <div className="flex items-center justify-between py-2">
          <span className="text-sm text-paper-muted">Profile</span>
          <UserButton
            appearance={{
              elements: {
                avatarBox: 'w-7 h-7',
                userButtonTrigger: 'text-paper-text hover:text-paper-accent transition-colors',
              },
            }}
            afterSignOutUrl="/"
          />
        </div>
        <div className="flex items-center justify-between py-2 border-t border-paper-divider">
          <span className="text-sm text-paper-muted">Email</span>
          <span className="text-sm text-paper-text">{settings.email}</span>
        </div>
        <div className="flex items-center justify-between py-2 border-t border-paper-divider">
          <span className="text-sm text-paper-muted">Member since</span>
          <span className="text-sm text-paper-text">
            {formatDate(settings.createdAt)}
          </span>
        </div>
        {settings.name && (
          <div className="flex items-center justify-between py-2 border-t border-paper-divider">
            <span className="text-sm text-paper-muted">Name</span>
            <span className="text-sm text-paper-text">{settings.name}</span>
          </div>
        )}
      </div>

      {/* BYOK Info */}
      {isByok && (
        <div className="bg-paper-surface/50 border border-paper-accent/30 rounded-lg p-3">
          <p className="text-sm text-paper-muted">
            <strong className="text-paper-text">Using your own API keys</strong>
            <br />
            Your queries go directly to OpenRouter. We only store minimal
            analytics data (no query text).
          </p>
        </div>
      )}

      {/* Actions */}
      <div className="pt-2 space-y-3">
        {/* Export Data */}
        <button
          onClick={onExport}
          className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm
            bg-paper-bg border border-paper-accent/30 rounded-lg
            text-paper-text hover:border-paper-accent/60 transition-colors"
        >
          <ChalkDownload size={16} />
          Export Session Data
        </button>

        {/* Delete Data - Disabled placeholder */}
        <button
          disabled
          className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm
            bg-paper-bg border border-paper-accent/20 rounded-lg
            text-paper-muted cursor-not-allowed opacity-60"
          title="Coming soon"
        >
          Delete All My Data
          <span className="text-xs bg-paper-surface px-1.5 py-0.5 rounded">
            Coming soon
          </span>
        </button>

        {/* Sign Out */}
        <button
          onClick={handleSignOut}
          disabled={isSigningOut}
          className="w-full px-4 py-2 text-sm
            bg-paper-error/10 border border-paper-error/30 rounded-lg
            text-paper-error hover:bg-paper-error/20 transition-colors
            disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSigningOut ? 'Signing out...' : 'Sign Out'}
        </button>
      </div>
    </div>
  )
}
