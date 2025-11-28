import { SlackApp } from '@vercel/slack-bolt'
import { generateText } from 'ai'
import { createOpenRouter } from '@openrouter/ai-sdk-provider'
import { startResearchWorkflow } from '@/workflows/research'

const openrouter = createOpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY!,
})

// Fast model for follow-up questions
const FOLLOWUP_MODEL = 'anthropic/claude-haiku-4.5'

export const slackApp = new SlackApp({
  signingSecret: process.env.SLACK_SIGNING_SECRET!,
  token: process.env.SLACK_BOT_TOKEN!,
})

// Listen for app mentions (@ResearchBot)
slackApp.event('app_mention', async ({ event, say, client }) => {
  const text = event.text.replace(/<@[A-Z0-9]+>/g, '').trim()
  
  if (!text) {
    await say({
      thread_ts: event.ts,
      text: "Hi! Ask me a research question and I'll query multiple AI models for you. Example: `@ResearchBot What are the pros and cons of serverless vs containers?`"
    })
    return
  }

  // Acknowledge the request
  await say({
    thread_ts: event.ts,
    text: `🔬 Starting research on: "${text.substring(0, 100)}${text.length > 100 ? '...' : ''}"\n\nQuerying Claude Haiku, Gemini Flash, and DeepSeek R1 in parallel...`
  })

  // Start the durable workflow
  try {
    const result = await startResearchWorkflow({
      question: text,
      channelId: event.channel,
      threadTs: event.ts,
      userId: event.user,
    })
    
    // Post the result
    await client.chat.postMessage({
      channel: event.channel,
      thread_ts: event.ts,
      text: result.synthesis,
      blocks: formatResearchResult(result),
    })
  } catch (error) {
    await say({
      thread_ts: event.ts,
      text: `❌ Research failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    })
  }
})

// Listen for messages in threads (follow-up questions)
slackApp.event('message', async ({ event, say, client }) => {
  // Only respond to threaded messages that aren't from bots
  if (!event.thread_ts || event.bot_id || event.subtype) return
  
  // Quick follow-up with single fast model via OpenRouter
  await say({
    thread_ts: event.thread_ts,
    text: '💭 Thinking...'
  })

  try {
    const result = await generateText({
      model: openrouter(FOLLOWUP_MODEL),
      messages: [
        { role: 'system', content: 'You are a helpful research assistant. Give concise, informative answers.' },
        { role: 'user', content: event.text }
      ],
      maxTokens: 1000,
    })

    await client.chat.postMessage({
      channel: event.channel,
      thread_ts: event.thread_ts,
      text: result.text,
    })
  } catch (error) {
    await client.chat.postMessage({
      channel: event.channel,
      thread_ts: event.thread_ts,
      text: `❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
    })
  }
})

function formatResearchResult(result: any) {
  return [
    {
      type: 'header',
      text: { type: 'plain_text', text: '🔬 Research Complete', emoji: true }
    },
    {
      type: 'section',
      text: { type: 'mrkdwn', text: result.synthesis }
    },
    {
      type: 'divider'
    },
    {
      type: 'context',
      elements: [
        { type: 'mrkdwn', text: `*Models:* ${result.models.join(', ')}` },
        { type: 'mrkdwn', text: `*Time:* ${result.duration.toFixed(1)}s` },
      ]
    },
    {
      type: 'actions',
      elements: [
        {
          type: 'button',
          text: { type: 'plain_text', text: '📋 Show Individual Responses', emoji: true },
          action_id: 'show_individual_responses',
          value: JSON.stringify({ responseId: result.id })
        }
      ]
    }
  ]
}
