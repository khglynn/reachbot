import { NextRequest } from 'next/server'
import JSZip from 'jszip'

export const runtime = 'nodejs'

interface ModelResponse {
  model: string
  modelId: string
  content: string
  success: boolean
  durationMs?: number
}

interface ResearchResult {
  query: string
  responses: ModelResponse[]
  synthesis: string
  totalDurationMs: number
  modelCount: number
  successCount: number
}

// Create a better title from query
function createTitle(query: string): string {
  // Remove special chars, take first 50 chars
  const cleaned = query
    .replace(/[^a-zA-Z0-9\s]/g, '')
    .trim()
    .slice(0, 50)
    .trim()
  
  // Capitalize each word
  const capitalized = cleaned
    .split(/\s+/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ')
  
  return capitalized || 'Research'
}

export async function POST(request: NextRequest) {
  try {
    const result: ResearchResult = await request.json()
    
    const zip = new JSZip()
    const now = new Date()
    const dateStr = now.toISOString().slice(0, 10)
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
    const dayName = dayNames[now.getDay()]
    
    const title = createTitle(result.query)
    const folderName = `${dateStr} ${dayName} - ${title}`
    
    // Summary with frontmatter
    const summaryContent = `---
tags:
  - ai-research
date: ${dateStr}
question: "${result.query.slice(0, 200).replace(/"/g, '\\"')}"
models: [${result.responses.filter(r => r.success).map(r => `"${r.model}"`).join(', ')}]
duration: ${(result.totalDurationMs / 1000).toFixed(1)}s
status: completed
---

# Research: ${result.query.slice(0, 100)}

## Synthesis

${result.synthesis}

## Model Responses

${result.responses.filter(r => r.success).map((r, i) => `- [[${String(i + 1).padStart(2, '0')}-${r.model.toLowerCase().replace(/\s+/g, '-')}|${r.model}]]`).join('\n')}

---
*Generated ${now.toLocaleString()}*`

    zip.file(`${folderName}/00-summary.md`, summaryContent)
    
    // Individual model files
    result.responses.forEach((response, i) => {
      if (!response.success) return
      
      const modelSlug = response.model.toLowerCase().replace(/\s+/g, '-')
      const filename = `${String(i + 1).padStart(2, '0')}-${modelSlug}.md`
      
      const content = `---
model: ${response.model}
duration: ${((response.durationMs || 0) / 1000).toFixed(1)}s
date: ${dateStr}
---

# ${response.model}

${response.content}`
      
      zip.file(`${folderName}/${filename}`, content)
    })
    
    // Generate zip as arraybuffer and convert to Buffer for Next.js
    const zipArrayBuffer = await zip.generateAsync({ type: 'arraybuffer' })
    const zipBuffer = Buffer.from(zipArrayBuffer)
    
    return new Response(zipBuffer, {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${folderName}.zip"`,
      },
    })
  } catch (error) {
    console.error('Download error:', error)
    return new Response(JSON.stringify({ error: 'Failed to create download' }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}
