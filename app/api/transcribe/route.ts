import { NextResponse } from 'next/server'
import * as Sentry from '@sentry/nextjs'

export const runtime = 'nodejs'
export const maxDuration = 30

/**
 * Talk to type transcription endpoint using OpenAI Whisper.
 */
export async function POST(request: Request) {
  try {
    const formData = await request.formData()
    const audioBlob = formData.get('audio') as Blob
    const context = formData.get('context') as string || ''
    const userApiKey = formData.get('apiKey') as string || ''
    const byokMode = formData.get('byokMode') === 'true'
    const forceBYOK = process.env.FORCE_BYOK === 'true'

    if (!audioBlob) {
      return NextResponse.json({ error: 'No audio provided' }, { status: 400 })
    }

    const openaiKey = userApiKey || (byokMode || forceBYOK ? undefined : process.env.OPENAI_API_KEY)
    if (!openaiKey) {
      return NextResponse.json(
        { error: 'OpenAI API key required for voice. Please add it in Settings.' },
        { status: 500 }
      )
    }

    const buffer = await audioBlob.arrayBuffer()

    const openaiFormData = new FormData()
    openaiFormData.append('file', new Blob([buffer], { type: 'audio/webm' }), 'audio.webm')
    openaiFormData.append('model', 'whisper-1')
    if (context) openaiFormData.append('prompt', context)

    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${openaiKey}` },
      body: openaiFormData,
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`OpenAI API error: ${error}`)
    }

    const result = await response.json()
    return NextResponse.json({ text: result.text })

  } catch (error) {
    console.error('Transcription error:', error)

    // Report to Sentry with context
    Sentry.captureException(error, {
      tags: { feature: 'talk-to-type' },
      extra: { endpoint: 'transcribe' },
    })

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Transcription failed' },
      { status: 500 }
    )
  }
}
