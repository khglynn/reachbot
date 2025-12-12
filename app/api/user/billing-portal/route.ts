/**
 * Billing Portal API
 *
 * Creates a Stripe Billing Portal session for the user to manage
 * their payment methods and billing info.
 *
 * If user has no Stripe customer, creates one first.
 *
 * Created: December 2024
 */

import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { getUser, setStripeCustomerId } from '@/server/queries/users'
import { getStripe } from '@/lib/stripe'

export async function POST() {
  const { userId } = await auth()

  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const user = await getUser(userId)

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    const stripe = getStripe()
    let stripeCustomerId = user.stripe_customer_id

    // Create Stripe customer if doesn't exist
    if (!stripeCustomerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        name: user.name || undefined,
        metadata: {
          clerk_user_id: userId,
        },
      })
      stripeCustomerId = customer.id
      await setStripeCustomerId(userId, stripeCustomerId)
    }

    // Create a billing portal session
    const session = await stripe.billingPortal.sessions.create({
      customer: stripeCustomerId,
      return_url: `${process.env.NEXT_PUBLIC_APP_URL}/settings`,
    })

    return NextResponse.json({ url: session.url })
  } catch (error) {
    console.error('[Billing Portal API] Error:', error)
    return NextResponse.json(
      { error: 'Failed to create billing portal session' },
      { status: 500 }
    )
  }
}
