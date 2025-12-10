# Analytics-Friendly Database Schema Redesign

**Created:** December 10, 2024
**Status:** Ready to implement
**Purpose:** Redesign Eachie's database for human-readable analytics, easy Excel export, and future-proof data insights

---

## Quick Reference

**New Tables:**
- `research_queries` - One row per query (fact table)
- `model_calls` - One row per model response (fact table)
- `dim_models` - Model reference data (dimension)
- `dim_dates` - Calendar for time analysis (dimension)
- `model_calls_monthly` - Rollups for old data

**Tool Responsibilities:**
| Tool | Primary Purpose |
|------|-----------------|
| **Database** | Transactional data, costs, model usage, user accounts |
| **PostHog** | In-app behavior, funnels, session replays, traffic sources (Web Analytics) |
| **Stripe** | Revenue, subscriptions, payment analytics |
| **Canny** | Feature requests, user feedback |

**Note:** PostHog Web Analytics covers traffic sources, referrers, UTM tracking. Defer GA4 until SEO/paid marketing becomes priority.

---

## Design Principles

From Kimball's Dimensional Modeling:
1. **Fact Tables** = Measurements at atomic grain
2. **Dimension Tables** = Descriptive attributes
3. **Denormalize for readability** = Store `model_name` alongside `model_id`
4. **Storage is cheap** = Prioritize queryability

Kevin's Requirements:
- Human-readable column names (`user_id` not `uid`)
- Easy to export to CSV/Excel
- Future-proof for questions we haven't thought of yet
- Self-documenting for future Claude instances

---

## Schema

### `research_queries` (Primary Fact Table)

```sql
CREATE TABLE research_queries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR(64) REFERENCES users(id),
  device_id VARCHAR(64),
  session_id UUID REFERENCES sessions(id),
  query_text TEXT NOT NULL,
  query_length INTEGER,
  round_number INTEGER DEFAULT 1,
  is_follow_up BOOLEAN DEFAULT FALSE,
  selected_model_ids TEXT[],
  orchestrator_id VARCHAR(100),
  model_count INTEGER,
  used_default_models BOOLEAN,
  used_default_orchestrator BOOLEAN,
  has_attachments BOOLEAN DEFAULT FALSE,
  attachment_count INTEGER DEFAULT 0,
  attachment_extensions TEXT[],
  has_images BOOLEAN DEFAULT FALSE,
  has_pdfs BOOLEAN DEFAULT FALSE,
  has_text_files BOOLEAN DEFAULT FALSE,
  has_other_files BOOLEAN DEFAULT FALSE,
  success_count INTEGER,
  failure_count INTEGER,
  synthesis_text TEXT,
  error_code VARCHAR(50),
  error_type VARCHAR(30),
  total_cost_cents INTEGER,
  total_duration_ms INTEGER,
  billing_type VARCHAR(20),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_queries_device ON research_queries(device_id);
CREATE INDEX idx_queries_user ON research_queries(user_id);
CREATE INDEX idx_queries_created ON research_queries(created_at);
CREATE INDEX idx_queries_models ON research_queries USING GIN(selected_model_ids);
```

### `model_calls` (Granular Fact Table)

```sql
CREATE TABLE model_calls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  research_query_id UUID REFERENCES research_queries(id) ON DELETE CASCADE,
  model_id VARCHAR(100) NOT NULL,
  model_name VARCHAR(100),
  provider VARCHAR(50),
  success BOOLEAN,
  error_code VARCHAR(50),
  error_message TEXT,
  response_text TEXT,
  duration_ms INTEGER,
  prompt_tokens INTEGER,
  completion_tokens INTEGER,
  total_tokens INTEGER,
  cost_cents INTEGER,
  reasoning_mode VARCHAR(20),
  used_vision BOOLEAN DEFAULT FALSE,
  used_pdf BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_model_calls_query ON model_calls(research_query_id);
CREATE INDEX idx_model_calls_model ON model_calls(model_id);
CREATE INDEX idx_model_calls_provider ON model_calls(provider);
CREATE INDEX idx_model_calls_created ON model_calls(created_at);
```

### `dim_models` (Model Dimension)

Auto-synced from `MODEL_OPTIONS` in config.

```sql
CREATE TABLE dim_models (
  model_id VARCHAR(100) PRIMARY KEY,
  model_name VARCHAR(100),
  provider VARCHAR(50),
  description TEXT,
  cost_tier VARCHAR(10),
  supports_vision BOOLEAN DEFAULT FALSE,
  supports_pdf BOOLEAN DEFAULT FALSE,
  reasoning_type VARCHAR(20),
  input_price_per_million NUMERIC(10,4),
  output_price_per_million NUMERIC(10,4),
  is_default BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  added_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  retired_at TIMESTAMP WITH TIME ZONE,
  last_synced_at TIMESTAMP WITH TIME ZONE
);
```

### `dim_dates` (Date Dimension)

