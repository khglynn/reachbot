import { NextRequest, NextResponse } from 'next/server'
import { slack, verifySlackRequest } from '@/lib/slack'
import { runResearch, runFollowUp, ResearchImage, ResearchResult } from '@/lib/research'
import { generateText } from 'ai'
import { createOpenRouter } from '@openrouter/ai-sdk-provider'

export const maxDuration = 120

const openrouter = createOpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY!,
})

// Store research context for follow-ups (keyed by thread_ts)
const researchContext = new Map<string, {
  results: ResearchResult[]
  expiresAt: number
}>()

function cleanupContext() {
  const now = Date.now()
  for (const [key, value] of researchContext.entries()) {
    if (value.expiresAt < now) researchContext.delete(key)
  }
}

// Compact context for follow-ups
function compactContext(results: ResearchResult[]): string {
  if (results.length === 0) return ''
  const recent = results.slice(-2)
  return recent.map((r, i) => {
    const shortSynthesis = r.synthesis.split(' ').slice(0, 400).join(' ')
    return `Research ${i + 1}: "${r.query.slice(0, 80)}"\nFindings: ${shortSynthesis}`
  }).join('\n\n---\n\n')
}

export async function POST(request: NextRequest) {
  const body = await request.text()
  const signature = request.headers.get('x-slack-signature')
  const timestamp = request.headers.get('x-slack-request-timestamp')

  if (process.env.NODE_ENV === 'production') {
    if (!verifySlackRequest(signature, timestamp, body)) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
    }
  }

  const payload = JSON.parse(body)

  if (payload.type === 'url_verification') {
    return NextResponse.json({ challenge: payload.challenge })
  }

  if (payload.type === 'event_callback') {
    const event = payload.event
    if (event.bot_id) return NextResponse.json({ ok: true })

    if (event.type === 'app_mention') {
      processAppMention(event).catch(console.error)
      return NextResponse.json({ ok: true })
    }

    if (event.type === 'message' && event.thread_ts && !event.bot_id) {
      processThreadReply(event).catch(console.error)
      return NextResponse.json({ ok: true })
    }
  }

  return NextResponse.json({ ok: true })
}

async function downloadSlackImage(file: any): Promise<ResearchImage | null> {
  try {
    const response = await fetch(file.url_private_download || file.url_private, {
      headers: { 'Authorization': `Bearer ${process.env.SLACK_BOT_TOKEN}` }
    })
    if (!response.ok) return null

    const buffer = await response.arrayBuffer()
    const base64 = Buffer.from(buffer).toString('base64')
    let mimeType: ResearchImage['mimeType'] = 'image/jpeg'
    if (file.mimetype === 'image/png') mimeType = 'image/png'
    else if (file.mimetype === 'image/gif') mimeType = 'image/gif'
    else if (file.mimetype === 'image/webp') mimeType = 'image/webp'

    return { base64, mimeType }
  } catch {
    return null
  }
}

async function getClarifyingQuestions(query: string): Promise<string[]> {
  try {
    const result = await generateText({
      model: openrouter('anthropic/claude-haiku-4.5'),
      messages: [
        {
          role: 'system',
          content: `Generate 2-3 SHORT, SPECIFIC clarifying questions for this research query. Questions under 15 words. Only ask if they would significantly improve results. Return JSON array or empty array if query is clear.`
        },
        { role: 'user', content: query }
      ],
      maxTokens: 200,
    })
    const match = result.text.match(/\[[\s\S]*\]/)
    return match ? JSON.parse(match[0]).slice(0, 3) : []
  } catch {
    return []
  }
}

