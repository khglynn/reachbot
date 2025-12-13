# Roadmap

What's next, in order. When done, move to `COMPLETED.md`.

---

## 1. Legal Compliance
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

## 2. Friend Codes
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

## 3. Image Generation Mode

Mode toggle: `text ↔ image`. Send prompt to multiple image models, compare results in grid.

---

## 4. Chat History
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

## 5. Model Customization
**Plan:** `claude-plans/2024-12-12-model-customization.md`

Let users add models, set defaults, browse model capabilities and pricing. Also publish enriched model table as free SEO/AEO resource at `/models`.


---

## 6. Storybook Component Library
| `claude-plans/2024-12-10-storybook-component-library.md` |

---

## 7. Model Packs

Curated model + prompt combos for use cases: Go Wide, Go Deep, Creative, Technical, Fast.

---

## 8. API / MCP

REST API and MCP server for programmatic/agent access to multi-model research.

---

## Optional Infrastructure

Services we've evaluated but haven't implemented. Consider when needs arise.

| Service | What | When to Consider |
|---------|------|------------------|
| **Cloudflare Turnstile** | Privacy-friendly CAPTCHA (free) | If bot abuse becomes a problem on forms/API |
| **Cloudflare Email Routing** | Forward hello@eachie.ai → Gmail (free) | When we need a support email address |
