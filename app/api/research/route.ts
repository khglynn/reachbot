import { NextRequest, NextResponse } from 'next/server'
import { runResearch } from '@/lib/research'

export const runtime = 'nodejs'
export const maxDuration = 800 // Fluid compute allows up to 800s on Pro

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { query, attachments, modelIds, orchestratorId, apiKey, byokMode } = body

    if (!query) {
      return NextResponse.json({ error: 'Query is required' }, { status: 400 })
    }

    const result = await runResearch({
      query,
      attachments,
      modelIds,
      orchestratorId,
      apiKey,
      byokMode
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