async function processAppMention(event: any) {
  cleanupContext()
  
  const text = event.text.replace(/<@[A-Z0-9]+>/gi, '').trim()
  const channel = event.channel
  const threadTs = event.ts

  if (!text && (!event.files || event.files.length === 0)) {
    await slack.chat.postMessage({
      channel,
      thread_ts: threadTs,
      text: "Hi! Ask me a research question.\n\nTips:\n• Reply with `deep` to run thorough research (7 models)\n• Follow up in the thread for more questions"
    })
    return
  }

  // Parse mode from message
  const isDeep = text.toLowerCase().includes('deep:') || text.toLowerCase().startsWith('deep ')
  const cleanText = text.replace(/^deep:?\s*/i, '').trim()

  // Download images
  const images: ResearchImage[] = []
  if (event.files?.length > 0) {
    for (const file of event.files.slice(0, 4)) {
      if (file.mimetype?.startsWith('image/')) {
        const img = await downloadSlackImage(file)
        if (img) images.push(img)
      }
    }
  }

  const queryText = cleanText || (images.length > 0 ? 'What is in this image? Analyze it.' : '')
  const mode = isDeep ? 'deep' : 'quick'

  // Get clarifying questions
  const questions = await getClarifyingQuestions(queryText)
  
  if (questions.length > 0) {
    // Store pending and ask questions
    await slack.chat.postMessage({
      channel,
      thread_ts: threadTs,
      text: `💬 Quick questions to improve results:\n\n${questions.map((q, i) => `${i + 1}. ${q}`).join('\n')}\n\n_Reply with context, or "skip" to proceed._`
    })
    
    // Store context for when they reply
    researchContext.set(threadTs, {
      results: [{ query: queryText, responses: [], synthesis: '', totalDurationMs: 0, modelCount: 0, successCount: 0 }],
      expiresAt: Date.now() + 10 * 60 * 1000
    })
    return
  }

  await runAndPostResearch(channel, threadTs, queryText, images, mode)
}

async function processThreadReply(event: any) {
  const threadTs = event.thread_ts
  const text = event.text.toLowerCase()
  const channel = event.channel
  
  // Check if this is a follow-up in an existing research thread
  const ctx = researchContext.get(threadTs)
  
  // Parse mode from reply
  const isDeep = text.includes('deep:') || text.startsWith('deep ')
  const cleanText = event.text.replace(/^deep:?\s*/i, '').trim()
  const mode = isDeep ? 'deep' : 'quick'

  // Skip command - run without additional context
  if (text === 'skip') {
    if (ctx?.results[0]) {
      await runAndPostResearch(channel, threadTs, ctx.results[0].query, [], 'quick')
    }
    return
  }

  // If we have context, this is a follow-up
  if (ctx && ctx.results.length > 0) {
    // Build enhanced query with previous context
    const previousContext = compactContext(ctx.results)
    const enhancedQuery = `${cleanText}\n\n---\nContext from previous research:\n${previousContext}`
    
    await runAndPostResearch(channel, threadTs, enhancedQuery, [], mode)
    return
  }

  // Regular follow-up without stored context
  try {
    const result = await runFollowUp(event.text)
    await slack.chat.postMessage({ channel, thread_ts: threadTs, text: result })
  } catch (error) {
    await slack.chat.postMessage({
      channel,
      thread_ts: threadTs,
      text: `❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`
    })
  }
}

async function runAndPostResearch(
  channel: string, 
  threadTs: string, 
  query: string, 
  images: ResearchImage[],
  mode: 'quick' | 'deep'
) {
  const modelCount = mode === 'deep' ? 7 : 3
  
  await slack.chat.postMessage({
    channel,
    thread_ts: threadTs,
    text: `🔬 ${mode === 'deep' ? 'Deep' : 'Quick'} research: "${query.slice(0, 60)}..."${images.length > 0 ? ` (${images.length} images)` : ''}\n\nQuerying ${modelCount} models with web search...`
  })

  try {
    const result = await runResearch({
      query,
      images: images.length > 0 ? images : undefined,
      mode
    })

    // Store for follow-ups
    const ctx = researchContext.get(threadTs) || { results: [], expiresAt: 0 }
    ctx.results.push(result)
    ctx.expiresAt = Date.now() + 30 * 60 * 1000 // 30 min
    researchContext.set(threadTs, ctx)

    const duration = (result.totalDurationMs / 1000).toFixed(1)
    const modelsUsed = result.responses.filter(r => r.success).map(r => r.model).join(', ')

    await slack.chat.postMessage({
      channel,
      thread_ts: threadTs,
      text: result.synthesis,
      blocks: [
        { type: 'header', text: { type: 'plain_text', text: '🔬 Research Complete', emoji: true } },
        { type: 'section', text: { type: 'mrkdwn', text: result.synthesis.slice(0, 2900) } },
        { type: 'divider' },
        { type: 'context', elements: [
          { type: 'mrkdwn', text: `*Mode:* ${mode === 'deep' ? 'Deep' : 'Quick'} | *Models:* ${result.successCount}/${result.modelCount} | *Time:* ${duration}s` }
        ]},
        { type: 'section', text: { type: 'mrkdwn', text: '_Reply to follow up. Use `deep: [question]` for thorough research._' }}
      ]
    })
  } catch (error) {
    await slack.chat.postMessage({
      channel,
      thread_ts: threadTs,
      text: `❌ Research failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    })
  }
}
