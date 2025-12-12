/**
 * Usage Queries
 *
 * Database operations for tracking anonymous and authenticated usage.
 * Costs are stored in cents for precision (no floating point issues).
 *
 * Created: December 2024
 *
 * @module server/queries/usage
 */

import { getDb } from '../db'

// ============================================================
// SLACK NOTIFICATIONS
// ============================================================

/** Default credits for admins (in cents) */
const ADMIN_DEFAULT_CREDITS_CENTS = 4800 // $48

/** Low balance threshold for admin alerts (in cents) */
const ADMIN_LOW_BALANCE_CENTS = 800 // $8

/** Max credits an admin can have (safety cap) */
const ADMIN_MAX_CREDITS_CENTS = ADMIN_DEFAULT_CREDITS_CENTS + ADMIN_LOW_BALANCE_CENTS // $56

/**
 * Send a Slack notification to #eachie-money channel.
 */
async function sendSlackAlert(message: string): Promise<void> {
  const webhookUrl = process.env.SLACK_EACHIE_MONEY_WEBHOOK_URL
  if (!webhookUrl) {
    console.warn('[Slack] No SLACK_EACHIE_MONEY_WEBHOOK_URL configured, skipping alert:', message)
    return
  }

  try {
    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: message }),
    })
  } catch (error) {
    console.error('[Slack] Failed to send alert:', error)
  }
}

/**
 * Send a Slack notification with an interactive button.
 * Used for admin low-balance alerts with top-up action.
 */
async function sendSlackAlertWithButton(params: {
  text: string
  buttonText: string
  buttonValue: string
}): Promise<void> {
  const webhookUrl = process.env.SLACK_EACHIE_MONEY_WEBHOOK_URL
  if (!webhookUrl) {
    console.warn('[Slack] No webhook configured, skipping alert:', params.text)
    return
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://eachie.ai'

  try {
    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: params.text,
        blocks: [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: params.text,
            },
          },
          {
            type: 'actions',
            elements: [
              {
                type: 'button',
                text: {
                  type: 'plain_text',
                  text: params.buttonText,
                  emoji: true,
                },
                value: params.buttonValue,
                action_id: 'admin_topup',
                url: `${appUrl}/api/admin/topup?email=${encodeURIComponent(params.buttonValue.replace('topup:', ''))}`,
              },
            ],
          },
        ],
      }),
    })
  } catch (error) {
    console.error('[Slack] Failed to send alert with button:', error)
  }
}

/** Free tier limit in cents ($12.00) */
export const FREE_TIER_LIMIT_CENTS = 1200

/** Rate limits (free tier only - paid users have no limits) */
export const RATE_LIMITS = {
  REQUESTS_PER_HOUR: 20,
  REQUESTS_PER_DAY: 100,
  MAX_COST_PER_QUERY_CENTS: 1500, // $15 sanity check
}

/** System-wide cost alert threshold */
export const SYSTEM_ALERT_THRESHOLD = {
  COST_CENTS: 10000, // $100
  WINDOW_HOURS: 6,
}

// ============================================================
// ANONYMOUS USAGE (Device-based tracking)
// ============================================================

interface AnonymousUsage {
  device_id: string
  total_cost_cents: number
  first_seen: Date
  last_seen: Date
}

/**
 * Get or create anonymous usage record for a device.
 * Returns current usage in cents and whether free tier is exhausted.
 */
export async function getAnonymousUsage(deviceId: string): Promise<{
  totalCostCents: number
  remaining: number
  isExhausted: boolean
}> {
  const sql = getDb()

  // Upsert: create if not exists, update last_seen if exists
  const result = await sql`
    INSERT INTO anonymous_usage (device_id, total_cost_cents, first_seen, last_seen)
    VALUES (${deviceId}, 0, NOW(), NOW())
    ON CONFLICT (device_id) DO UPDATE SET last_seen = NOW()
    RETURNING total_cost_cents
  ` as AnonymousUsage[]

  const totalCostCents = result[0]?.total_cost_cents ?? 0
  const remaining = Math.max(0, FREE_TIER_LIMIT_CENTS - totalCostCents)

  return {
    totalCostCents,
    remaining,
    isExhausted: totalCostCents >= FREE_TIER_LIMIT_CENTS,
  }
}

