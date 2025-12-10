# Plan 1: Stripe, Auth & Usage Tracking

**Created:** December 2024
**Status:** Part 1 Complete, Parts 2-3 Pending

---

## Overview

Three-part implementation for monetization and user management.

---

## Part 1: Anonymous Usage Tracking ✅ COMPLETE

All items committed to git on `dev` branch.

| Item | Status | File |
|------|--------|------|
| FingerprintJS setup | ✅ Done | `src/lib/fingerprint.ts` |
| useDeviceId hook | ✅ Done | `src/hooks/useDeviceId.ts` |
| $12 free tier tracking | ✅ Done | `src/server/queries/usage.ts` |
| Rate limiting (20/hr, 100/day) | ✅ Done | `src/server/queries/usage.ts` |
| Abuse flags table | ✅ Done | `src/server/schema.sql` |
| System circuit breaker | ✅ Done | `src/server/schema.sql` |
| Centralized messages | ✅ Done | `src/config/messages.ts` |
| Draft preservation | ✅ Done | `src/hooks/useDraftPreservation.ts` |
| beforeunload warning | ✅ Done | `app/page.tsx` |

### How It Works

1. **Device Fingerprinting**: FingerprintJS generates stable `visitorId` per device
2. **Usage Tracking**: `anonymous_usage` table tracks cost per device
3. **Free Tier**: $12 (1200 cents) free usage per device
4. **Rate Limiting**: 20 requests/hour, 100 requests/day
5. **Circuit Breaker**: `system_state` table can pause free tier globally

---

## Part 2: Clerk Authentication ⏳ PENDING

| Item | Files |
|------|-------|
| Install @clerk/nextjs | package.json |
| Add ClerkProvider | app/layout.tsx |
| Auth middleware | middleware.ts |
| Sign in/up flows | app/sign-in/, app/sign-up/ |
| User webhook sync | app/api/webhooks/clerk/route.ts |
| Link device to user on signup | src/server/queries/users.ts |

### Key Decisions
- Use Clerk's hosted pages (faster to implement)
- Webhook syncs user data to our `users` table
- On signup, link `device_id` to migrate free tier usage

---

## Part 3: Stripe Payments ⏳ PENDING

| Item | Files |
|------|-------|
| Stripe checkout for credits | app/api/checkout/route.ts |
| Webhook for payment events | app/api/webhooks/stripe/route.ts |
| Auto top-up setting | src/server/queries/users.ts |
| Credit balance display | src/components/BalanceDisplay.tsx |
| Upgrade prompt on limit | src/components/UpgradePrompt.tsx |

### Pricing Model
- Credits purchased in dollar amounts ($5, $10, $25, $50)
- Auto top-up option when balance < $2
- No subscriptions (pay-as-you-go only)

---

## Dependencies

- **Part 2 depends on**: Part 1 (device tracking for migration)
- **Part 3 depends on**: Part 2 (need user accounts for credits)

---

## Related Plans

- **Plan 2**: Chat History, Legal, Friend Codes (depends on this)
- **Plan 3**: Storybook Component Library (independent)
- **Analytics Schema**: Database redesign for better analytics (can run in parallel)
