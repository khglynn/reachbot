# Settings Page - Foundation Plan

**Created:** December 11, 2024
**Goal:** Build an extensible settings page that will grow over time

---

## Design Decisions

| Decision | Choice | Why |
|----------|--------|-----|
| Page vs Modal | **Full page at `/settings`** | More extensible as settings grow |
| Payment UI | **Stripe Customer Portal** | Redirect to hosted portal - less maintenance |
| BYOK users | **Show all with explanations** | Consistent experience, explain what doesn't apply |
| Protected route | **Yes** | Only authenticated users need settings |

---

## Architecture

### File Structure

```
app/
  settings/
    page.tsx              # Server component (auth + redirect)
    loading.tsx           # Skeleton loader

  api/
    user/
      settings/
        route.ts          # GET settings, PATCH updates
      billing-portal/
        route.ts          # Create Stripe portal session

src/
  components/
    settings/
      SettingsPage.tsx            # Main client wrapper
      SettingsSection.tsx         # Reusable section container
      AccountSection.tsx          # Account info + data controls (combined)
      PaymentSection.tsx          # Balance, card, auto top-up
      ResearchPreferencesSection.tsx  # Model config (from SettingsModal)
      ReferralsSection.tsx        # Placeholder for future
```

### Component Hierarchy

```
app/settings/page.tsx (Server - auth check)
  └── SettingsPage.tsx (Client - fetches data)
        ├── SettingsSection title="Account"
        │     └── AccountSection (email, sign out, export, delete)
        ├── SettingsSection title="Payment"
        │     └── PaymentSection
        ├── SettingsSection title="Research Preferences"
        │     └── ResearchPreferencesSection
        └── SettingsSection title="Referrals"
              └── ReferralsSection (placeholder)
```

---

## Implementation Steps

### Step 1: Create Reusable Section Component

**File:** `src/components/settings/SettingsSection.tsx`

```typescript
interface SettingsSectionProps {
  title: string
  icon?: React.ReactNode
  description?: string
  children: React.ReactNode
  badge?: string  // e.g., "BYOK" or "Coming Soon"
}
```

Follow pattern from `SettingsModal.tsx`:
- `chalk-frame` border
- Section header with icon
- `space-y-4` for content

### Step 2: Create Settings Page (Protected)

**File:** `app/settings/page.tsx`

```typescript
import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'

export default async function Settings() {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in?redirect_url=/settings')
  return <SettingsPage />
}
```

**File:** `app/settings/loading.tsx` - Skeleton loader

### Step 3: Create Settings API Endpoint

**File:** `app/api/user/settings/route.ts`

- `GET`: Return user settings (balance, auto-topup config, etc.)
- `PATCH`: Update auto-topup settings

Follow pattern from `/api/user/balance/route.ts`

### Step 4: Create Account Section (combined with Data)

**File:** `src/components/settings/AccountSection.tsx`

Shows:
- Email (from Clerk, read-only)
- Account created date
- Sign out button (uses Clerk's `signOut()`)
- **Export data button** (existing download functionality)
- **Delete all data button** (confirmation required)

**For BYOK users:** Export works for current session, explain no server data stored

### Step 5: Create Payment Section

**File:** `src/components/settings/PaymentSection.tsx`

Shows:
- Current balance (`credits_cents` formatted)
- Payment method status (has card / no card)
- "Manage Payment Method" button → Stripe Customer Portal
- Auto top-up toggle + settings (threshold, amount)

**For BYOK users:** "Using your own API key" + "Upgrade to Eachie Me" CTA (paid tier with data sync, server keys, 1.5% markup)

### Step 6: Create Billing Portal Endpoint

**File:** `app/api/user/billing-portal/route.ts`

```typescript
const session = await stripe.billingPortal.sessions.create({
  customer: user.stripe_customer_id,
  return_url: `${process.env.NEXT_PUBLIC_APP_URL}/settings`,
})
return NextResponse.json({ url: session.url })
```

### Step 7: Create Research Preferences Section

**File:** `src/components/settings/ResearchPreferencesSection.tsx`

**Now (migrate from SettingsModal):**
- Summary Model selector (orchestrator)
- Summary Prompt customization
- Model visibility (show/hide individual models)

**Future placeholders:**
- Default models to auto-select
- Auto-add new models from OpenRouter
- Model presets

This section moves research config from the modal to a dedicated place, keeping the modal lighter.

### Step 8: Create Referrals Section (Placeholder)

**File:** `src/components/settings/ReferralsSection.tsx`

"Coming soon" placeholder with brief teaser about friend codes ($6 each for you and a friend)

### Step 9: Wire Up Main Page

**File:** `src/components/settings/SettingsPage.tsx`

- `'use client'`
- Fetch settings from `/api/user/settings`
- Detect BYOK mode from URL params
- Manage research preferences state (from localStorage, like current SettingsModal)
- Pass data to each section
- Handle loading/error states

---

## Key Patterns to Follow

| Pattern | Source File | What to Copy |
|---------|-------------|--------------|
| Section layout | `SettingsModal.tsx:106-244` | `<section>` with h3 + description |
| Save notification | `SettingsModal.tsx:46-66` | "Saved" toast with timeout |
| Input styling | `SettingsModal.tsx:133-139` | `border-paper-accent/30` inputs |
| Info boxes | `SettingsModal.tsx:108-115` | `bg-paper-surface/50` boxes |
| Button grid | `SettingsModal.tsx:164-189` | 2-column grid for options |
| Protected API route | `balance/route.ts` | `auth()` + userId check |

---

## BYOK Handling

Each section checks `isByok` prop and shows appropriate content:

| Section | Regular User (Eachie Me) | BYOK User |
|---------|--------------------------|-----------|
| Account | Full info + sign out + export + delete | Same (export = current session, delete = minimal server data) |
| Payment | Balance + card + auto-topup | "Using your own API key" + "Upgrade to Eachie Me" CTA |
| Research Preferences | Full config | Same |
| Referrals | Friend code (future) | Same (can refer friends to Eachie Me) |

**Branding:** "Eachie Me" = paid tier with data sync, server keys, 1.5% markup on API costs.

---

## Edge Cases to Handle

1. **User not in DB yet** (Clerk webhook pending): Show loading or "Setting up your account..."
2. **No Stripe customer** (never purchased): Show "Add payment method" instead of portal link
3. **Auto-topup without saved card**: Disable toggle, prompt to add card first
4. **Delete confirmation**: Two-step - click button, then type "DELETE" to confirm

---

## Files to Modify (Existing)

| File | Change |
|------|--------|
| `src/server/queries/users.ts` | Add `getUserSettings()` helper |
| `src/types/index.ts` | Add `UserSettings` interface |
| `middleware.ts` | (Optional) Add `/settings` to protected routes |

---

## Not In Scope (Future)

- Data retention period selector (needs schema change)
- Delete data API endpoint (Part 2: Legal Compliance)
- Actual friend codes (Part 5 on roadmap)
- Chat history display (Part 3 on roadmap)

---

## Success Criteria

- [ ] Settings page loads at `/settings` for authenticated users
- [ ] Unauthenticated users redirect to sign-in
- [ ] **Account:** Email, sign out, export data, delete data (with confirmation)
- [ ] **Payment:** Balance display, Stripe portal link, auto top-up toggle
- [ ] **Research Preferences:** Orchestrator selector, prompt editor, model visibility
- [ ] BYOK users see "Upgrade to Eachie Me" CTAs where appropriate
- [ ] Page follows chalk design system
- [ ] SettingsSection component is reusable for future additions
