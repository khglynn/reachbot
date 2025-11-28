import { NextRequest, NextResponse } from 'next/server'
import { slack, verifySlackRequest } from '@/lib/slack'
import { generateText } from 'ai'
import { createOpenRouter } from '@openrouter/ai-sdk-provider'

const openrouter = createOpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY!,
})

// Models for research
const RESEARCH_MODELS = [
  { id: 'anthropic/claude-haiku-4.5', name: 'Claude Haiku 4.5' },
  { id: 'google/gemini-2.5-flash-preview-05-20', name: 'Gemini 2.5 Flash' },
  { id: 'deepseek/deepseek-r1', name: 'DeepSeek R1' },
]

const ORCHESTRATOR_MODEL = 'anthropic/claude-4-sonnet-20250522'
const FOLLOWUP_MODEL = 'anthropic/claude-haiku-4.5'

export async function POST(request: NextRequest) {
  const body = await request.text()
  const signature = request.headers.get('x-slack-signature')
  const timestamp = request.headers.get('x-slack-request-timestamp')

  // Verify request (skip in dev for URL verification)
  if (process.env.NODE_ENV === 'production') {
    if (!verifySlackRequest(signature, timestamp, body)) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
    }
  }

  const payload = JSON.parse(body)

  // Handle URL verification challenge
  if (payload.type === 'url_verification') {
    return NextResponse.json({ challenge: payload.challenge })
  }

  // Handle events
  if (payload.type === 'event_callback') {
    const event = payload.event

    // Ignore bot messages
    if (event.bot_id) {
      return NextResponse.json({ ok: true })
    }

    // Handle app mentions
    if (event.type === 'app_mention') {
      // Process async to respond quickly to Slack
      processAppMention(event).catch(console.error)
      return NextResponse.json({ ok: true })
    }

    // Handle thread replies (follow-ups)
    if (event.type === 'message' && event.thread_ts && !event.bot_id) {
      processFollowUp(event).catch(console.error)
      return NextResponse.json({ ok: true })
    }
  }

  return NextResponse.json({ ok: true })
}

async function processAppMention(event: any) {
  const text = event.text.replace(/<@[A-Z0-9]+>/gi, '').trim()
  const channel = event.channel
  const threadTs = event.ts

  if (!text) {
    await slack.chat.postMessage({
      channel,
      thread_ts: threadTs,
      text: "Hi! Ask me a research question and I'll query multiple AI models. Example: `@ResearchBot What are the pros and cons of serverless?`"
    })
    return
  }

  // Acknowledge
  await slack.chat.postMessage({
    channel,
    thread_ts: threadTs,
    text: `🔬 Researching: "${text.substring(0, 80)}${text.length > 80 ? '...' : ''}"\n\nQuerying ${RESEARCH_MODELS.length} models in parallel...`
  })

  const startTime = Date.now()

  // Query all models in parallel
  const responses = await Promise.all(
    RESEARCH_MODELS.map(async (model) => {
      try {
        const result = await generateText({
          model: openrouter(model.id),
          messages: [
            { role: 'system', content: 'You are an expert research assistant. Provide thorough, well-reasoned answers. Be concise but comprehensive.' },
            { role: 'user', content: text }
          ],
          maxTokens: 2000,
        })
        return { model: model.name, content: result.text, success: true }
      } catch (error) {
        return { model: model.name, content: '', success: false, error: String(error) }
      }
    })
  )

  const successful = responses.filter(r => r.success)

  if (successful.length === 0) {
    await slack.chat.postMessage({
      channel,
      thread_ts: threadTs,
      text: '❌ All models failed to respond. Please try again.'
    })
    return
  }

  // Synthesize
  const synthesisPrompt = `Synthesize these AI responses to: "${text}"

${successful.map(r => `### ${r.model}\n${r.content}`).join('\n\n---\n\n')}

Create a unified synthesis (max 400 words) that:
1. Key consensus points
2. Notable disagreements  
3. Actionable insights

Use markdown. Start directly, no preamble.`

  const synthesis = await generateText({
    model: openrouter(ORCHESTRATOR_MODEL),
    messages: [{ role: 'user', content: synthesisPrompt }],
    maxTokens: 1500,
  })

  const duration = ((Date.now() - startTime) / 1000).toFixed(1)

  await slack.chat.postMessage({
    channel,
    thread_ts: threadTs,
    text: synthesis.text,
    blocks: [
      { type: 'header', text: { type: 'plain_text', text: '🔬 Research Complete', emoji: true } },
      { type: 'section', text: { type: 'mrkdwn', text: synthesis.text.substring(0, 2900) } },
      { type: 'divider' },
      { type: 'context', elements: [
        { type: 'mrkdwn', text: `*Models:* ${successful.map(r => r.model).join(', ')}` },
        { type: 'mrkdwn', text: `*Time:* ${duration}s` },
      ]}
    ]
  })
}

async function processFollowUp(event: any) {
  const channel = event.channel
  const threadTs = event.thread_ts

  try {
    const result = await generateText({
      model: openrouter(FOLLOWUP_MODEL),
      messages: [
        { role: 'system', content: 'You are a helpful research assistant. Give concise answers.' },
        { role: 'user', content: event.text }
      ],
      maxTokens: 1000,
    })

    await slack.chat.postMessage({
      channel,
      thread_ts: threadTs,
      text: result.text
    })
  } catch (error) {
    await slack.chat.postMessage({
      channel,
      thread_ts: threadTs,
      text: `❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`
    })
  }
}
