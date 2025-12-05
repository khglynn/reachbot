/**
 * useSettings Hook
 *
 * Manages user settings with localStorage persistence.
 * Settings are loaded on mount and saved automatically on change.
 *
 * @module hooks/useSettings
 */

import { useState, useEffect, useCallback } from 'react'
import type { Settings } from '@/types'
import { DEFAULT_SETTINGS } from '@/config/models'

/** localStorage key for settings */
const STORAGE_KEY = 'eachieSettings'

/**
 * Hook for managing user settings.
 *
 * @returns Object with settings state and save function
 *
 * @example
 * const { settings, saveSettings } = useSettings()
 * saveSettings({ ...settings, orchestrator: 'openai/gpt-5.1' })
 */
export function useSettings() {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS)
  const [isLoaded, setIsLoaded] = useState(false)

  // Load settings from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) {
        const parsed = JSON.parse(saved)
        // Merge with defaults to handle new settings fields
        setSettings({ ...DEFAULT_SETTINGS, ...parsed })
      }
    } catch {
      // Ignore parse errors, use defaults
    }
    setIsLoaded(true)
  }, [])

  /**
   * Save new settings to state and localStorage.
   * Merges with existing settings, so you can pass partial updates.
   */
  const saveSettings = useCallback((newSettings: Partial<Settings>) => {
    setSettings((current) => {
      const merged = { ...current, ...newSettings }
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(merged))
      } catch {
        // localStorage might be full or disabled
        console.warn('Failed to save settings to localStorage')
      }
      return merged
    })
  }, [])

  return { settings, saveSettings, isLoaded }
}
