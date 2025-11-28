import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const maxDuration = 30

export async function POST(request: Request) {
  try {
    const formData = await request.formData()
    const audioBlob = formData.get('audio') as Blob
    const service = formData.get('service') as string || 'openai'
    const context = formData.get('context') as string || ''
    const userApiKey = formData.get('apiKey') as string || ''
    
    if (!audioBlob) {
      return NextResponse.json({ error: 'No audio provided' }, { status: 400 })
    }
    
    const buffer = await audioBlob.arrayBuffer()
    let transcriptionText = ''
    
    if (service === 'groq') {
      const groqKey = userApiKey || process.env.GROQ_API_KEY
      if (!groqKey) {
        return NextResponse.json({ error: 'Groq API key not configured. Add it in Settings or set GROQ_API_KEY server-side.' }, { status: 500 })
      }
      
      const groqFormData = new FormData()
      groqFormData.append('file', new Blob([buffer], { type: 'audio/webm' }), 'audio.webm')
      groqFormData.append('model', 'whisper-large-v3')
      if (context) groqFormData.append('prompt', context)
      
      const response = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${groqKey}` },
        body: groqFormData,
      })
      
      if (!response.ok) {
        const error = await response.text()
        throw new Error(`Groq API error: ${error}`)
      }
      
      const result = await response.json()
      transcriptionText = result.text
      
    } else if (service === 'openai') {
      const openaiKey = userApiKey || process.env.OPENAI_API_KEY
      if (!openaiKey) {
        return NextResponse.json({ error: 'OpenAI API key not configured. Add it in Settings or set OPENAI_API_KEY server-side.' }, { status: 500 })
      }
      
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
      transcriptionText = result.text
      
    } else if (service === 'deepgram') {
      const deepgramKey = userApiKey || process.env.DEEPGRAM_API_KEY
      if (!deepgramKey) {
        return NextResponse.json({ error: 'Deepgram API key not configured. Add it in Settings or set DEEPGRAM_API_KEY server-side.' }, { status: 500 })
      }
      
      const response = await fetch('https://api.deepgram.com/v1/listen?model=nova-2&smart_format=true', {
        method: 'POST',
        headers: {
          'Authorization': `Token ${deepgramKey}`,
          'Content-Type': 'audio/webm',
        },
        body: buffer,
      })
      
      if (!response.ok) {
        const error = await response.text()
        throw new Error(`Deepgram API error: ${error}`)
      }
      
      const result = await response.json()
      transcriptionText = result.results?.channels?.[0]?.alternatives?.[0]?.transcript || ''
    } else {
      return NextResponse.json({ error: `Unknown transcription service: ${service}` }, { status: 400 })
    }
    
    return NextResponse.json({ text: transcriptionText })
    
  } catch (error) {
    console.error('Transcription error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Transcription failed' },
      { status: 500 }
    )
  }
}
