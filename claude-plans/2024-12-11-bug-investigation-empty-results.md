# Bug Investigation & Fixes Plan - Dec 11, 2024

## Context from Kevin
- Was logged in as kevin@trimm.co (super_admin)
- Was in BYOK mode (using own OpenRouter key)
- No console errors visible
- Results page layout appeared but content was empty
- DB has synthesis_text populated - server succeeded

## Issues Identified

### 1. Empty Results Display (Critical - MYSTERY)
**Symptom:** Loading completes (green checkmarks), results page shows, but synthesis/responses are empty.
**Evidence:**
- Database has full `synthesis_text` - server succeeded
- No console errors - client didn't crash
- Stage changed to 'results' - SSE was received
- But content was empty - result object must be malformed somewhere

**Hypothesis:** JSON parsing issue or race condition causing result to be undefined/empty when added to state.

### 2. Model Selections Reset (Fixed - Uncommitted)
**Symptom:** Models reset to defaults after error.
**Fix:** Added localStorage persistence for `eachie_selected_models`.
**Status:** Code written, not pushed.

### 3. Auth Not Passed (Lower Priority)
**Symptom:** `user_id: null` in research_queries even when logged in.
**Note:** BYOK mode doesn't require auth for billing, but would be nice to track.

---

## Recommended Fix

Since we can't reproduce the bug and no console errors appeared, add defensive logging to catch it next time:

### 1. Enhanced Client Logging (page.tsx)
```typescript
// In complete event handler - more verbose logging
console.log('[Eachie] SSE complete received:', JSON.stringify(data).slice(0, 500))
const result: ResearchResult = data.result
if (!result?.synthesis) {
  console.error('[Eachie] EMPTY SYNTHESIS:', { data, result })
  // Could also show a toast to user
}
```

### 2. Commit Model Persistence Fix
Already written - just needs push. This fixes models resetting.

### 3. (Optional) Add error toast for empty results
Instead of silent failure, show user-friendly error message.

---

## Files to Modify

| File | Change | Priority |
|------|--------|----------|
| `app/page.tsx` | Push model persistence fix + add debug logging | High |
| `app/api/research/stream/route.ts` | (Optional) Add server-side empty synthesis logging | Low |

---

## Already Done (Uncommitted)
- `app/page.tsx` - Model selection persistence to localStorage
- Database - Created abuse_flags and system_state tables
- Database - Added is_super_admin column, kevin@trimm.co marked as super_admin

---

## Recommendation

**Minimal fix:** Push the model persistence code that's already written. Add one console.log to help debug if it happens again.

**Later:** If bug recurs, we'll have more data to investigate.
