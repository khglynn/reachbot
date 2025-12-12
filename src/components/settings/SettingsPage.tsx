/**
 * SettingsPage Component
 *
 * Main client-side wrapper for the settings page.
 * Fetches user data from API and manages localStorage settings.
 *
 * @module components/settings/SettingsPage
 */

'use client'

import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { useSettings } from '@/hooks/useSettings'
import { SettingsSection } from './SettingsSection'
import { AccountSection } from './AccountSection'
import { PaymentSection } from './PaymentSection'
import { ResearchPreferencesSection } from './ResearchPreferencesSection'
import { ReferralsSection } from './ReferralsSection'
import {
  ChalkUser,
  ChalkDollar,
  ChalkBook,
  ChalkGift,
  ChalkArrowLeft,
} from '@/components/ChalkIcons'
import { Footer } from '@/components'
import type { UserSettings } from '@/types'

/**
 * Settings page client component.
 */
export function SettingsPage() {
  const searchParams = useSearchParams()

  // LocalStorage settings (research preferences)
  const { settings: localSettings, saveSettings, isLoaded: localLoaded } = useSettings()

  // Server settings (account, payment)
  const [serverSettings, setServerSettings] = useState<UserSettings | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showSaved, setShowSaved] = useState(false)

  // BYOK mode detection
  const isByok =
    searchParams.get('byok') === 'true' ||
    (localLoaded && Boolean(localSettings.openrouterKey))

  // Fetch server settings
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const response = await fetch('/api/user/settings')

        if (!response.ok) {
          const data = await response.json()
          if (data.code === 'SETUP_PENDING') {
            // User exists in Clerk but webhook hasn't synced yet
            setError('Setting up your account... Please refresh in a moment.')
            return
          }
          throw new Error(data.error || 'Failed to load settings')
        }

        const data = await response.json()
        setServerSettings(data)
      } catch (err) {
        console.error('Failed to fetch settings:', err)
        setError(err instanceof Error ? err.message : 'Failed to load settings')
      } finally {
        setIsLoading(false)
      }
    }

    fetchSettings()
  }, [])

  // Handle server settings changes (with optimistic update)
  const handleServerSettingsChange = (updates: Partial<UserSettings>) => {
    if (!serverSettings) return

    setServerSettings({
      ...serverSettings,
      ...updates,
    })

    // Show saved notification
    setShowSaved(true)
    setTimeout(() => setShowSaved(false), 1500)
  }

  // Handle export (placeholder - export requires session data from main page)
  const handleExport = () => {
    alert(
      'Export is available from the main research view after completing a query. ' +
        'Navigate back and click the download button to export your session.'
    )
  }

  // Only block on localStorage - API sections handle their own loading
  if (!localLoaded) {
    return (
      <div className="min-h-screen bg-paper-bg">
        <div className="max-w-2xl mx-auto px-4 py-8">
          <div className="animate-pulse space-y-6">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="chalk-frame rounded-xl bg-paper-card p-6">
                <div className="w-32 h-6 bg-paper-surface rounded mb-4" />
                <div className="w-full h-20 bg-paper-surface rounded" />
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-paper-bg">
        <div className="max-w-2xl mx-auto px-4 py-8">
          <div className="chalk-frame rounded-xl bg-paper-card p-6 text-center">
            <p className="text-paper-error mb-4">{error}</p>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 text-sm bg-paper-accent text-paper-bg rounded-lg
                hover:bg-paper-accent/90 transition-colors"
            >
              Try Again
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-paper-bg">
      <div className="max-w-2xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <a
            href="/"
            className="p-2 -ml-2 text-paper-muted hover:text-paper-text transition-colors"
            title="Back to research"
          >
            <ChalkArrowLeft size={20} />
          </a>
          <h1 className="text-2xl font-bold text-paper-text">Settings</h1>
        </div>

        {/* Sections - Research Preferences first (instant), then API sections */}
        <div className="space-y-6">
          {/* Research Preferences Section (localStorage - instant) */}
          <SettingsSection
            title="Research Preferences"
            icon={<ChalkBook size={20} />}
            description="Configure how research queries are processed"
          >
            <ResearchPreferencesSection
              settings={localSettings}
              onSave={saveSettings}
            />
          </SettingsSection>

          {/* Payment Section (API - inline loading) */}
          <SettingsSection
            title="How You Pay"
            icon={<ChalkDollar size={20} />}
            description={
              isByok
                ? 'Eachie Free — using your own API key'
                : 'Eachie Me — balance-based billing'
            }
          >
            <PaymentSection
              settings={serverSettings}
              isByok={isByok}
              onSettingsChange={handleServerSettingsChange}
              showSaved={showSaved}
              localSettings={localSettings}
              onLocalSettingsSave={saveSettings}
              isLoading={isLoading}
            />
          </SettingsSection>

          {/* Account Section (API - inline loading) */}
          <SettingsSection
            title="Account"
            icon={<ChalkUser size={20} />}
            description="Manage your account and data"
          >
            <AccountSection
              settings={serverSettings}
              isByok={isByok}
              onExport={handleExport}
              isLoading={isLoading}
            />
          </SettingsSection>

          {/* Referrals Section (static - instant) */}
          <SettingsSection
            title="Referrals"
            icon={<ChalkGift size={20} />}
            description="Invite friends and earn credits"
            badge="Coming Soon"
            badgeVariant="warning"
          >
            <ReferralsSection />
          </SettingsSection>
        </div>

        {/* Footer */}
        <Footer />
      </div>
    </div>
  )
}
