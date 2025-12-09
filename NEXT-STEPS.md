# Eachie - Next Steps

## Current Status

**Design System:** Complete
- Paper color palette in `tailwind.config.js`
- Chalk icons in `src/components/ChalkIcons.tsx`
- Chalk frame borders via CSS classes
- Spider logo favicon

**Core Features:** Complete
- Multi-model research with parallel queries
- Real-time progress via SSE streaming
- Synthesis with configurable orchestrator
- File attachments (images, PDFs, text)
- Voice input via Whisper
- Download as ZIP for Obsidian

---

## Phase 1: Database & Authentication

### 1.1 Neon Database Setup

```bash
# In project directory
npx neonctl@latest init
```

This will:
- Open browser for Neon auth
- Create project (or select existing)
- Add `DATABASE_URL` to `.env.local`

### 1.2 Database Schema

```sql
-- Anonymous usage tracking (pre-auth) - cost-based free tier
CREATE TABLE anonymous_usage (
  device_id VARCHAR(64) PRIMARY KEY,
  total_cost_cents INTEGER DEFAULT 0,
  first_seen TIMESTAMP DEFAULT NOW(),
  last_seen TIMESTAMP DEFAULT NOW()
);

-- Users (synced from Clerk via webhook)
CREATE TABLE users (
  id VARCHAR(64) PRIMARY KEY,
  email VARCHAR(255) UNIQUE,
  name VARCHAR(255),
  credits_cents INTEGER DEFAULT 0,
  total_spent_cents INTEGER DEFAULT 0,
  stripe_customer_id VARCHAR(64),
  redeemed_code VARCHAR(32),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Research Sessions (persist conversations)
CREATE TABLE sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR(64) REFERENCES users(id) ON DELETE CASCADE,
  device_id VARCHAR(64),
  title VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Conversation Rounds
CREATE TABLE conversation_rounds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES sessions(id) ON DELETE CASCADE,
  round_number INTEGER,
  query TEXT,
  synthesis TEXT,
  model_responses JSONB,
  cost_cents INTEGER,
  is_estimated BOOLEAN DEFAULT false,
  orchestrator VARCHAR(100),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Friend invite codes ($12, $24, $36 tiers)
CREATE TABLE invite_codes (
  code VARCHAR(32) PRIMARY KEY,
  created_by VARCHAR(64) REFERENCES users(id),
  credits_cents INTEGER NOT NULL,
  redeemed_by VARCHAR(64) REFERENCES users(id),
  redeemed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  CONSTRAINT valid_credit_amount CHECK (credits_cents IN (1200, 2400, 3600))
);

CREATE INDEX idx_sessions_user ON sessions(user_id);
CREATE INDEX idx_sessions_device ON sessions(device_id);
CREATE INDEX idx_rounds_session ON conversation_rounds(session_id);
```

### 1.3 Clerk Authentication

```bash
npm install @clerk/nextjs
```

Add to `.env.local`:
```
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_...
CLERK_SECRET_KEY=sk_...
```

Create `middleware.ts` for protected routes.

---

## Phase 2: Cost-Based Free Tier

### 2.1 Free Tier Logic

- **$12 free usage** (1200 cents) per device
- Track actual costs using `src/lib/pricing.ts`
- Show upgrade prompt when limit reached

### 2.2 Device Fingerprinting

```bash
npm install @fingerprintjs/fingerprintjs
```

Create `src/lib/device-id.ts` for anonymous tracking.

### 2.3 Usage Checks

In `/api/research/stream`:
1. Check usage before research (budget available?)
2. Update cost after research completes

---

## Phase 3: Friend Credits

### 3.1 Invite Codes

- $12, $24, or $36 denominations
- One code per account
- Maximum $72 off total

### 3.2 Redemption API

Create `/api/redeem-code` endpoint:
1. Validate code exists and unredeemed
2. Check user hasn't already redeemed
3. Add credits to user account
4. Mark code as redeemed

---

## Phase 4: Payments (Stripe)

### 4.1 Credit Purchases

- Top-up credits when balance runs low
- Show cost per query estimate in UI

### 4.2 Stripe Integration

```bash
npm install stripe @stripe/stripe-js
```

Create:
- `/api/stripe/checkout` - Create checkout session
- `/api/stripe/webhook` - Handle payment completion

---

## Phase 5: Legal Pages

### 5.1 Required Pages

| Route | Purpose |
|-------|---------|
| `/terms` | Terms of Service |
| `/privacy` | Privacy Policy |
| `/refunds` | Refund Policy |

### 5.2 Footer Links

Add to main page:
```tsx
<footer className="text-center text-xs text-paper-muted">
  <a href="/terms">Terms</a> · <a href="/privacy">Privacy</a> · <a href="/refunds">Refunds</a>
</footer>
```

---

## Files to Create

| Path | Purpose |
|------|---------|
| `src/server/db.ts` | Neon database client |
| `src/lib/device-id.ts` | Device fingerprinting |
| `src/server/queries/` | Database operations |
| `middleware.ts` | Clerk auth enforcement |
| `app/terms/page.tsx` | Terms of Service |
| `app/privacy/page.tsx` | Privacy Policy |
| `app/refunds/page.tsx` | Refund Policy |
| `app/api/redeem-code/route.ts` | Friend code redemption |
| `app/api/stripe/checkout/route.ts` | Stripe checkout |
| `app/api/stripe/webhook/route.ts` | Stripe webhook |

---

## Customization Quick Reference

| What | Where |
|------|-------|
| Colors | `tailwind.config.js:10-42` |
| Icons | `src/components/ChalkIcons.tsx` |
| Chalk filter | `app/layout.tsx:30-38` |
| Logo/favicon | `public/` folder |
| Models | `src/config/models.ts` |
| Pricing | `src/lib/pricing.ts` |

---

## Estimated Effort

| Phase | Time |
|-------|------|
| Database setup | 1 day |
| Clerk auth | 1 day |
| Free tier logic | 1 day |
| Friend credits | 0.5 day |
| Stripe integration | 1 day |
| Legal pages | 0.5 day |
| Testing & polish | 1 day |
| **Total** | **~6 days** |
