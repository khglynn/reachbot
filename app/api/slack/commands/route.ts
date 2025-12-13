/**
 * Slack Slash Commands API
 *
 * Handles /eachie slash commands from Slack.
 *
 * Commands:
 *   /eachie topup <email>  - Top up admin to $48
 *   /eachie admin <email>  - Make user an admin
 *   /eachie status <email> - Check user's balance
 *   /eachie stats          - Show all admin balances
 *   /eachie help           - Show available commands
 *
 * Created: December 2024
 */

import { NextRequest, NextResponse } from 'next/server'
import {
  topUpAdmin,
  makeAdmin,
  getUserStatus,
  getAdminStats,
} from '@/server/queries/usage'

// Verify requests come from Slack (optional but recommended)
const SLACK_SIGNING_SECRET = process.env.SLACK_SIGNING_SECRET

/**
 * Handle Slack slash command.
 * Slack sends POST with form-encoded data.
 */
export async function POST(request: NextRequest) {
  const formData = await request.formData()

  // Parse Slack payload
  const command = formData.get('command') as string // /eachie
  const text = (formData.get('text') as string || '').trim() // "topup kevin@example.com"
  const userId = formData.get('user_id') as string
  const userName = formData.get('user_name') as string

  // Parse action and argument
  const parts = text.split(/\s+/)
  const action = parts[0]?.toLowerCase() || 'help'
  const arg = parts.slice(1).join(' ')

  console.log(`[Slack] ${userName} ran: ${command} ${text}`)

  try {
    let response: { text: string; response_type?: string }

    switch (action) {
      case 'topup': {
        if (!arg) {
          response = { text: '❌ Usage: `/eachie topup <email>`' }
          break
        }
        const result = await topUpAdmin(arg)
        response = {
          text: result.success ? `✅ ${result.message}` : `❌ ${result.message}`,
          response_type: 'in_channel',
        }
        break
      }

      case 'admin': {
        if (!arg) {
          response = { text: '❌ Usage: `/eachie admin <email>`' }
          break
        }
        const result = await makeAdmin(arg)
        response = {
          text: result.success ? `✅ ${result.message}` : `❌ ${result.message}`,
          response_type: 'in_channel',
        }
        break
      }

      case 'status': {
        if (!arg) {
          response = { text: '❌ Usage: `/eachie status <email>`' }
          break
        }
        const result = await getUserStatus(arg)
        response = {
          text: result.success ? `📊 ${result.message}` : `❌ ${result.message}`,
        }
        break
      }

      case 'stats': {
        const result = await getAdminStats()
        response = {
          text: result.message,
          response_type: 'in_channel',
        }
        break
      }

      case 'help':
      default: {
        response = {
          text: [
            '*Eachie Admin Commands*',
            '',
            '`/eachie topup <email>` - Top up admin to $48',
            '`/eachie admin <email>` - Make user an admin (+$48)',
            '`/eachie status <email>` - Check user balance',
            '`/eachie stats` - Show all admin balances',
            '`/eachie help` - Show this help',
          ].join('\n'),
        }
        break
      }
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('[Slack Commands] Error:', error)
    return NextResponse.json({
      text: '❌ Something went wrong. Check logs.',
    })
  }
}
