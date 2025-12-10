# Eachie - Agent Instructions

*Inherits from ~/DevKev/CLAUDE.md*

## What This Is

A multi-model research orchestrator. Queries multiple AI models in parallel, then synthesizes their responses into unified insights. BYOK mode lets friends use it with their own API keys.

**Character:** Eachie is a friendly academic spider, drawn with chalk. She casts a wide net - weaving together responses from across the web into something more useful than any single source.

## First Backend Project

This is Kevin's first app built with Claude Code that has:
- **Stored backend database** (Neon Postgres)
- **Payment handling** (Stripe)
- **User accounts** (Clerk)

Because of this, we often go down rabbit holes on documentation and best practices. **This is expected and valuable.** The patterns we establish here become templates for future projects.

### For Future Claude Instances

When working on Eachie, consider:
1. **Check `claude-plans/`** - Implementation roadmaps live here. Read them before starting related work.
2. **Document decisions** - When we figure out a pattern (schema design, error handling, auth flow), capture it so future sessions don't re-derive it.
3. **Flag learning moments** - If Kevin and Claude work through something tricky, suggest saving the approach to `~/.mux/src/HG-Skills-Public/hg-skills/` for reuse.
4. **Analytics thinking** - For new features, ask: "What questions might we want to answer about this later?" Design data capture accordingly.

### Tool Responsibilities

| Tool | Primary Purpose |
|------|-----------------|
| **Database** | Transactional data, costs, model usage, user accounts |
| **PostHog** | In-app behavior, funnels, session replays, traffic sources (Web Analytics) |
| **Stripe** | Revenue, subscriptions, payment analytics |
| **Canny** | Feature requests, user feedback |

## The Vibe

Approachable academic. Eachie helps people do wide-ranging research by connecting points across different models and approaches. Not a power-user tool - a helpful research companion.

## Copy Style

Warm, clear, curious. Educational without being condescending. Eachie genuinely wants to help you find what you're looking for.

## Tech Stack
- Next.js 15 / React 19 / TypeScript
- Vercel AI SDK + OpenRouter (single API for all models)
- TailwindCSS
- Vercel Fluid Compute (long timeouts for deep research)

## Integrations

| Service | Purpose | Status |
|---------|---------|--------|
| **OpenRouter** | API gateway for all AI models | Active |
| **Claude Code** | All dev work, debugging | Active |
| **FingerprintJS** | Device fingerprinting for anonymous usage tracking | Active (free tier) |
| **Neon** | Database (Postgres) - usage tracking, sessions | Active |
| **PostHog** | Session tracking, analytics | Active |
| **Sentry** | Error tracking | Active |
| **Clerk** | Account management, auth | Planned |
| **Stripe** | Payment processing, auto top-up | Planned |
| **Canny** | Feature requests | Active (eachie.canny.io) |

## Key Files

| File | Purpose |
|------|---------|
| `/app/page.tsx` | Main app flow |
| `/src/config/models.ts` | Model configuration |
| `/src/config/messages.ts` | All user-facing messages (single source of truth) |
| `/src/lib/research.ts` | Query + synthesis logic |
| `/src/lib/fingerprint.ts` | Device fingerprinting |
| `/src/server/queries/usage.ts` | Usage tracking, rate limiting |
| `/src/server/schema.sql` | Database schema |
| `/src/types/index.ts` | TypeScript interfaces |
| **`ORCHESTRATION.md`** | How the research flow works (keep updated!) |

## Orchestration Reference

See `ORCHESTRATION.md` for the full breakdown of:
- What each model sees at each stage
- Exact prompts (research, clarifying, synthesis)
- Follow-up context handling
- Attachment handling

**Update ORCHESTRATION.md whenever prompts or flow changes.**

## Git Workflow

Solo project - no PRs needed. Work on `dev`, merge to `main` when ready:

```bash
# Day-to-day work
git checkout dev
# ... make changes, commit, push ...
# → deploys to test.eachie.ai

# Deploy to production
git checkout main && git merge dev && git push
# → deploys to eachie.ai
git checkout dev  # back to working
```

## Legal & Compliance

Public-facing app with free tier that generates revenue. Based in Texas, distributed globally.

**Keep in mind:**
- GDPR (European users) - cookie consent, data handling, right to deletion
- Privacy policy and terms of service required
- Payment disclosures (Stripe)
- API key handling (BYOK mode stores keys in localStorage, not on server)

## Project-Specific Notes
- OpenRouter is the gateway for all models
- Some models have "thinking" variants (o3, Grok Fast)
- Cost tracking happens per-model in research.ts

## Design System: Chalk Aesthetic

Eachie blends a chalk/hand-drawn look with modern web app usability. **Don't go too far in either direction.**