/**
 * Add cost to anonymous usage after a research query.
 * Call this after research completes with the actual cost.
 *
 * @param deviceId - FingerprintJS visitor ID
 * @param costCents - Cost in cents (e.g., $0.05 = 5)
 * @returns Updated total and whether limit is now exhausted
 */
export async function addAnonymousUsage(
  deviceId: string,
  costCents: number
): Promise<{
  totalCostCents: number
  remaining: number
  isExhausted: boolean
}> {
  const sql = getDb()

  const result = await sql`
    INSERT INTO anonymous_usage (device_id, total_cost_cents, first_seen, last_seen)
    VALUES (${deviceId}, ${costCents}, NOW(), NOW())
    ON CONFLICT (device_id) DO UPDATE SET
      total_cost_cents = anonymous_usage.total_cost_cents + ${costCents},
      last_seen = NOW()
    RETURNING total_cost_cents
  ` as AnonymousUsage[]

  const totalCostCents = result[0]?.total_cost_cents ?? costCents
  const remaining = Math.max(0, FREE_TIER_LIMIT_CENTS - totalCostCents)

  return {
    totalCostCents,
    remaining,
    isExhausted: totalCostCents >= FREE_TIER_LIMIT_CENTS,
  }
}

// ============================================================
// AUTHENTICATED USER USAGE
// ============================================================

interface User {
  id: string
  email: string
  name: string
  credits_cents: number
  total_spent_cents: number
  is_super_admin: boolean
}

/**
 * Get user's credit balance and admin status.
 * Returns null if user doesn't exist.
 */
export async function getUserCredits(userId: string): Promise<{
  creditsCents: number
  totalSpentCents: number
  isSuperAdmin: boolean
} | null> {
  const sql = getDb()

  const result = await sql`
    SELECT credits_cents, total_spent_cents, is_super_admin
    FROM users
    WHERE id = ${userId}
  ` as User[]

  if (result.length === 0) return null

  return {
    creditsCents: result[0].credits_cents,
    totalSpentCents: result[0].total_spent_cents,
    isSuperAdmin: result[0].is_super_admin ?? false,
  }
}

/**
 * Deduct credits from user after a research query.
 * All users (including super_admins) deduct from balance and are blocked at $0.
 * Admins get a Slack alert when balance drops below $8.
 * Alerts to Slack if deduction fails unexpectedly (for monitoring).
 *
 * @param userId - Clerk user ID
 * @param costCents - Cost in cents
 * @returns Success boolean and updated balance
 */
export async function deductUserCredits(
  userId: string,
  costCents: number
): Promise<{
  success: boolean
  creditsCents: number
  message?: string
}> {
  try {
    const sql = getDb()

    // Check current balance and admin status
    const current = await getUserCredits(userId)
    if (!current) {
      return { success: false, creditsCents: 0, message: 'User not found' }
    }

    // Check balance (same for all users)
    if (current.creditsCents < costCents) {
      return {
        success: false,
        creditsCents: current.creditsCents,
        message: 'Insufficient credits',
      }
    }

    // Deduct credits and add to total spent
    const result = await sql`
      UPDATE users
      SET
        credits_cents = credits_cents - ${costCents},
        total_spent_cents = total_spent_cents + ${costCents}
      WHERE id = ${userId} AND credits_cents >= ${costCents}
      RETURNING credits_cents, email, is_super_admin
    ` as Array<{ credits_cents: number; email: string; is_super_admin: boolean }>

    if (result.length === 0) {
      // Race condition: balance changed between check and update
      // This is expected occasionally, but log it for monitoring
      console.warn(`[Billing] Race condition: user ${userId} balance changed during deduction`)
      return {
        success: false,
        creditsCents: current.creditsCents,
        message: 'Insufficient credits',
      }
    }

    const newBalance = result[0].credits_cents
    const previousBalance = newBalance + costCents

    // Admin low-balance alert (only when crossing $8 threshold)
    // Currently is_super_admin, can expand to other admin types later
    const isAdmin = result[0].is_super_admin
    if (
      isAdmin &&
      previousBalance >= ADMIN_LOW_BALANCE_CENTS &&
      newBalance < ADMIN_LOW_BALANCE_CENTS
    ) {
      const email = result[0].email
      sendSlackAlertWithButton({
        text: `💸 Admin *${email}* is running low: *$${(newBalance / 100).toFixed(2)}* remaining.`,
        buttonText: '💰 Top Up to $48',
        buttonValue: `topup:${email}`,
      })
    }

    return {
      success: true,
      creditsCents: newBalance,
    }
  } catch (error) {
    // Alert on unexpected database errors - this indicates billing is broken
    console.error('[Billing] Credit deduction failed:', error)
    sendSlackAlert(
      `🚨 BILLING ERROR: Credit deduction failed for user ${userId}. ` +
        `Amount: $${(costCents / 100).toFixed(2)}. Check logs!`
    )
    throw error // Re-throw so caller knows it failed
  }
}

