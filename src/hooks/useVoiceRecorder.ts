/**
 * useVoiceRecorder Hook
 *
 * Handles "talk to type" - browser audio recording via MediaRecorder API.
 * Records audio, then calls the transcription API to convert to text.
 *
 * @module hooks/useVoiceRecorder
 */

import { useState, useCallback, useRef } from 'react'
import type { Settings } from '@/types'

interface UseVoiceRecorderOptions {
  /** User settings containing API keys and transcription service preference */
  settings: Settings
  /** Whether app is in BYOK mode */
  byokMode: boolean
  /** Context from previous queries to improve transcription accuracy */
  previousContext?: string
  /** Callback when transcription completes successfully */
  onTranscription: (text: string) => void
  /** Callback when an error occurs */
  onError: (error: string) => void
}

/**
 * Hook for talk to type (recording and transcription).
 *
 * @example
 * const { isRecording, startRecording, stopRecording, isTranscribing } = useVoiceRecorder({
 *   settings,
 *   byokMode,
 *   onTranscription: (text) => setQuery(text),
 *   onError: (err) => setError(err),
 * })
 */
export function useVoiceRecorder({
  settings,
  byokMode,
  previousContext = '',
  onTranscription,
  onError,
}: UseVoiceRecorderOptions) {
  const [isRecording, setIsRecording] = useState(false)
  const [isTranscribing, setIsTranscribing] = useState(false)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])

  /**
   * Sends audio blob to OpenAI Whisper for transcription.
   */
  const transcribeAudio = useCallback(
    async (audioBlob: Blob) => {
      setIsTranscribing(true)
      try {
        const formData = new FormData()
        formData.append('audio', audioBlob)
        formData.append('context', previousContext)

        if (settings.openaiKey) {
          formData.append('apiKey', settings.openaiKey)
        }
        if (byokMode) {
          formData.append('byokMode', 'true')
        }

        const response = await fetch('/api/transcribe', {
          method: 'POST',
          body: formData,
        })

        if (response.ok) {
          const data = await response.json()
          onTranscription(data.text)
        } else {
          const errData = await response.json()
          throw new Error(errData.error || 'Transcription failed')
        }
      } catch (err) {
        onError(err instanceof Error ? err.message : 'Transcription failed')
      } finally {
        setIsTranscribing(false)
      }
    },
    [settings.openaiKey, byokMode, previousContext, onTranscription, onError]
  )

  /**
   * Start recording audio from the user's microphone.
   */
  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const recorder = new MediaRecorder(stream)
      chunksRef.current = []

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data)
        }
      }

      recorder.onstop = async () => {
        const audioBlob = new Blob(chunksRef.current, { type: 'audio/webm' })
        // Stop all tracks to release microphone
        stream.getTracks().forEach((track) => track.stop())
        await transcribeAudio(audioBlob)
      }

      recorder.start()
      mediaRecorderRef.current = recorder
      setIsRecording(true)
    } catch {
      onError('Microphone access denied')
    }
  }, [transcribeAudio, onError])

  /**
   * Stop recording and trigger transcription.
   */
  const stopRecording = useCallback(() => {
    const recorder = mediaRecorderRef.current
    if (recorder && recorder.state !== 'inactive') {
      recorder.stop()
      setIsRecording(false)
    }
  }, [])

  return {
    isRecording,
    isTranscribing,
    startRecording,
    stopRecording,
  }
}
