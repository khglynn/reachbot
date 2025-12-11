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

/** Threshold for super_admin spending alerts (in cents) */
const SUPER_ADMIN_ALERT_THRESHOLD_CENTS = 5000 // $50

/**
 * Send a Slack notification for super_admin spending alerts.
 */
async function sendSlackAlert(message: string): Promise<void> {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL
  if (!webhookUrl) {
    console.warn('[Slack] No SLACK_WEBHOOK_URL configured, skipping alert:', message)
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
 * Super admins: track spending but don't deduct credits, alert if > $50.
 * Regular users: deduct from balance, return false if insufficient.
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
  const sql = getDb()

  // Check current balance and admin status
  const current = await getUserCredits(userId)
  if (!current) {
    return { success: false, creditsCents: 0, message: 'User not found' }
  }

  // Super admins: track spending but don't deduct credits
  if (current.isSuperAdmin) {
    const result = await sql`
      UPDATE users
      SET total_spent_cents = total_spent_cents + ${costCents}
      WHERE id = ${userId}
      RETURNING total_spent_cents, email
    ` as Array<{ total_spent_cents: number; email: string }>

    const newTotal = result[0]?.total_spent_cents ?? 0
    const previousTotal = newTotal - costCents

    // Alert if crossed $50 threshold
    if (previousTotal < SUPER_ADMIN_ALERT_THRESHOLD_CENTS && newTotal >= SUPER_ADMIN_ALERT_THRESHOLD_CENTS) {
      const email = result[0]?.email ?? 'unknown'
      sendSlackAlert(`🚨 Super admin ${email} has spent $${(newTotal / 100).toFixed(2)} this period`)
    }

    return {
      success: true,
      creditsCents: current.creditsCents, // Unchanged for super admins
    }
  }

  // Regular users: check balance and deduct
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
    RETURNING credits_cents
  ` as User[]

  if (result.length === 0) {
    // Race condition: balance changed between check and update
    return {
      success: false,
      creditsCents: current.creditsCents,
      message: 'Insufficient credits',
    }
  }

  return {
    success: true,
    creditsCents: result[0].credits_cents,
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

// ============================================================
// USAGE CHECK (Pre-query validation)
// ============================================================

export type UsageCheckResult =
  | { allowed: true; source: 'byok' }
  | { allowed: true; source: 'super_admin'; totalSpent: number }
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

  // Authenticated user - check super_admin first, then credits
  if (userId) {
    const credits = await getUserCredits(userId)

    // Super admins bypass credit checks entirely
    if (credits?.isSuperAdmin) {
      return { allowed: true, source: 'super_admin', totalSpent: credits.totalSpentCents }
    }

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
