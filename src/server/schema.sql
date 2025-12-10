-- Eachie Database Schema
-- Created: December 2024
--
-- Run this in the Neon SQL Editor to set up your database.
-- Dashboard: https://console.neon.tech
--
-- Tables:
--   anonymous_usage  - Free tier tracking by device
--   users            - Authenticated users (synced from Clerk)
--   sessions         - Research sessions (conversations)
--   conversation_rounds - Individual research queries within sessions
--   invite_codes     - Friend credit codes

-- ============================================================
-- ANONYMOUS USAGE (Pre-auth free tier)
-- ============================================================
-- Tracks usage by device fingerprint for $12 free tier.
-- device_id is a FingerprintJS visitorId (stable across sessions).

CREATE TABLE IF NOT EXISTS anonymous_usage (
  device_id VARCHAR(64) PRIMARY KEY,
  total_cost_cents INTEGER DEFAULT 0,
  first_seen TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_seen TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  -- Rate limiting columns
  requests_today INTEGER DEFAULT 0,
  requests_this_hour INTEGER DEFAULT 0,
  last_request_at TIMESTAMP WITH TIME ZONE,
  hour_window_start TIMESTAMP WITH TIME ZONE,
  day_window_start DATE
);

-- Migration: Add rate limiting columns if table exists without them
-- Run these if upgrading an existing database:
-- ALTER TABLE anonymous_usage ADD COLUMN IF NOT EXISTS requests_today INTEGER DEFAULT 0;
-- ALTER TABLE anonymous_usage ADD COLUMN IF NOT EXISTS requests_this_hour INTEGER DEFAULT 0;
-- ALTER TABLE anonymous_usage ADD COLUMN IF NOT EXISTS last_request_at TIMESTAMP WITH TIME ZONE;
-- ALTER TABLE anonymous_usage ADD COLUMN IF NOT EXISTS hour_window_start TIMESTAMP WITH TIME ZONE;
-- ALTER TABLE anonymous_usage ADD COLUMN IF NOT EXISTS day_window_start DATE;

-- ============================================================
-- USERS (Synced from Clerk via webhook)
-- ============================================================
-- Created when user signs up. Clerk webhook populates this.