/**
 * Add credits to user (from purchase or invite code).
 */
export async function addUserCredits(
  userId: string,
  creditsCents: number
): Promise<{ creditsCents: number }> {
  const sql = getDb()

  const result = await sql`
    UPDATE users
    SET credits_cents = credits_cents + ${creditsCents}
    WHERE id = ${userId}
    RETURNING credits_cents
  ` as User[]

  return { creditsCents: result[0]?.credits_cents ?? 0 }
}

/**
 * Top up an admin account to $48, capped at $56 max.
 * Used by Slack button to refill admin credits.
 *
 * @param email - Admin's email address
 * @returns Result with new balance or error
 */
export async function topUpAdmin(email: string): Promise<{
  success: boolean
  creditsCents?: number
  message: string
}> {
  const sql = getDb()

  // Check if user exists and is admin
  const user = await sql`
    SELECT id, email, credits_cents, is_super_admin
    FROM users
    WHERE email = ${email}
  ` as Array<{ id: string; email: string; credits_cents: number; is_super_admin: boolean }>

  if (user.length === 0) {
    return { success: false, message: `User ${email} not found` }
  }

  if (!user[0].is_super_admin) {
    return { success: false, message: `${email} is not an admin` }
  }

  const currentBalance = user[0].credits_cents

  // Already at or above max
  if (currentBalance >= ADMIN_MAX_CREDITS_CENTS) {
    return {
      success: false,
      creditsCents: currentBalance,
      message: `${email} already at max ($${(currentBalance / 100).toFixed(2)})`,
    }
  }

  // Top up to $48, but cap at $56
  const targetBalance = Math.min(ADMIN_DEFAULT_CREDITS_CENTS, ADMIN_MAX_CREDITS_CENTS)
  const newBalance = Math.min(
    Math.max(currentBalance, targetBalance), // At least get to $48
    ADMIN_MAX_CREDITS_CENTS // But never exceed $56
  )

  const result = await sql`
    UPDATE users
    SET credits_cents = ${newBalance}
    WHERE id = ${user[0].id}
    RETURNING credits_cents
  ` as Array<{ credits_cents: number }>

  const finalBalance = result[0]?.credits_cents ?? newBalance
  const added = finalBalance - currentBalance

  // Notify Slack of successful top-up
  sendSlackAlert(
    `✅ Topped up ${email}: $${(currentBalance / 100).toFixed(2)} → $${(finalBalance / 100).toFixed(2)} (+$${(added / 100).toFixed(2)})`
  )

  return {
    success: true,
    creditsCents: finalBalance,
    message: `Topped up ${email} to $${(finalBalance / 100).toFixed(2)}`,
  }
}

/**
 * Make a user an admin and give them $48 credits.
 *
 * @param email - User's email address
 * @returns Result with success status
 */