### UX Design Philosophy
Be a thoughtful UX designer balancing function with creative flair:
- **Function first** - UI must be usable, accessible, clear
- **Selective flair** - Chalk effects add personality without hurting usability
- **Enabled appearance** - Use cream (#F2F2F2 / `paper-text`) strategically so elements look enabled, not blue-on-blue disabled
- **Visual hierarchy** - Darker backgrounds push forward, lighter elements draw attention

### Where Chalk Effects Apply
| Element | Chalk Effect? | Notes |
|---------|--------------|-------|
| Main container borders | Yes | `.chalk-frame` class in globals.css |
| Divider lines | Yes (subtle) | Use `border-paper-divider` |
| Progress bar | Yes | `ChalkProgressBar` component |
| Blinking cursor | Yes | If implemented |
| **Icons** | No | Clean SVG icons, no filter |
| **Text** | No | Normal font rendering |
| **Button outlines** | No | Clean borders |
| **Form inputs** | No | Clean, usable |

### Color Palette (`paper-*`)
All colors defined in `tailwind.config.js` under `paper.*`:
- `paper-bg` - Primary background (deepest navy #020F59)
- `paper-card` - Card backgrounds (deep navy #021373)
- `paper-surface` - Elevated surfaces, highlights (#03178C)
- `paper-accent` - Borders, links, interactive elements (#91AAF2)
- `paper-text` - Primary text / cream (#F2F2F2) - use for "enabled" look
- `paper-muted` - Secondary text (#8BA3E6)
- `paper-divider` - Subtle lines (accent at 20% opacity)
- `paper-error/warning/success` - Semantic colors

### Chalk Animation Reference
See `/docs/design/` for advanced chalk effects:
- `chalk-animation-technique.md` - SVG stroke animation + chalk filter
- `chalk-loader-combined.html` - Interactive demo

### CSS Classes
```css
.chalk-frame           /* Border only, no filter (use for most containers) */
.chalk-frame-filtered  /* With SVG filter - affects ALL content inside! */
.chalk-frame-light     /* Subtle variant for nested elements */
```

### Important Notes
- SVG `filter: url(#chalk)` affects the entire element including children
- Only use `-filtered` variant on elements where wobbly content is OK
- Icons in `ChalkIcons.tsx` are clean (no filter) for readability

## Customization Guide

Quick reference for making changes to visual elements.

### Where Things Live

| What to Change | Where | How |
|----------------|-------|-----|
| **Colors** | `tailwind.config.js:10-42` | Edit `paper.*` values |
| **Icons** | `src/components/ChalkIcons.tsx` | Add/edit SVG functions |
| **Chalk filter** | `app/layout.tsx:30-38` | Modify SVG filter params |
| **Logo/favicon** | `public/` folder | Replace PNG files |
| **Models** | `src/config/models.ts` | Edit `MODEL_OPTIONS` array |
| **Orchestrators** | `src/config/models.ts` | Edit `ORCHESTRATOR_OPTIONS` |
| **Default models** | `src/config/models.ts:282-291` | Edit `DEFAULT_SELECTED_*` |
| **Pricing** | `src/lib/pricing.ts` | Update `MODEL_PRICING` map |

### Adding a New Icon

```typescript
// src/components/ChalkIcons.tsx
export function ChalkNewIcon({ className = '', size = 24 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
      <path d="..." stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}
```

### Adding a New Model

1. Add to `MODEL_OPTIONS` in `src/config/models.ts`:
```typescript
{
  id: 'provider/model-name:online',
  name: 'Display Name',
  provider: 'Provider',
  description: 'Brief description',
  costTier: '$',  // or '$$' or '$$$'
  supportsVision: true,  // if applicable
}
```

2. Add pricing to `src/lib/pricing.ts`:
```typescript
'provider/model-name:online': { input: 1.0, output: 5.0 },
```

### Changing the Color Scheme

Edit `tailwind.config.js` - all colors are in the `paper.*` namespace:
```javascript
paper: {
  bg: '#020F59',        // Change this for background
  accent: '#91AAF2',    // Change this for brand color
  text: '#F2F2F2',      // Change this for text
  // ...
}
```

### Modifying the Chalk Effect

The chalk filter is defined in `app/layout.tsx`:
```html
<filter id="chalk">
  <feTurbulence baseFrequency="0.55" />  <!-- roughness -->
  <feDisplacementMap scale="2" />         <!-- intensity -->
  <feGaussianBlur stdDeviation="0.3" />   <!-- smoothing -->
</filter>
```

Adjust values for more/less hand-drawn effect.

## Code Review Status (Dec 2024)

Latest review: **Grade A (Excellent)**

- Component organization: A
- Design system consistency: A-
- Type safety: A+
- API layer: A (usage tracking, rate limiting added)
- Documentation: A

**Implemented:**
- Anonymous usage tracking ($12 free tier per device)
- Rate limiting (20/hr, 100/day for free tier)
- System-wide cost monitoring + circuit breaker
- beforeunload warning for unsaved work

**Ready for:** Auth (Clerk), payments (Stripe), chat history.
See `claude-plans/` for implementation roadmaps.