CREATE TABLE IF NOT EXISTS users (
  id VARCHAR(64) PRIMARY KEY,              -- Clerk user ID (user_xxx)
  email VARCHAR(255) UNIQUE,
  name VARCHAR(255),
  credits_cents INTEGER DEFAULT 0,          -- Purchased credits balance
  total_spent_cents INTEGER DEFAULT 0,      -- Lifetime spend
  stripe_customer_id VARCHAR(64),
  redeemed_code VARCHAR(32),                -- One invite code per account
  device_id VARCHAR(64),                    -- Link to anonymous usage for migration
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================
-- RESEARCH SESSIONS (Conversations)
-- ============================================================
-- A session is a research conversation (initial query + follow-ups).
-- Can be owned by a user OR tracked by device_id for anonymous users.

CREATE TABLE IF NOT EXISTS sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR(64) REFERENCES users(id) ON DELETE CASCADE,
  device_id VARCHAR(64),                    -- For anonymous users
  title VARCHAR(255),                       -- Auto-generated from first query
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_device ON sessions(device_id);

-- ============================================================
-- CONVERSATION ROUNDS (Individual queries)
-- ============================================================
-- Each research query within a session.

CREATE TABLE IF NOT EXISTS conversation_rounds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES sessions(id) ON DELETE CASCADE,
  round_number INTEGER NOT NULL,
  query TEXT NOT NULL,
  synthesis TEXT,
  model_responses JSONB,                    -- Full responses for history
  cost_cents INTEGER DEFAULT 0,
  orchestrator VARCHAR(100),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rounds_session ON conversation_rounds(session_id);

-- ============================================================
-- INVITE CODES (Friend credits)
-- ============================================================
-- $12, $24, or $36 tiers. One code per account, max $72 total discount.

CREATE TABLE IF NOT EXISTS invite_codes (
  code VARCHAR(32) PRIMARY KEY,
  created_by VARCHAR(64) REFERENCES users(id),
  credits_cents INTEGER NOT NULL,
  redeemed_by VARCHAR(64) REFERENCES users(id),
  redeemed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT valid_credit_amount CHECK (credits_cents IN (1200, 2400, 3600))
);

-- ============================================================
-- ABUSE FLAGS (System alerts and device blocks)
-- ============================================================
-- Tracks abuse events and system-wide alerts.
-- flag_type: 'rate_limit', 'cost_spike', 'low_confidence', 'system_alert'

CREATE TABLE IF NOT EXISTS abuse_flags (
  id SERIAL PRIMARY KEY,
  device_id VARCHAR(64),                      -- NULL for system-wide alerts
  flag_type VARCHAR(32) NOT NULL,
  details JSONB,                              -- Context about the flag
  resolved BOOLEAN DEFAULT FALSE,
  resolved_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_abuse_flags_device ON abuse_flags(device_id);
CREATE INDEX IF NOT EXISTS idx_abuse_flags_type ON abuse_flags(flag_type);
CREATE INDEX IF NOT EXISTS idx_abuse_flags_unresolved ON abuse_flags(resolved) WHERE resolved = FALSE;

-- ============================================================
-- SYSTEM STATE (Global settings and circuit breakers)
-- ============================================================
-- Key-value store for system state like "free_tier_paused".

CREATE TABLE IF NOT EXISTS system_state (
  key VARCHAR(64) PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================
-- ANALYTICS: RESEARCH QUERIES (Primary Fact Table)
-- ============================================================
-- Each row = one research query submitted.
-- Atomic grain for query-level analytics.

CREATE TABLE IF NOT EXISTS research_queries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Identity (who)
  user_id VARCHAR(64) REFERENCES users(id),     -- NULL if anonymous
  device_id VARCHAR(64),                         -- Always present
  session_id UUID REFERENCES sessions(id),

  -- Query details (what)
  query_text TEXT NOT NULL,
  query_length INTEGER,                          -- Character count
  round_number INTEGER DEFAULT 1,                -- 1 = initial, 2+ = follow-up
  is_follow_up BOOLEAN DEFAULT FALSE,

  -- Model selection (configurable dimensions)
  selected_model_ids TEXT[],                     -- Array: ['anthropic/claude-3.5-sonnet', ...]
  orchestrator_id VARCHAR(100),                  -- Which model synthesized
  model_count INTEGER,                           -- Quick count
  used_default_models BOOLEAN,                   -- Did user customize?
  used_default_orchestrator BOOLEAN,

  -- Attachments (flexible for future file types)
  has_attachments BOOLEAN DEFAULT FALSE,
  attachment_count INTEGER DEFAULT 0,
  attachment_extensions TEXT[],                  -- Array: ['.png', '.pdf', '.csv']
  has_images BOOLEAN DEFAULT FALSE,              -- .png, .jpg, .gif, .webp
  has_pdfs BOOLEAN DEFAULT FALSE,                -- .pdf
  has_text_files BOOLEAN DEFAULT FALSE,          -- .txt, .md, .json
  has_other_files BOOLEAN DEFAULT FALSE,         -- anything else

  -- Results
  success_count INTEGER,                         -- Models that succeeded
  failure_count INTEGER,                         -- Models that failed
  synthesis_text TEXT,                           -- Final synthesis

  -- Error tracking (maps to messages.ts error codes)
  error_code VARCHAR(50),                        -- e.g., 'RATE_LIMITED', 'ALL_MODELS_FAILED'
  error_type VARCHAR(30),                        -- 'user_error', 'system_error', 'model_error'

  -- Cost & Performance (key metrics)
  total_cost_cents INTEGER,                      -- Total in cents
  total_duration_ms INTEGER,                     -- Total time

  -- Billing context
  billing_type VARCHAR(20),                      -- 'free_tier', 'credits', 'byok'

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_research_queries_device ON research_queries(device_id);
CREATE INDEX IF NOT EXISTS idx_research_queries_user ON research_queries(user_id);
CREATE INDEX IF NOT EXISTS idx_research_queries_created ON research_queries(created_at);
CREATE INDEX IF NOT EXISTS idx_research_queries_models ON research_queries USING GIN(selected_model_ids);

-- ============================================================
-- ANALYTICS: MODEL CALLS (Granular Fact Table)
-- ============================================================
-- Each row = one model's response within a research query.
-- Atomic grain for model-level analytics.

CREATE TABLE IF NOT EXISTS model_calls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Link to parent query
  research_query_id UUID REFERENCES research_queries(id) ON DELETE CASCADE,

  -- Model identity (dimension keys)
  model_id VARCHAR(100) NOT NULL,                -- e.g., 'anthropic/claude-3.5-sonnet:online'
  model_name VARCHAR(100),                       -- Human-readable: 'Claude 3.5 Sonnet'
  provider VARCHAR(50),                          -- 'Anthropic', 'OpenAI', etc.

  -- Response
  success BOOLEAN,
  error_code VARCHAR(50),                        -- Standardized: 'TIMEOUT', 'RATE_LIMITED', etc.
  error_message TEXT,                            -- Raw error text for debugging
  response_text TEXT,

  -- Performance metrics
  duration_ms INTEGER,
  prompt_tokens INTEGER,
  completion_tokens INTEGER,
  total_tokens INTEGER,

  -- Cost
  cost_cents INTEGER,                            -- Individual model cost

  -- Model capabilities used
  reasoning_mode VARCHAR(20),                    -- 'none', 'low', 'high', 'enabled'
  used_vision BOOLEAN DEFAULT FALSE,
  used_pdf BOOLEAN DEFAULT FALSE,

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_model_calls_query ON model_calls(research_query_id);
CREATE INDEX IF NOT EXISTS idx_model_calls_model ON model_calls(model_id);
CREATE INDEX IF NOT EXISTS idx_model_calls_provider ON model_calls(provider);
CREATE INDEX IF NOT EXISTS idx_model_calls_created ON model_calls(created_at);

-- ============================================================
-- ANALYTICS: DIM_MODELS (Model Dimension)
-- ============================================================
-- Reference table for all available models.
-- Auto-synced from MODEL_OPTIONS config via cron job.

CREATE TABLE IF NOT EXISTS dim_models (
  model_id VARCHAR(100) PRIMARY KEY,             -- e.g., 'anthropic/claude-sonnet-4.5:online'
  model_name VARCHAR(100),                       -- 'Claude Sonnet 4.5'
  provider VARCHAR(50),                          -- 'Anthropic'
  description TEXT,
  blended_cost NUMERIC(10,4),                    -- Blended cost per 1M tokens
  supports_vision BOOLEAN DEFAULT FALSE,
  reasoning_type VARCHAR(20),                    -- 'none', 'low', 'high', 'enabled'
  is_default BOOLEAN DEFAULT FALSE,              -- Part of default selection?
  is_orchestrator BOOLEAN DEFAULT FALSE,         -- Can be used as orchestrator?
  is_active BOOLEAN DEFAULT TRUE,                -- Currently available?
  added_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  retired_at TIMESTAMP WITH TIME ZONE,
  last_synced_at TIMESTAMP WITH TIME ZONE        -- When we last synced from config
);

-- ============================================================
-- ANALYTICS: DIM_DATES (Date Dimension)
-- ============================================================
-- Pre-populated calendar table for time-based analysis.

CREATE TABLE IF NOT EXISTS dim_dates (
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

-- ============================================================
-- ANALYTICS: MODEL_CALLS_MONTHLY (Rollup Table)
-- ============================================================
-- Monthly aggregations for data older than 6 months.
-- Created by scheduled rollup job.

CREATE TABLE IF NOT EXISTS model_calls_monthly (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  month DATE,                                    -- First of month: '2024-12-01'
  model_id VARCHAR(100),
  model_name VARCHAR(100),
  provider VARCHAR(50),

  -- Aggregated metrics
  total_calls INTEGER,
  successful_calls INTEGER,
  failed_calls INTEGER,
  total_tokens_used BIGINT,
  total_cost_cents INTEGER,
  avg_duration_ms INTEGER,
  p95_duration_ms INTEGER,                       -- 95th percentile response time

  -- Error breakdown
  timeout_count INTEGER,
  rate_limit_count INTEGER,
  auth_error_count INTEGER,
  other_error_count INTEGER,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_model_calls_monthly_key ON model_calls_monthly(month, model_id);

-- ============================================================
-- MIGRATIONS: Add analytics columns to existing tables
-- ============================================================
-- Run these if upgrading an existing database.

-- Users: Add analytics tracking columns
-- ALTER TABLE users ADD COLUMN IF NOT EXISTS first_query_at TIMESTAMP WITH TIME ZONE;
-- ALTER TABLE users ADD COLUMN IF NOT EXISTS last_query_at TIMESTAMP WITH TIME ZONE;
-- ALTER TABLE users ADD COLUMN IF NOT EXISTS total_queries INTEGER DEFAULT 0;
-- ALTER TABLE users ADD COLUMN IF NOT EXISTS total_cost_cents_analytics INTEGER DEFAULT 0;
-- ALTER TABLE users ADD COLUMN IF NOT EXISTS converted_from_free BOOLEAN DEFAULT FALSE;
-- ALTER TABLE users ADD COLUMN IF NOT EXISTS conversion_date TIMESTAMP WITH TIME ZONE;

-- ============================================================
-- SEED DATA: Populate dim_dates (2024-2030)
-- ============================================================
-- Run once to populate the date dimension table.
--
-- INSERT INTO dim_dates (date_key, year, quarter, month, month_name, week_of_year, day_of_week, day_name, is_weekend)
-- SELECT
--   d::date,
--   EXTRACT(YEAR FROM d),
--   EXTRACT(QUARTER FROM d),
--   EXTRACT(MONTH FROM d),
--   TRIM(TO_CHAR(d, 'Month')),
--   EXTRACT(WEEK FROM d),
--   EXTRACT(DOW FROM d),
--   TRIM(TO_CHAR(d, 'Day')),
--   EXTRACT(DOW FROM d) IN (0, 6)
-- FROM generate_series('2024-01-01'::date, '2030-12-31'::date, '1 day'::interval) d
-- ON CONFLICT (date_key) DO NOTHING;