```sql
CREATE TABLE dim_dates (
  date_key DATE PRIMARY KEY,
  year INTEGER,
  quarter INTEGER,
  month INTEGER,
  month_name VARCHAR(20),
  week_of_year INTEGER,
  day_of_week INTEGER,
  day_name VARCHAR(20),
  is_weekend BOOLEAN,
  is_holiday BOOLEAN DEFAULT FALSE,
  holiday_name VARCHAR(50)
);

-- Populate for 2024-2030
INSERT INTO dim_dates (date_key, year, quarter, month, month_name, week_of_year, day_of_week, day_name, is_weekend)
SELECT
  d::date,
  EXTRACT(YEAR FROM d),
  EXTRACT(QUARTER FROM d),
  EXTRACT(MONTH FROM d),
  TO_CHAR(d, 'Month'),
  EXTRACT(WEEK FROM d),
  EXTRACT(DOW FROM d),
  TO_CHAR(d, 'Day'),
  EXTRACT(DOW FROM d) IN (0, 6)
FROM generate_series('2024-01-01'::date, '2030-12-31'::date, '1 day'::interval) d;
```

### `users` - Add analytics columns

```sql
ALTER TABLE users ADD COLUMN
  first_query_at TIMESTAMP WITH TIME ZONE,
  last_query_at TIMESTAMP WITH TIME ZONE,
  total_queries INTEGER DEFAULT 0,
  total_cost_cents INTEGER DEFAULT 0,
  converted_from_free BOOLEAN DEFAULT FALSE,
  conversion_date TIMESTAMP WITH TIME ZONE;
```

---

## Example Analytics Queries

```sql
-- Average cost per query
SELECT AVG(total_cost_cents) / 100.0 as avg_cost_dollars
FROM research_queries WHERE created_at >= NOW() - INTERVAL '30 days';

-- Most popular models
SELECT model_name, provider, COUNT(*) as times_used
FROM model_calls WHERE created_at >= NOW() - INTERVAL '30 days'
GROUP BY model_name, provider ORDER BY times_used DESC;

-- Popular models EXCLUDING default users
SELECT mc.model_name, COUNT(*) as times_used
FROM model_calls mc
JOIN research_queries rq ON mc.research_query_id = rq.id
WHERE rq.used_default_models = FALSE
GROUP BY mc.model_name ORDER BY times_used DESC;

-- Free tier conversion funnel
SELECT
  CASE
    WHEN u.id IS NOT NULL THEN 'signed_up'
    WHEN au.total_cost_cents >= 1200 THEN 'hit_limit'
    ELSE 'active_free'
  END as funnel_stage,
  COUNT(DISTINCT au.device_id) as users
FROM anonymous_usage au
LEFT JOIN users u ON au.device_id = u.device_id
GROUP BY funnel_stage;
```

---

## Data Retention (6 months detail, then rollup)

```sql
CREATE TABLE model_calls_monthly (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  month DATE,
  model_id VARCHAR(100),
  model_name VARCHAR(100),
  provider VARCHAR(50),
  total_calls INTEGER,
  successful_calls INTEGER,
  failed_calls INTEGER,
  total_tokens_used BIGINT,
  total_cost_cents INTEGER,
  avg_duration_ms INTEGER,
  p95_duration_ms INTEGER,
  timeout_count INTEGER,
  rate_limit_count INTEGER,
  auth_error_count INTEGER,
  other_error_count INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_monthly_model ON model_calls_monthly(month, model_id);
```

---

## PostHog Events to Add

| Event | When | Properties |
|-------|------|------------|
| `research_started` | Query submitted | `model_count`, `has_attachments`, `is_follow_up` |
| `research_completed` | Results shown | `duration_ms`, `success_count`, `total_cost` |
| `model_selected` | User picks model | `model_id`, `action` |
| `settings_opened` | Opens settings | `tab` |
| `api_key_added` | BYOK key saved | `has_key` (boolean only!) |
| `copy_clicked` | Copies result | `target` |
| `export_clicked` | Downloads result | `format` |
| `error_shown` | Error displayed | `error_code`, `error_type` |

---

## Implementation Order

1. Create new tables in Neon
2. Create all indexes
3. Populate `dim_dates` with 2024-2030 calendar data
4. Populate `dim_models` from `MODEL_OPTIONS` config
5. Update `app/api/research/stream/route.ts` to write to new tables
6. Create `/api/cron/sync-models` endpoint
7. Create `src/server/queries/analytics.ts` helper functions
8. Add PostHog events
9. Create backend-design skill
10. Update CLAUDE.md

---

## Files to Create/Modify

| File | Action | Purpose |
|------|--------|---------|
| `src/server/schema.sql` | Modify | Add new tables, indexes |
| `src/server/queries/analytics.ts` | Create | Analytics query helpers |
| `src/server/queries/models.ts` | Create | Model sync functions |
| `app/api/research/stream/route.ts` | Modify | Write to new tables |
| `app/api/cron/sync-models/route.ts` | Create | Model auto-sync endpoint |
| `vercel.json` | Modify | Add cron configuration |
| `app/page.tsx` | Modify | Add PostHog events |
