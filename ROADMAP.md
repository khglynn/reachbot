# Roadmap

What's next, in order. When done, move to `COMPLETED.md`.

---

## 1. Settings Page
**Plan:** `claude-plans/2024-12-11-settings-page-foundation.md`

User settings UI - foundation for everything below.

**Sections:**
- **Account** - email, sign out, export data, delete data
- **Payment** - balance, Stripe portal, auto top-up (BYOK: "Upgrade to Eachie Me" CTA)
- **Research Preferences** - orchestrator, prompt, model visibility (migrated from SettingsModal)
- **Referrals** - placeholder for friend codes

**Files to create:**
- `app/settings/page.tsx` + `loading.tsx`
- `app/api/user/settings/route.ts`
- `app/api/user/billing-portal/route.ts`
- `src/components/settings/` (6 components)

---

## 2. Legal Compliance
**Plan:** `claude-plans/2024-12-10-chat-history-legal-friends.md` (Part 2)

Must exist BEFORE we store user content (chat history).

**What:**
- Update privacy policy with data storage disclosure
- Update terms of service
- "Delete My Data" endpoint + UI in settings
- GDPR/CCPA compliance (right to access, delete, retention limits)

**Files to create/modify:**
- `app/privacy/page.tsx` - Update
- `app/terms/page.tsx` - Update
- `app/api/user/delete-data/route.ts` - New

---

## 3. Chat History
**Plan:** `claude-plans/2024-12-10-chat-history-legal-friends.md` (Part 1)

Server-side session storage for paid users. BYOK stays client-side only.

**What:**
- Auto-save sessions after research completion
- History sidebar/modal to load previous sessions
- Session title generation from first query
- Retention settings (6mo default, 5yr max)

**Files to create:**
- `app/api/sessions/route.ts`
- `app/api/sessions/[id]/route.ts`
- `src/components/ChatHistory.tsx`
- `src/components/SessionCard.tsx`

---

## 4. Analytics Schema
**Plan:** `claude-plans/2024-12-10-analytics-schema.md`

Better data for insights and decision-making.

**What:**
- New tables: `research_queries`, `model_calls`, `dim_models`, `dim_dates`
- Write analytics data from research API
- PostHog events for behavioral tracking
- Model sync cron job

**Files to create:**
- `src/server/queries/analytics.ts`
- `src/server/queries/models.ts`
- `app/api/cron/sync-models/route.ts`

---

## 5. Friend Codes
**Plan:** `claude-plans/2024-12-10-chat-history-legal-friends.md` (Part 3)

Growth feature - both parties get $6 when code redeemed.

**What:**
- 6 invites per user max
- Free tier balance carries over on signup
- Referral UI in settings page

**Files to create:**
- `app/api/referral/code/route.ts`
- `app/api/referral/redeem/route.ts`
- `src/components/ReferralSection.tsx`
- `src/components/RedeemCode.tsx`

---

## Future

| Feature | Plan |
|---------|------|
| Storybook Component Library | `claude-plans/2024-12-10-storybook-component-library.md` |

---

## Optional Infrastructure

Services we've evaluated but haven't implemented. Consider when needs arise.

| Service | What | When to Consider |
|---------|------|------------------|
| **Cloudflare Turnstile** | Privacy-friendly CAPTCHA (free) | If bot abuse becomes a problem on forms/API |
| **Cloudflare Email Routing** | Forward hello@eachie.ai → Gmail (free) | When we need a support email address |
