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
import { useClerk } from '@clerk/nextjs'
import { ChalkDownload, ChalkClose } from '@/components/ChalkIcons'
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
  const { signOut, openUserProfile } = useClerk()
  const [isSigningOut, setIsSigningOut] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const handleSignOut = async () => {
    setIsSigningOut(true)
    try {
      await signOut({ redirectUrl: '/' })
    } catch (error) {
      console.error('Sign out error:', error)
      setIsSigningOut(false)
    }
  }

  const handleDeleteData = async () => {
    setIsDeleting(true)
    setDeleteError(null)

    try {
      const response = await fetch('/api/user/delete-data', {
        method: 'DELETE',
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to delete data')
      }

      // Sign out and redirect to home
      await signOut({ redirectUrl: '/' })
    } catch (error) {
      console.error('Delete data error:', error)
      setDeleteError(error instanceof Error ? error.message : 'Failed to delete data')
      setIsDeleting(false)
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
        <div className="flex items-center justify-between py-2">
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
        {/* Manage Profile - opens Clerk modal */}
        <button
          onClick={() => openUserProfile()}
          className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm
            bg-paper-bg border border-paper-accent/30 rounded-lg
            text-paper-text hover:border-paper-accent/60 transition-colors"
        >
          Manage Profile & Login
        </button>

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

        {/* Delete Data */}
        <button
          onClick={() => setShowDeleteModal(true)}
          className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm
            bg-paper-bg border border-paper-error/30 rounded-lg
            text-paper-error hover:bg-paper-error/10 transition-colors"
        >
          Delete All My Data
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

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div
          className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4"
          onClick={() => !isDeleting && setShowDeleteModal(false)}
        >
          <div
            className="bg-paper-card rounded-xl max-w-md w-full shadow-2xl chalk-frame"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-paper-divider">
              <h2 className="text-lg font-semibold text-paper-error">
                Delete All My Data?
              </h2>
              {!isDeleting && (
                <button
                  onClick={() => setShowDeleteModal(false)}
                  className="text-paper-muted hover:text-paper-text"
                >
                  <ChalkClose size={20} />
                </button>
              )}
            </div>

            {/* Content */}
            <div className="p-6 space-y-4">
              <p className="text-sm text-paper-text/80">
                This will <strong className="text-paper-error">permanently delete</strong> your:
              </p>
              <ul className="text-sm text-paper-muted space-y-1 list-disc pl-5">
                <li>Research history and saved sessions</li>
                <li>Account information</li>
                <li>Usage data linked to your devices</li>
              </ul>
              <p className="text-sm text-paper-text/80">
                Your Stripe billing history will be retained for refund purposes.
                To delete your login, use &quot;Manage Profile&quot; above.
              </p>

              {deleteError && (
                <p className="text-sm text-paper-error bg-paper-error/10 p-3 rounded-lg">
                  {deleteError}
                </p>
              )}
            </div>

            {/* Actions */}
            <div className="flex gap-3 px-6 py-4 border-t border-paper-divider">
              <button
                onClick={() => setShowDeleteModal(false)}
                disabled={isDeleting}
                className="flex-1 px-4 py-2 text-sm
                  bg-paper-bg border border-paper-accent/30 rounded-lg
                  text-paper-text hover:border-paper-accent/60 transition-colors
                  disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteData}
                disabled={isDeleting}
                className="flex-1 px-4 py-2 text-sm
                  bg-paper-error border border-paper-error rounded-lg
                  text-white hover:bg-paper-error/90 transition-colors
                  disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isDeleting ? 'Deleting...' : 'Delete Everything'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
