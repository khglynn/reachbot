/**
 * PaymentSection Component
 *
 * Payment and billing settings for the settings page.
 * For Eachie Me: balance, payment method, auto top-up
 * For Eachie Free (BYOK): API key inputs + upgrade CTA
 *
 * @module components/settings/PaymentSection
 */

'use client'

import { useState, useCallback, useEffect } from 'react'
import { ChalkCheck } from '@/components/ChalkIcons'
import { formatCents } from '@/lib/stripe'
import type { UserSettings, Settings } from '@/types'

interface PaymentSectionProps {
  /** User settings from API (null while loading) */
  settings: UserSettings | null
  /** Whether user is in BYOK mode */
  isByok: boolean
  /** Callback when server settings change */
  onSettingsChange: (updates: Partial<UserSettings>) => void
  /** Show saved notification */
  showSaved?: boolean
  /** Local settings from localStorage (for API keys) */
  localSettings?: Settings
  /** Callback to save local settings */
  onLocalSettingsSave?: (updates: Partial<Settings>) => void
  /** Whether settings are still loading */
  isLoading?: boolean
}

/**
 * Payment and billing section.
 */
export function PaymentSection({
  settings,
  isByok,
  onSettingsChange,
  showSaved,
  localSettings,
  onLocalSettingsSave,
  isLoading,
}: PaymentSectionProps) {
  const [isOpeningPortal, setIsOpeningPortal] = useState(false)
  const [localSaved, setLocalSaved] = useState(false)
  const [saveTimeout, setSaveTimeout] = useState<NodeJS.Timeout | null>(null)

  // Handle local settings save with notification
  const handleLocalSave = useCallback(
    (updates: Partial<Settings>) => {
      onLocalSettingsSave?.(updates)
      setLocalSaved(true)

      if (saveTimeout) {
        clearTimeout(saveTimeout)
      }

      const timeout = setTimeout(() => setLocalSaved(false), 1500)
      setSaveTimeout(timeout)
    },
    [onLocalSettingsSave, saveTimeout]
  )

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (saveTimeout) {
        clearTimeout(saveTimeout)
      }
    }
  }, [saveTimeout])

  // Open Stripe billing portal (creates customer if needed)
  const handleManagePayment = async () => {
    setIsOpeningPortal(true)
    try {
      const response = await fetch('/api/user/billing-portal', {
        method: 'POST',
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to open billing portal')
      }

      const { url } = await response.json()
      window.location.href = url
    } catch (error) {
      console.error('Billing portal error:', error)
      alert('Unable to open billing portal. Please try again.')
    } finally {
      setIsOpeningPortal(false)
    }
  }

  // Update auto top-up settings
  const handleAutoTopupChange = async (updates: {
    enabled?: boolean
    thresholdCents?: number
    amountCents?: number
  }) => {
    if (!settings) return

    onSettingsChange({
      autoTopup: {
        ...settings.autoTopup,
        ...updates,
      },
    })

    try {
      await fetch('/api/user/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ autoTopup: updates }),
      })
    } catch (error) {
      console.error('Failed to save auto top-up settings:', error)
    }
  }

  // BYOK users see API key inputs + upgrade CTA
  if (isByok && localSettings) {
    return (
      <div className="space-y-6">
        {/* Saved Notification */}
        {localSaved && (
          <div className="flex items-center gap-2 text-xs text-paper-success bg-paper-success-muted/50 px-3 py-2 rounded animate-pulse">
            <ChalkCheck size={14} /> Saved
          </div>
        )}

        {/* API Keys */}
        <div>
          <p className="text-xs text-paper-muted mb-3">
            Your API keys are stored locally in your browser. Queries go directly
            to OpenRouter — we never see your keys.
          </p>

          <div className="space-y-3">
            {/* OpenRouter Key */}
            <div>
              <label className="block text-xs font-medium text-paper-text/80 mb-1">
                OpenRouter API Key <span className="text-paper-error">*</span>
              </label>
              <input
                type="password"
                value={localSettings.openrouterKey}
                onChange={(e) => handleLocalSave({ openrouterKey: e.target.value })}
                placeholder="sk-or-..."
                className="w-full px-3 py-2 text-sm border border-paper-accent/30 rounded-lg
                  bg-paper-bg text-paper-text placeholder:text-paper-muted"
              />
            </div>

            {/* OpenAI Key (optional, for talk to type) */}
            <div>
              <label className="block text-xs font-medium text-paper-text/80 mb-1">
                OpenAI Key <span className="text-paper-muted">(optional, for talk to type)</span>
              </label>
              <input
                type="password"
                value={localSettings.openaiKey}
                onChange={(e) => handleLocalSave({ openaiKey: e.target.value })}
                placeholder="sk-..."
                className="w-full px-3 py-2 text-sm border border-paper-accent/30 rounded-lg
                  bg-paper-bg text-paper-text placeholder:text-paper-muted"
              />
            </div>
          </div>
        </div>

        {/* Cost Estimation Disclosure */}
        <p className="text-xs text-paper-muted mt-4">
          Costs marked with ~ are estimates when exact data isn't available from model providers.
        </p>

        {/* Upgrade CTA */}
        <div className="pt-4 border-t border-paper-divider">
          <h4 className="text-sm font-medium text-paper-text mb-2">
            Switch to Eachie Me
          </h4>
          <p className="text-sm text-paper-muted mb-3">
            Balance-based billing with 1.5% markup. Get session sync across devices,
            chat history, and no need to manage API keys.
          </p>
          <a
            href="/sign-up"
            className="inline-block px-4 py-2 text-sm bg-paper-accent text-paper-bg rounded-lg
              hover:bg-paper-accent/90 transition-colors"
          >
            Get Started
          </a>
        </div>
      </div>
    )
  }

  // Loading state for Eachie Me users (non-BYOK)
  if (isLoading || !settings) {
    return (
      <div className="space-y-4 animate-pulse">
        {/* Balance skeleton */}
        <div className="flex items-center justify-between py-3 border-b border-paper-divider">
          <div>
            <div className="w-14 h-4 bg-paper-surface rounded mb-2" />
            <div className="w-20 h-8 bg-paper-surface rounded" />
          </div>
          <div className="text-right">
            <div className="w-16 h-3 bg-paper-surface rounded mb-2" />
            <div className="w-14 h-4 bg-paper-surface rounded" />
          </div>
        </div>
        {/* Payment method skeleton */}
        <div className="py-3 border-b border-paper-divider">
          <div className="flex items-center justify-between mb-2">
            <div className="w-28 h-4 bg-paper-surface rounded" />
            <div className="w-20 h-4 bg-paper-surface rounded" />
          </div>
        </div>
        {/* Auto top-up skeleton */}
        <div className="py-3">
          <div className="flex items-center justify-between">
            <div className="w-24 h-4 bg-paper-surface rounded" />
            <div className="w-12 h-6 bg-paper-surface rounded-full" />
          </div>
        </div>
      </div>
    )
  }

  // Eachie Me users see balance + billing
  return (
    <div className="space-y-4">
      {/* Balance */}
      <div className="flex items-center justify-between py-3 border-b border-paper-divider">
        <div>
          <span className="text-sm text-paper-muted">Balance</span>
          <p className="text-2xl font-semibold text-paper-text">
            {formatCents(settings.creditsCents)}
          </p>
        </div>
        <div className="text-right">
          <span className="text-xs text-paper-muted">Total spent</span>
          <p className="text-sm text-paper-muted">
            {formatCents(settings.totalSpentCents)}
          </p>
        </div>
      </div>

      {/* Payment Method */}
      <div className="py-3 border-b border-paper-divider">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-paper-muted">Payment method</span>
          <span className="text-sm text-paper-text">
            {settings.hasPaymentMethod ? (
              <span className="flex items-center gap-1 text-paper-success">
                <ChalkCheck size={14} /> Card on file
              </span>
            ) : (
              <span className="text-paper-muted">Not set up</span>
            )}
          </span>
        </div>
        {settings.hasStripeCustomer ? (
          <button
            onClick={handleManagePayment}
            disabled={isOpeningPortal}
            className="text-sm text-paper-accent hover:underline disabled:opacity-50"
          >
            {isOpeningPortal ? 'Opening...' : 'Manage payment method'}
          </button>
        ) : (
          <button
            onClick={handleManagePayment}
            disabled={isOpeningPortal}
            className="text-sm text-paper-accent hover:underline disabled:opacity-50"
          >
            {isOpeningPortal ? 'Opening...' : 'Add payment method'}
          </button>
        )}
      </div>

      {/* Auto Top-Up */}
      <div className="py-3">
        <div className="flex items-center justify-between mb-3">
          <div>
            <span className="text-sm font-medium text-paper-text">Auto top-up</span>
            {showSaved && (
              <span className="ml-2 text-xs text-paper-success bg-paper-success-muted/50 px-2 py-0.5 rounded animate-pulse inline-flex items-center gap-1">
                <ChalkCheck size={12} /> Saved
              </span>
            )}
            <p className="text-xs text-paper-muted mt-0.5">
              Automatically add credits when balance is low
            </p>
          </div>
          <button
            onClick={() =>
              handleAutoTopupChange({ enabled: !settings.autoTopup.enabled })
            }
            disabled={!settings.hasPaymentMethod}
            className={`relative w-12 h-6 rounded-full transition-colors ${
              settings.autoTopup.enabled && settings.hasPaymentMethod
                ? 'bg-paper-accent'
                : 'bg-paper-surface'
            } ${!settings.hasPaymentMethod ? 'opacity-50 cursor-not-allowed' : ''}`}
            title={!settings.hasPaymentMethod ? 'Add a payment method first' : ''}
          >
            <span
              className={`absolute top-1 w-4 h-4 bg-paper-text rounded-full transition-transform ${
                settings.autoTopup.enabled && settings.hasPaymentMethod ? 'left-7' : 'left-1'
              }`}
            />
          </button>
        </div>

        {/* Auto top-up settings (only show when enabled) */}
        {settings.autoTopup.enabled && settings.hasPaymentMethod && (
          <div className="space-y-3 pl-4 border-l-2 border-paper-accent/30 ml-2">
            {/* Threshold */}
            <div>
              <label className="block text-xs text-paper-muted mb-1">
                When balance drops below
              </label>
              <select
                value={settings.autoTopup.thresholdCents}
                onChange={(e) =>
                  handleAutoTopupChange({
                    thresholdCents: parseInt(e.target.value),
                  })
                }
                className="w-full px-3 py-2 text-sm border border-paper-accent/30 rounded-lg
                  bg-paper-bg text-paper-text"
              >
                <option value={300}>$3.00</option>
                <option value={600}>$6.00</option>
                <option value={1000}>$10.00</option>
                <option value={2000}>$20.00</option>
              </select>
            </div>

            {/* Amount */}
            <div>
              <label className="block text-xs text-paper-muted mb-1">
                Amount to add
              </label>
              <select
                value={settings.autoTopup.amountCents}
                onChange={(e) =>
                  handleAutoTopupChange({
                    amountCents: parseInt(e.target.value),
                  })
                }
                className="w-full px-3 py-2 text-sm border border-paper-accent/30 rounded-lg
                  bg-paper-bg text-paper-text"
              >
                <option value={1000}>$10.00</option>
                <option value={2000}>$20.00</option>
                <option value={2400}>$24.00 (default)</option>
                <option value={5000}>$50.00</option>
              </select>
            </div>
          </div>
        )}

        {/* Prompt to add payment method */}
        {!settings.hasPaymentMethod && (
          <p className="text-xs text-paper-muted mt-2">
            Add a payment method to enable auto top-up.
          </p>
        )}
      </div>

      {/* Cost Estimation Disclosure */}
      <p className="text-xs text-paper-muted border-t border-paper-divider pt-4">
        Costs marked with ~ are estimates when exact data isn't available from model providers.
      </p>
    </div>
  )
}