export async function makeAdmin(email: string): Promise<{
  success: boolean
  message: string
}> {
  const sql = getDb()

  // Check if user exists
  const user = await sql`
    SELECT id, email, is_super_admin, credits_cents
    FROM users
    WHERE email = ${email}
  ` as Array<{ id: string; email: string; is_super_admin: boolean; credits_cents: number }>

  if (user.length === 0) {
    return { success: false, message: `User ${email} not found. They need to sign up first.` }
  }

  if (user[0].is_super_admin) {
    return { success: false, message: `${email} is already an admin` }
  }

  // Make admin and set credits to $48
  await sql`
    UPDATE users
    SET is_super_admin = true, credits_cents = ${ADMIN_DEFAULT_CREDITS_CENTS}
    WHERE id = ${user[0].id}
  `

  // Notify Slack
  sendSlackAlert(`👑 New admin: ${email} (given $48 credits)`)

  return {
    success: true,
    message: `${email} is now an admin with $48 credits`,
  }
}

/**
 * Get a user's current status (balance, spend, admin).
 *
 * @param email - User's email address
 * @returns User status or error
 */
export async function getUserStatus(email: string): Promise<{
  success: boolean
  message: string
  data?: {
    email: string
    balance: number
    spent: number
    isAdmin: boolean
  }
}> {
  const sql = getDb()

  const user = await sql`
    SELECT email, credits_cents, total_spent_cents, is_super_admin
    FROM users
    WHERE email = ${email}
  ` as Array<{ email: string; credits_cents: number; total_spent_cents: number; is_super_admin: boolean }>

  if (user.length === 0) {
    return { success: false, message: `User ${email} not found` }
  }

  const u = user[0]
  return {
    success: true,
    message: `${u.email}: $${(u.credits_cents / 100).toFixed(2)} balance, $${(u.total_spent_cents / 100).toFixed(2)} spent${u.is_super_admin ? ' (admin)' : ''}`,
    data: {
      email: u.email,
      balance: u.credits_cents / 100,
      spent: u.total_spent_cents / 100,
      isAdmin: u.is_super_admin,
    },
  }
}

/**
 * Get all admin stats (balances and spending).
 *
 * @returns Summary of all admin accounts
 */
export async function getAdminStats(): Promise<{
  success: boolean
  message: string
  admins: Array<{ email: string; balance: number; spent: number }>
}> {
  const sql = getDb()

  const admins = await sql`
    SELECT email, credits_cents, total_spent_cents
    FROM users
    WHERE is_super_admin = true
    ORDER BY total_spent_cents DESC
  ` as Array<{ email: string; credits_cents: number; total_spent_cents: number }>

  if (admins.length === 0) {
    return { success: true, message: 'No admins found', admins: [] }
  }

  const totalSpent = admins.reduce((sum, a) => sum + a.total_spent_cents, 0)
  const totalBalance = admins.reduce((sum, a) => sum + a.credits_cents, 0)

  const lines = admins.map(
    (a) => `• ${a.email}: $${(a.credits_cents / 100).toFixed(2)} bal, $${(a.total_spent_cents / 100).toFixed(2)} spent`
  )

  const summary = [
    `*Admin Stats* (${admins.length} admins)`,
    `Total balance: $${(totalBalance / 100).toFixed(2)}`,
    `Total spent: $${(totalSpent / 100).toFixed(2)}`,
    '',
    ...lines,
  ].join('\n')

  return {
    success: true,
    message: summary,
    admins: admins.map((a) => ({
      email: a.email,
      balance: a.credits_cents / 100,
      spent: a.total_spent_cents / 100,
    })),
  }
}

// ============================================================
// USAGE CHECK (Pre-query validation)
// ============================================================

export type UsageCheckResult =
  | { allowed: true; source: 'byok' }
  | { allowed: true; source: 'anonymous'; remaining: number }
  | { allowed: true; source: 'credits'; remaining: number }
  | { allowed: false; reason: 'free_tier_exhausted' }
  | { allowed: false; reason: 'free_tier_paused' }
  | { allowed: false; reason: 'rate_limited'; retryAfter?: string }
  | { allowed: false; reason: 'insufficient_credits'; balance: number }

/**
 * Check if free tier is currently paused (system-wide circuit breaker).
 */
