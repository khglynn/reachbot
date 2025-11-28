import { NextRequest, NextResponse } from 'next/server'
import { runResearch, ResearchImage } from '@/lib/research'

export const maxDuration = 60 // Allow up to 60s for multi-model queries

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const query = formData.get('query') as string
    
    if (!query?.trim()) {
      return NextResponse.json(
        { error: 'Query is required' },
        { status: 400 }
      )
    }

    // Process uploaded images
    const images: ResearchImage[] = []
    const files = formData.getAll('images') as File[]
    
    for (const file of files) {
      if (file.size > 0) {
        const bytes = await file.arrayBuffer()
        const base64 = Buffer.from(bytes).toString('base64')
        const mimeType = file.type as ResearchImage['mimeType']
        
        // Validate mime type
        if (!['image/jpeg', 'image/png', 'image/gif', 'image/webp'].includes(mimeType)) {
          continue // Skip unsupported formats
        }
        
        images.push({ base64, mimeType })
      }
    }

    const result = await runResearch({
      query: query.trim(),
      images: images.length > 0 ? images : undefined
    })

    return NextResponse.json(result)
  } catch (error) {
    console.error('Research error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Research failed' },
      { status: 500 }
    )
  }
}
