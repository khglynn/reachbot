import { NextRequest } from 'next/server'
import JSZip from 'jszip'
import type { ResearchResult } from '@/types'

export const runtime = 'nodejs'

interface DownloadRequest {
  history: ResearchResult[]
}

function createSmartTitle(query: string): string {
  let cleaned = query
    .replace(/^(I need to|I want to|How do I|What are|Can you|Please|Help me|Tell me about)\s*/i, '')
    .replace(/[^a-zA-Z0-9\s]/g, ' ')
    .trim()
  
  if (cleaned.length > 50) {
    cleaned = cleaned.slice(0, 50)
    const lastSpace = cleaned.lastIndexOf(' ')
    if (lastSpace > 30) cleaned = cleaned.slice(0, lastSpace)
  }
  
  return cleaned
    .split(/\s+/)
    .filter(w => w.length > 0)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ') || 'Research'
}

function compactHistory(history: ResearchResult[]): string {
  return history.map((result, i) => {
    const short = result.synthesis.split(' ').slice(0, 400).join(' ')
    return `### Research ${i + 1}: "${result.query.slice(0, 80)}"\n\n${short}\n\n---`
  }).join('\n\n')
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    let history: ResearchResult[]
    if (body.history && Array.isArray(body.history)) {
      history = body.history
    } else if (body.query) {
      history = [body as ResearchResult]
    } else {
      throw new Error('Invalid request format')
    }
    
    if (history.length === 0) {
      throw new Error('No research results to download')
    }
    
    const zip = new JSZip()
    const now = new Date()
    const dateStr = now.toISOString().slice(0, 10)
    const timeStr = now.toTimeString().slice(0, 5).replace(':', '')
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
    const dayName = dayNames[now.getDay()]
    
    const title = createSmartTitle(history[0].query)
    const folderName = `${dateStr} ${dayName} - ${title}`
    
    // Calculate totals
    const totalDuration = history.reduce((sum, r) => sum + r.totalDurationMs, 0)
    const totalCost = history.reduce((sum, r) => sum + (r.totalCost || 0), 0)
    const allResponses = history.flatMap(r => r.responses.filter(resp => resp.success))
    const allModels = [...new Set(allResponses.map(r => r.model))]
    
    // Build combined summary
    let summaryContent = `---
tags:
  - ai-research
date: ${dateStr}
time: "${now.toTimeString().slice(0, 8)}"
queries: ${history.length}
models: [${allModels.map(m => `"${m}"`).join(', ')}]
duration: ${(totalDuration / 1000).toFixed(1)}s
cost: $${totalCost.toFixed(4)}
status: completed
---

# Research Session: ${title}

**Total Cost:** $${totalCost.toFixed(4)} | **Duration:** ${(totalDuration / 1000).toFixed(1)}s | **Rounds:** ${history.length}

`
    
    history.forEach((result, roundIdx) => {
      const roundNum = roundIdx + 1
      const isFollowUp = roundIdx > 0
      const timestamp = result.timestamp ? new Date(result.timestamp).toLocaleTimeString() : ''
      const roundCost = result.totalCost ? `$${result.totalCost.toFixed(4)}` : 'N/A'
      const orchestrator = result.orchestrator || 'Claude Sonnet 4.5'
      
      summaryContent += `## ${isFollowUp ? `Follow-up ${roundIdx}` : 'Initial Query'}: ${result.query.slice(0, 100)}
${timestamp ? `*${timestamp}* • ` : ''}**Cost:** ${roundCost} • **Synthesized by:** ${orchestrator}

### Synthesis

${result.synthesis}

### Model Responses (Round ${roundNum})

${result.responses.filter(r => r.success).map((r, i) => {
  const fileNum = String(roundNum).padStart(2, '0') + '-' + String(i + 1).padStart(2, '0')
  const modelSlug = r.model.toLowerCase().replace(/\s+/g, '-')
  const cost = r.cost ? `$${r.cost.toFixed(4)}` : ''
  const tokens = r.usage ? `${r.usage.totalTokens.toLocaleString()} tokens` : ''
  return `- [[${fileNum}-${modelSlug}|${r.model}]] ${cost ? `(${cost}` : ''}${tokens ? `, ${tokens})` : cost ? ')' : ''}`
}).join('\n')}

---

`
    })
    
    summaryContent += `*Generated ${now.toLocaleString()}*`
    
    zip.file(`${folderName}/00-summary.md`, summaryContent)
    
    // Add compact context file
    const compactContent = `---
title: Compact Context
purpose: Use this for follow-up context in new sessions
date: ${dateStr}
---

# Compact Research Context

This is a condensed version of all research rounds, useful for providing context to new queries or sessions.

${compactHistory(history)}

*Compacted: ${now.toLocaleString()}*`
    
    zip.file(`${folderName}/00-context-compact.md`, compactContent)
    
    // Individual model files with synthesis included
    history.forEach((result, roundIdx) => {
      const roundNum = roundIdx + 1
      const isFollowUp = roundIdx > 0
      const timestamp = result.timestamp || now.toISOString()
      
      result.responses.forEach((response, i) => {
        if (!response.success) return
        
        const modelSlug = response.model.toLowerCase().replace(/\s+/g, '-')
        const fileNum = String(roundNum).padStart(2, '0') + '-' + String(i + 1).padStart(2, '0')
        const filename = `${fileNum}-${modelSlug}.md`
        
        const usageInfo = response.usage 
          ? `tokens: ${response.usage.totalTokens.toLocaleString()} (${response.usage.promptTokens.toLocaleString()} in, ${response.usage.completionTokens.toLocaleString()} out)`
          : 'tokens: N/A'
        const costInfo = response.cost ? `$${response.cost.toFixed(4)}` : 'N/A'
        
        const content = `---
model: ${response.model}
round: ${roundNum}
query: "${result.query.slice(0, 100).replace(/"/g, '\\"')}"
duration: ${((response.durationMs || 0) / 1000).toFixed(1)}s
cost: ${costInfo}
${usageInfo}
timestamp: "${timestamp}"
---

# ${response.model}
## ${isFollowUp ? `Follow-up ${roundIdx}` : 'Initial Query'}: ${result.query.slice(0, 80)}

${response.content}

---

## Session Synthesis (Round ${roundNum})

${result.synthesis}`
        
        zip.file(`${folderName}/${filename}`, content)
      })
    })
    
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