export async function isFreeTierPaused(): Promise<boolean> {
  const sql = getDb()
  try {
    const result = await sql`
      SELECT value FROM system_state WHERE key = 'free_tier_paused'
    ` as Array<{ value: { paused: boolean } }>
    return result[0]?.value?.paused === true
  } catch {
    // Table might not exist yet, default to not paused
    return false
  }
}

/**
 * Check rate limits for a device.
 * Returns whether rate limited and updates counters.
 */
async function checkRateLimits(deviceId: string): Promise<{
  isLimited: boolean
  reason?: 'hourly' | 'daily'
  requestsThisHour: number
  requestsToday: number
}> {
  const sql = getDb()
  const now = new Date()
  const currentHour = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours())
  const currentDay = now.toISOString().split('T')[0]

  try {
    // Get current rate limit state, resetting windows if expired
    const result = await sql`
      INSERT INTO anonymous_usage (
        device_id, total_cost_cents, first_seen, last_seen,
        requests_this_hour, requests_today, hour_window_start, day_window_start, last_request_at
      )
      VALUES (
        ${deviceId}, 0, NOW(), NOW(),
        1, 1, ${currentHour}, ${currentDay}::date, NOW()
      )
      ON CONFLICT (device_id) DO UPDATE SET
        last_seen = NOW(),
        last_request_at = NOW(),
        -- Reset hourly counter if new hour
        requests_this_hour = CASE
          WHEN anonymous_usage.hour_window_start IS NULL OR anonymous_usage.hour_window_start < ${currentHour}
          THEN 1
          ELSE anonymous_usage.requests_this_hour + 1
        END,
        hour_window_start = CASE
          WHEN anonymous_usage.hour_window_start IS NULL OR anonymous_usage.hour_window_start < ${currentHour}
          THEN ${currentHour}
          ELSE anonymous_usage.hour_window_start
        END,
        -- Reset daily counter if new day
        requests_today = CASE
          WHEN anonymous_usage.day_window_start IS NULL OR anonymous_usage.day_window_start < ${currentDay}::date
          THEN 1
          ELSE anonymous_usage.requests_today + 1
        END,
        day_window_start = CASE
          WHEN anonymous_usage.day_window_start IS NULL OR anonymous_usage.day_window_start < ${currentDay}::date
          THEN ${currentDay}::date
          ELSE anonymous_usage.day_window_start
        END
      RETURNING requests_this_hour, requests_today
    ` as Array<{ requests_this_hour: number; requests_today: number }>

    const { requests_this_hour, requests_today } = result[0]

    // Check limits (values are already incremented, so we check after)
    if (requests_this_hour > RATE_LIMITS.REQUESTS_PER_HOUR) {
      return { isLimited: true, reason: 'hourly', requestsThisHour: requests_this_hour, requestsToday: requests_today }
    }
    if (requests_today > RATE_LIMITS.REQUESTS_PER_DAY) {
      return { isLimited: true, reason: 'daily', requestsThisHour: requests_this_hour, requestsToday: requests_today }
    }

    return { isLimited: false, requestsThisHour: requests_this_hour, requestsToday: requests_today }
  } catch (error) {
    // If rate limit columns don't exist yet, allow the request
    console.warn('[Usage] Rate limit check failed (columns may not exist):', error)
    return { isLimited: false, requestsThisHour: 0, requestsToday: 0 }
  }
}

/**
 * Check if a query is allowed based on auth state and usage.
 *
 * Priority:
 * 1. BYOK mode - always allowed (user's own key)
 * 2. Authenticated with credits - check balance (no rate limits)
 * 3. Anonymous - check free tier + rate limits
 *
 * @param params - Auth state and identifiers
 * @returns Whether query is allowed and why/why not
 */
