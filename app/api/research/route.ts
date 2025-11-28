import { NextRequest, NextResponse } from 'next/server'
import { runResearch, ResearchImage } from '@/lib/research'

export const runtime = 'nodejs'
export const maxDuration = 120

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { query, images, mode, modelIds, orchestratorId, apiKey } = body

    if (!query) {
      return NextResponse.json({ error: 'Query is required' }, { status: 400 })
    }

    const result = await runResearch({
      query,
      images,
      mode: mode as 'quick' | 'deep',
      modelIds,
      orchestratorId,
      apiKey
    })

    return NextResponse.json(result)
  } catch (error) {
    console.error('Research API error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Research failed' },
      { status: 500 }
    )
  }
}
