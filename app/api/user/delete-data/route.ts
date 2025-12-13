/**
 * Delete User Data API
 *
 * DELETE: Permanently deletes all user data (GDPR/CCPA compliance)
 *
 * What gets deleted:
 * - User record (triggers CASCADE for sessions, conversation_rounds)
 * - Anonymous usage linked to user's device
 *
 * What gets anonymized (SET NULL):
 * - research_queries.user_id (keeps analytics data)
 * - invite_codes.created_by / redeemed_by
 *
 * What is NOT deleted:
 * - Stripe customer (for refunds/billing history)
 * - Clerk account (user deletes separately via Clerk UI)
 * - abuse_flags (security audit trail)
 *
 * Requires authentication.
 *
 * Created: December 2024
 */

import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { getDb } from '@/server/db'
import { getUser } from '@/server/queries/users'

export async function DELETE() {
  const { userId } = await auth()

  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // Get user to find linked device_id
    const user = await getUser(userId)

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    const sql = getDb()

    // Run deletions sequentially (Neon HTTP driver doesn't support transactions)
    // Order matters: anonymize first, then delete user (which cascades)

    // 1. Anonymize research_queries (keep for analytics, just remove user link)
    await sql`
      UPDATE research_queries
      SET user_id = NULL
      WHERE user_id = ${userId}
    `

    // 2. Anonymize invite_codes (keep code history)
    await sql`
      UPDATE invite_codes
      SET created_by = NULL
      WHERE created_by = ${userId}
    `
    await sql`
      UPDATE invite_codes
      SET redeemed_by = NULL
      WHERE redeemed_by = ${userId}
    `

    // 3. Delete anonymous_usage if user had a linked device
    if (user.device_id) {
      await sql`
        DELETE FROM anonymous_usage
        WHERE device_id = ${user.device_id}
      `
    }

    // 4. Delete user (CASCADE handles sessions, conversation_rounds)
    await sql`
      DELETE FROM users
      WHERE id = ${userId}
    `

    console.log(`[Delete Data] User ${userId} data deleted successfully`)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[Delete Data] Error:', error)
    return NextResponse.json(
      { error: 'Failed to delete data. Please try again.' },
      { status: 500 }
    )
  }
}