export async function checkUsageAllowed(params: {
  byokMode: boolean
  userId?: string
  deviceId?: string
}): Promise<UsageCheckResult> {
  const { byokMode, userId, deviceId } = params

  // BYOK always allowed
  if (byokMode) {
    return { allowed: true, source: 'byok' }
  }

  // Authenticated user - check credits (same logic for all users including super_admin)
  if (userId) {
    const credits = await getUserCredits(userId)

    if (!credits || credits.creditsCents <= 0) {
      return {
        allowed: false,
        reason: 'insufficient_credits',
        balance: credits?.creditsCents ?? 0,
      }
    }
    return { allowed: true, source: 'credits', remaining: credits.creditsCents }
  }

  // Anonymous - check system pause, rate limits, then free tier
  if (deviceId) {
    // Check if free tier is paused system-wide
    const paused = await isFreeTierPaused()
    if (paused) {
      return { allowed: false, reason: 'free_tier_paused' }
    }

    // Check rate limits (free tier only)
    const rateLimit = await checkRateLimits(deviceId)
    if (rateLimit.isLimited) {
      return {
        allowed: false,
        reason: 'rate_limited',
        retryAfter: rateLimit.reason === 'hourly' ? '1 hour' : 'tomorrow',
      }
    }

    // Check free tier balance
    const usage = await getAnonymousUsage(deviceId)
    if (usage.isExhausted) {
      return { allowed: false, reason: 'free_tier_exhausted' }
    }
    return { allowed: true, source: 'anonymous', remaining: usage.remaining }
  }

  // No device ID - shouldn't happen, but deny
  return { allowed: false, reason: 'free_tier_exhausted' }
}

// ============================================================
// RECONCILIATION
// ============================================================

/**
 * Get total spent across all Eachie users.
 * Used for reconciliation with OpenRouter actual charges.
 */
export async function getEachieTotals(): Promise<{
  totalSpentCents: number
  totalCreditsCents: number
  userCount: number
}> {
  const sql = getDb()

  const result = await sql`
    SELECT
      COALESCE(SUM(total_spent_cents), 0) as total_spent,
      COALESCE(SUM(credits_cents), 0) as total_credits,
      COUNT(*) as user_count
    FROM users
  ` as Array<{ total_spent: number; total_credits: number; user_count: number }>

  return {
    totalSpentCents: Number(result[0]?.total_spent ?? 0),
    totalCreditsCents: Number(result[0]?.total_credits ?? 0),
    userCount: Number(result[0]?.user_count ?? 0),
  }
}

// ============================================================
// SYSTEM-WIDE MONITORING
// ============================================================

/**
 * Get total cost across all anonymous users in the last N hours.
 * Used for system-wide abuse detection.
 */
export async function getRecentSystemCost(hoursAgo: number = 6): Promise<number> {
  const sql = getDb()
  const cutoff = new Date(Date.now() - hoursAgo * 60 * 60 * 1000)

  try {
    // Sum costs from conversation_rounds in the time window
    const result = await sql`
      SELECT COALESCE(SUM(cost_cents), 0) as total
      FROM conversation_rounds
      WHERE created_at >= ${cutoff}
    ` as Array<{ total: number }>
    return result[0]?.total ?? 0
  } catch {
    // Table might not exist yet
    return 0
  }
}

/**
 * Pause or unpause the free tier system-wide.
 */
export async function setFreeTierPaused(paused: boolean, reason?: string): Promise<void> {
  const sql = getDb()
  await sql`
    INSERT INTO system_state (key, value, updated_at)
    VALUES ('free_tier_paused', ${JSON.stringify({ paused, reason, timestamp: new Date().toISOString() })}::jsonb, NOW())
    ON CONFLICT (key) DO UPDATE SET
      value = ${JSON.stringify({ paused, reason, timestamp: new Date().toISOString() })}::jsonb,
      updated_at = NOW()
  `
}

/**
 * Log an abuse flag for monitoring.
 */
export async function logAbuseFlag(params: {
  deviceId?: string
  flagType: 'rate_limit' | 'cost_spike' | 'low_confidence' | 'system_alert'
  details?: Record<string, unknown>
}): Promise<void> {
  const sql = getDb()
  await sql`
    INSERT INTO abuse_flags (device_id, flag_type, details)
    VALUES (${params.deviceId ?? null}, ${params.flagType}, ${JSON.stringify(params.details ?? {})}::jsonb)
  `
}
