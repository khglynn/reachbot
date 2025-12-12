/**
 * Billing Reconciliation Cron Job
 *
 * Compares Eachie DB credits vs OpenRouter actual charges.
 * Alerts via Slack if drift exceeds $8 or 8%.
 *
 * Schedule: Daily at 9am CT (14:00 UTC) via Vercel Cron
 *
 * Created: December 2024
 */

import { NextRequest, NextResponse } from 'next/server'
import { getEachieTotals } from '@/server/queries/usage'

// Initial OpenRouter deposit (in cents) - update this when adding funds
const INITIAL_DEPOSIT_CENTS = 3000 // $30 initial deposit

/**
 * Verify cron request is authorized.
 */
function isAuthorized(request: NextRequest): boolean {
  const authHeader = request.headers.get('authorization')
  return authHeader === `Bearer ${process.env.CRON_SECRET}`
}

/**
 * Send Slack alert for billing drift.
 */
async function sendSlackAlert(message: string): Promise<void> {
  const webhookUrl = process.env.SLACK_WEBHOOK_EACHIE_MONEY

  if (!webhookUrl) {
    console.error('[Reconcile] No SLACK_WEBHOOK_EACHIE_MONEY configured')
    return
  }

  try {
    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: message }),
    })
  } catch (error) {
    console.error('[Reconcile] Failed to send Slack alert:', error)
  }
}

/**
 * Query OpenRouter for actual credit balance.
 */
async function getOpenRouterBalance(): Promise<{
  totalCredits: number
  totalUsage: number
  balance: number
} | null> {
  const apiKey = process.env.OPENROUTER_API_KEY

  if (!apiKey) {
    console.error('[Reconcile] No OPENROUTER_API_KEY configured')
    return null
  }

  try {
    const response = await fetch('https://openrouter.ai/api/v1/credits', {
      headers: { Authorization: `Bearer ${apiKey}` },
    })

    if (!response.ok) {
      console.error('[Reconcile] OpenRouter API error:', response.status)
      return null
    }

    const data = await response.json()
    // OpenRouter returns credits in dollars, convert to cents
    const totalCredits = Math.round((data.data?.total_credits ?? 0) * 100)
    const totalUsage = Math.round((data.data?.total_usage ?? 0) * 100)

    return {
      totalCredits,
      totalUsage,
      balance: totalCredits - totalUsage,
    }
  } catch (error) {
    console.error('[Reconcile] Failed to fetch OpenRouter balance:', error)
    return null
  }
}

/**
 * Daily reconciliation check.
 * Compares expected OpenRouter balance vs actual.
 */
export async function GET(request: NextRequest) {
  // Verify authorization
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  console.log('[Reconcile] Starting daily reconciliation...')

  try {
    // 1. Get OpenRouter actual balance
    const orBalance = await getOpenRouterBalance()
    if (!orBalance) {
      await sendSlackAlert(
        '⚠️ Reconciliation Failed\n' +
          'Could not fetch OpenRouter balance. Check API key and logs.'
      )
      return NextResponse.json(
        { error: 'Failed to fetch OpenRouter balance' },
        { status: 500 }
      )
    }

    // 2. Get Eachie DB totals
    const dbTotals = await getEachieTotals()

    // 3. Calculate expected OpenRouter balance
    // Expected = initial deposit - what Eachie users have spent
    const expectedBalanceCents = INITIAL_DEPOSIT_CENTS - dbTotals.totalSpentCents
    const actualBalanceCents = orBalance.balance

    // 4. Calculate drift
    const driftCents = Math.abs(expectedBalanceCents - actualBalanceCents)
    const driftPercent =
      expectedBalanceCents > 0 ? (driftCents / expectedBalanceCents) * 100 : 0

    // 5. Determine direction
    const direction =
      expectedBalanceCents > actualBalanceCents
        ? 'UNDER (OpenRouter charged more than tracked)'
        : 'OVER (we tracked more than OpenRouter charged)'

    // 6. Log results
    const result = {
      status: 'ok',
      timestamp: new Date().toISOString(),
      openrouter: {
        totalCreditsCents: orBalance.totalCredits,
        totalUsageCents: orBalance.totalUsage,
        balanceCents: actualBalanceCents,
      },
      eachie: {
        totalSpentCents: dbTotals.totalSpentCents,
        totalCreditsCents: dbTotals.totalCreditsCents,
        userCount: dbTotals.userCount,
      },
      reconciliation: {
        initialDepositCents: INITIAL_DEPOSIT_CENTS,
        expectedBalanceCents,
        actualBalanceCents,
        driftCents,
        driftPercent: Math.round(driftPercent * 10) / 10,
        direction,
      },
    }

    console.log('[Reconcile] Results:', JSON.stringify(result, null, 2))

    // 7. Alert if significant drift ($8 or 8%)
    if (driftCents > 800 || driftPercent > 8) {
      await sendSlackAlert(
        `⚠️ Billing Drift Detected\n\n` +
          `Expected OR balance: $${(expectedBalanceCents / 100).toFixed(2)}\n` +
          `Actual OR balance: $${(actualBalanceCents / 100).toFixed(2)}\n` +
          `Drift: $${(driftCents / 100).toFixed(2)} (${driftPercent.toFixed(1)}%)\n` +
          `Direction: ${direction}\n\n` +
          `Eachie users: ${dbTotals.userCount}\n` +
          `Total tracked spend: $${(dbTotals.totalSpentCents / 100).toFixed(2)}`
      )

      return NextResponse.json({
        ...result,
        alert: 'Drift threshold exceeded - Slack alert sent',
      })
    }

    // 8. Send healthy status (optional - for monitoring)
    // Uncomment to get daily "all good" messages:
    // await sendSlackAlert(
    //   `✅ Reconciliation OK\n` +
    //   `Drift: $${(driftCents / 100).toFixed(2)} (${driftPercent.toFixed(1)}%)`
    // )

    return NextResponse.json(result)
  } catch (error) {
    console.error('[Reconcile] Error:', error)
    await sendSlackAlert(
      '🚨 Reconciliation Error\n' +
        `Error: ${error instanceof Error ? error.message : 'Unknown error'}`
    )
    return NextResponse.json(
      { error: 'Reconciliation failed' },
      { status: 500 }
    )
  }
}
