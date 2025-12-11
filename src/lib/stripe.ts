/**
 * Stripe Client - Auto Top-Up Flow
 *
 * Handles payment method setup and auto-charging for paid tier users.
 * This is NOT a traditional checkout flow - users save a card once,
 * then we auto-charge when their balance drops below a threshold.
 *
 * Flow:
 * 1. User signs up for paid tier → SetupIntent saves their card
 * 2. User makes queries → credits deducted from balance
 * 3. Balance drops below threshold → PaymentIntent auto-charges saved card
 * 4. Credits added to balance → repeat from step 2
 *
 * This is how Anthropic, OpenAI, and other API providers handle billing.
 *
 * Created: December 2024
 */

import Stripe from 'stripe'

// Lazy-initialize Stripe client (server-side only)
// Prevents build-time errors when env vars aren't available
let _stripe: Stripe | null = null

export function getStripe(): Stripe {
  if (!_stripe) {
    if (!process.env.STRIPE_SECRET_KEY) {
      throw new Error('STRIPE_SECRET_KEY not configured')
    }
    _stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: '2025-11-17.clover',
    })
  }
  return _stripe
}

/**
 * Check if Stripe is configured.
 */
export function isStripeConfigured(): boolean {
  return Boolean(
    process.env.STRIPE_SECRET_KEY &&
      process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
  )
}

/**
 * Format cents as dollars for display.
 */
export function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`
}

// ============================================================
// CUSTOMER MANAGEMENT
// ============================================================

/**
 * Create a Stripe customer for a user.
 * Called when user first sets up payment method.
 */
export async function createCustomer(params: {
  email: string
  name?: string
  clerkUserId: string
}): Promise<Stripe.Customer> {
  const stripe = getStripe()

  return stripe.customers.create({
    email: params.email,
    name: params.name,
    metadata: {
      clerkUserId: params.clerkUserId,
    },
  })
}

/**
 * Get a Stripe customer by ID.
 */
export async function getCustomer(
  customerId: string
): Promise<Stripe.Customer | null> {
  const stripe = getStripe()

  try {
    const customer = await stripe.customers.retrieve(customerId)
    if (customer.deleted) return null
    return customer as Stripe.Customer
  } catch {
    return null
  }
}

// ============================================================
// PAYMENT METHOD SETUP (First-time card save)
// ============================================================

/**
 * Create a SetupIntent to save a payment method.
 * This is used when user first adds their card.
 *
 * Returns a client_secret to pass to Stripe.js on the frontend.
 */
export async function createSetupIntent(
  customerId: string
): Promise<Stripe.SetupIntent> {
  const stripe = getStripe()

  return stripe.setupIntents.create({
    customer: customerId,
    payment_method_types: ['card'],
    usage: 'off_session', // Allow charging when user is not present
  })
}

/**
 * Set a payment method as the default for a customer.
 */
export async function setDefaultPaymentMethod(
  customerId: string,
  paymentMethodId: string
): Promise<void> {
  const stripe = getStripe()

  await stripe.customers.update(customerId, {
    invoice_settings: {
      default_payment_method: paymentMethodId,
    },
  })
}

// ============================================================
// AUTO TOP-UP CHARGING
// ============================================================

/**
 * Charge a saved payment method (auto top-up).
 * Called when user's balance drops below threshold.
 *
 * @param params.customerId - Stripe customer ID
 * @param params.paymentMethodId - Saved payment method ID
 * @param params.amountCents - Amount to charge in cents
 * @param params.clerkUserId - For metadata/tracking
 * @returns PaymentIntent (check status for success/failure)
 */
export async function chargeAutoTopup(params: {
  customerId: string
  paymentMethodId: string
  amountCents: number
  clerkUserId: string
}): Promise<Stripe.PaymentIntent> {
  const stripe = getStripe()

  return stripe.paymentIntents.create({
    amount: params.amountCents,
    currency: 'usd',
    customer: params.customerId,
    payment_method: params.paymentMethodId,
    off_session: true, // Charge without user present
    confirm: true, // Immediately attempt charge
    description: `Eachie Me - Auto top-up ${formatCents(params.amountCents)}`,
    metadata: {
      clerkUserId: params.clerkUserId,
      type: 'auto_topup',
      creditsCents: params.amountCents.toString(),
    },
  })
}

/**
 * Create a one-time charge for initial top-up (with user present).
 * Used when user first adds credits after setting up payment method.
 */
export async function chargeInitialTopup(params: {
  customerId: string
  paymentMethodId: string
  amountCents: number
  clerkUserId: string
}): Promise<Stripe.PaymentIntent> {
  const stripe = getStripe()

  return stripe.paymentIntents.create({
    amount: params.amountCents,
    currency: 'usd',
    customer: params.customerId,
    payment_method: params.paymentMethodId,
    confirm: true,
    description: `Eachie Me - Initial top-up ${formatCents(params.amountCents)}`,
    metadata: {
      clerkUserId: params.clerkUserId,
      type: 'initial_topup',
      creditsCents: params.amountCents.toString(),
    },
  })
}

// ============================================================
// WEBHOOK SIGNATURE VERIFICATION
// ============================================================

/**
 * Verify webhook signature.
 * Call this in your webhook handler.
 */
export function verifyWebhookSignature(
  payload: string,
  signature: string
): Stripe.Event {
  const stripe = getStripe()

  return stripe.webhooks.constructEvent(
    payload,
    signature,
    process.env.STRIPE_WEBHOOK_SECRET!
  )
}

// ============================================================
// CREDIT PACKAGES (for UpgradePrompt)
// ============================================================

export interface CreditPackage {
  id: string
  name: string
  credits_cents: number  // Credits in cents
  price_cents: number    // Price in cents
  bonus?: number         // Bonus percentage
  popular?: boolean
}

/**
 * Available credit packages for purchase.
 */
export const CREDIT_PACKAGES: CreditPackage[] = [
  { id: 'starter', name: 'Starter', credits_cents: 500, price_cents: 500 },           // $5 = $5 credits
  { id: 'basic', name: 'Basic', credits_cents: 1200, price_cents: 1000, bonus: 20 },  // $10 = $12 credits (20% bonus)
  { id: 'plus', name: 'Plus', credits_cents: 3000, price_cents: 2000, bonus: 50, popular: true }, // $20 = $30 credits (50% bonus)
  { id: 'pro', name: 'Pro', credits_cents: 7500, price_cents: 5000, bonus: 50 },      // $50 = $75 credits (50% bonus)
]

/**
 * Get bonus percentage for a package.
 */
export function getBonusPercent(pkg: CreditPackage): number {
  return pkg.bonus ?? 0
}

// ============================================================
// DEFAULTS
// ============================================================

/**
 * Default auto top-up settings.
 */
export const AUTO_TOPUP_DEFAULTS = {
  thresholdCents: 600, // $6 - trigger when balance drops below this
  amountCents: 2400, // $24 - amount to charge
}

/**
 * Minimum top-up amount (Stripe minimum is $0.50)
 */
export const MIN_TOPUP_CENTS = 500 // $5

/**
 * Maximum single top-up amount
 */
export const MAX_TOPUP_CENTS = 50000 // $500
