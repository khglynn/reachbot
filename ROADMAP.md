# Roadmap

What's next, in order. When done, move to `COMPLETED.md`.

---

## 1. Image Generation Mode

Mode toggle: `text ↔ image`. Send prompt to multiple image models, compare results in grid.

---

## 2. Chat History
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

## 3. Model Customization
**Plan:** `claude-plans/2024-12-12-model-customization.md`

Let users add models, set defaults, browse model capabilities and pricing. Also publish enriched model table as free SEO/AEO resource at `/models`.


---

## 4. Storybook Component Library
| `claude-plans/2024-12-10-storybook-component-library.md` |

---

## 5. Model Packs

Curated model + prompt combos for use cases: Go Wide, Go Deep, Creative, Technical, Fast.

---

## 6. API / MCP

REST API and MCP server for programmatic/agent access to multi-model research.

---

## Optional Infrastructure

Services we've evaluated but haven't implemented. Consider when needs arise.

| Service | What | When to Consider |
|---------|------|------------------|
| **Cloudflare Turnstile** | Privacy-friendly CAPTCHA (free) | If bot abuse becomes a problem on forms/API |
| **Cloudflare Email Routing** | Forward hello@eachie.ai → Gmail (free) | When we need a support email address |
