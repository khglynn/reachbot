/**
 * ReferralsSection Component
 *
 * Friend codes feature - share your code, both parties get $8.
 * Code format: EACHIE-WITH-ME-{initials}{emoji1}{emoji2}{emoji3}
 *
 * @module components/settings/ReferralsSection
 */

'use client'

import { useState, useEffect } from 'react'
import { ChalkCheck, ChalkCopy, ChalkLink, ChalkMail, ChalkTwitter } from '@/components/ChalkIcons'

interface ReferralData {
  code: string
  usesRemaining: number
  totalUses: number
  shareUrl: string
}

/**
 * Referrals section with code display, share options, and stats.
 */
export function ReferralsSection() {
  const [data, setData] = useState<ReferralData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState<'code' | 'url' | null>(null)
  const [showRefreshConfirm, setShowRefreshConfirm] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)

  // Fetch referral code on mount
  useEffect(() => {
    fetchReferralCode()
  }, [])

  const fetchReferralCode = async () => {
    try {
      setIsLoading(true)
      setError(null)
      const res = await fetch('/api/referral/code')

      if (!res.ok) {
        if (res.status === 202) {
          // Account setup pending
          setError('Setting up your account...')
          return
        }
        throw new Error('Failed to load referral code')
      }

      const result = await res.json()
      setData(result)
    } catch (err) {
      console.error('[ReferralsSection] Error:', err)
      setError('Failed to load your referral code')
    } finally {
      setIsLoading(false)
    }
  }

  const handleCopy = async (type: 'code' | 'url') => {
    if (!data) return

    const text = type === 'code' ? data.code : data.shareUrl
    try {
      await navigator.clipboard.writeText(text)
      setCopied(type)
      setTimeout(() => setCopied(null), 2000)
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }

  const handleRefresh = async () => {
    if (!showRefreshConfirm) {
      setShowRefreshConfirm(true)
      return
    }

    setIsRefreshing(true)
    try {
      const res = await fetch('/api/referral/code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ regenerate: true }),
      })

      if (!res.ok) {
        throw new Error('Failed to refresh code')
      }

      const result = await res.json()
      setData(result)
      setShowRefreshConfirm(false)
    } catch (err) {
      console.error('[ReferralsSection] Refresh error:', err)
      setError('Failed to refresh code')
    } finally {
      setIsRefreshing(false)
    }
  }

  const handleShareTwitter = () => {
    if (!data) return
    const text = encodeURIComponent(
      `Try Eachie - research with multiple AI models at once! Use my friend code and we both get $8:\n${data.shareUrl}`
    )
    window.open(`https://twitter.com/intent/tweet?text=${text}`, '_blank')
  }

  const handleShareEmail = () => {
    if (!data) return
    const subject = encodeURIComponent("You'll love Eachie - we both get $8!")
    const body = encodeURIComponent(
      `Hey!\n\nI've been using Eachie to research with multiple AI models at once. It's really cool for getting different perspectives on questions.\n\nUse my friend code and we'll both get $8 in credits:\n${data.shareUrl}\n\nEnjoy!`
    )
    window.open(`mailto:?subject=${subject}&body=${body}`, '_blank')
  }

  // Loading state
  if (isLoading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="bg-paper-surface/50 border border-paper-accent/30 rounded-lg p-4">
          <div className="h-8 bg-paper-surface rounded w-3/4 mb-2" />
          <div className="h-4 bg-paper-surface rounded w-1/2" />
        </div>
      </div>
    )
  }

  // Error state
  if (error) {
    return (
      <div className="bg-paper-error/10 border border-paper-error/30 rounded-lg p-4">
        <p className="text-sm text-paper-error">{error}</p>
        <button
          onClick={fetchReferralCode}
          className="mt-2 text-sm text-paper-accent hover:underline"
        >
          Try again
        </button>
      </div>
    )
  }

  if (!data) return null

  const allUsesGone = data.usesRemaining <= 0

  return (
    <div className="space-y-4">
      {/* Code Display */}
      <div className="bg-paper-surface/50 border border-paper-accent/30 rounded-lg p-4">
        <div className="flex items-center justify-between gap-2 mb-3">
          <span className="text-sm text-paper-muted">Your code</span>
          {/* Refresh Button */}
          <button
            onClick={() => setShowRefreshConfirm(true)}
            disabled={isRefreshing}
            className="text-xs text-paper-muted hover:text-paper-text transition-colors"
          >
            {isRefreshing ? 'Shuffling...' : 'Shuffle the sigils'}
          </button>
        </div>

        {/* Code with Copy */}
        <button
          onClick={() => handleCopy('code')}
          className="w-full text-left group"
        >
          <div className="flex items-center justify-between bg-paper-bg/50 rounded-lg px-4 py-3 border border-paper-divider hover:border-paper-accent/50 transition-colors">
            <span className="text-lg font-mono text-paper-text break-all">
              {data.code}
            </span>
            <span className="ml-2 flex-shrink-0">
              {copied === 'code' ? (
                <ChalkCheck size={18} className="text-paper-success" />
              ) : (
                <ChalkCopy size={18} className="text-paper-muted group-hover:text-paper-text" />
              )}
            </span>
          </div>
        </button>

        {/* Stats */}
        <div className="mt-3 flex items-center justify-between text-sm">
          <span className="text-paper-muted">
            {allUsesGone ? (
              <span className="text-paper-warning">All 8 invites used!</span>
            ) : (
              <>
                <span className="text-paper-text font-medium">{8 - data.usesRemaining}</span>
                {' of 8 invites used'}
              </>
            )}
          </span>
          {data.totalUses > 0 && (
            <span className="text-paper-accent">
              +${(data.totalUses * 8).toLocaleString()} earned
            </span>
          )}
        </div>
      </div>

      {/* Refresh Confirmation */}
      {showRefreshConfirm && (
        <div className="bg-paper-surface/50 border border-paper-accent/30 rounded-lg p-4">
          <p className="text-sm text-paper-text mb-3">
            <strong className="text-paper-accent">Heads up:</strong> Getting new emojis will invalidate your current code. Any links you&apos;ve already shared will stop working.
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setShowRefreshConfirm(false)}
              className="flex-1 px-3 py-2 text-sm bg-paper-bg border border-paper-accent/30 rounded-lg text-paper-text hover:border-paper-accent/60"
            >
              Cancel
            </button>
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="flex-1 px-3 py-2 text-sm bg-paper-accent text-paper-bg rounded-lg hover:bg-paper-accent/90 disabled:opacity-50"
            >
              {isRefreshing ? 'Refreshing...' : 'Get New Emojis'}
            </button>
          </div>
        </div>
      )}

      {/* Share Options */}
      <div className="space-y-2">
        <span className="text-sm text-paper-muted">Share</span>

        {/* Copy URL */}
        <button
          onClick={() => handleCopy('url')}
          className="w-full flex items-center justify-between px-4 py-3 text-sm
            bg-paper-bg border border-paper-accent/30 rounded-lg
            text-paper-text hover:border-paper-accent/60 transition-colors"
        >
          <span>Copy share link</span>
          {copied === 'url' ? (
            <ChalkCheck size={16} className="text-paper-success" />
          ) : (
            <ChalkLink size={16} className="text-paper-muted" />
          )}
        </button>

        {/* Twitter */}
        <button
          onClick={handleShareTwitter}
          className="w-full flex items-center justify-between px-4 py-3 text-sm
            bg-paper-bg border border-paper-accent/30 rounded-lg
            text-paper-text hover:border-paper-accent/60 transition-colors"
        >
          <span>Share on X</span>
          <ChalkTwitter size={16} className="text-paper-muted" />
        </button>

        {/* Email */}
        <button
          onClick={handleShareEmail}
          className="w-full flex items-center justify-between px-4 py-3 text-sm
            bg-paper-bg border border-paper-accent/30 rounded-lg
            text-paper-text hover:border-paper-accent/60 transition-colors"
        >
          <span>Share via email</span>
          <ChalkMail size={16} className="text-paper-muted" />
        </button>
      </div>

      {/* Request More (when all used) */}
      {allUsesGone && (
        <div className="bg-paper-surface/50 border border-paper-accent/30 rounded-lg p-4 text-center">
          <p className="text-sm text-paper-text mb-2">
            Want more invites?
          </p>
          <a
            href="mailto:kevin@eachie.ai?subject=Request%20more%20friend%20invites"
            className="text-sm text-paper-accent hover:underline"
          >
            Request more invites →
          </a>
        </div>
      )}

      {/* How it works */}
      <div className="bg-paper-surface/30 border border-paper-accent/20 rounded-lg p-4 text-center">
        <p className="text-sm text-paper-muted mb-2">When a friend signs up with your code</p>
        <p className="text-lg text-paper-text">
          You both get <span className="text-paper-accent font-bold">$8</span> in credits
        </p>
      </div>
    </div>
  )
}
