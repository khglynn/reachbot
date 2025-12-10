/**
 * Database Migration Endpoint
 *
 * Creates analytics tables and populates dimension tables.
 * Protected by a secret key (set ADMIN_SECRET in env).
 *
 * Usage:
 *   POST /api/admin/migrate
 *   Headers: { "x-admin-secret": "your-secret" }
 *
 * Created: December 2024
 */

import { NextResponse } from 'next/server'
import { getDb } from '@/server/db'
import { syncDimModels, populateDimDates } from '@/server/queries/analytics'

export async function POST(request: Request) {
  // Check admin secret
  const adminSecret = process.env.ADMIN_SECRET
  const providedSecret = request.headers.get('x-admin-secret')

  if (!adminSecret || providedSecret !== adminSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const results: Record<string, unknown> = {}
  const errors: string[] = []

  try {
    const sql = getDb()

    // 1. Create research_queries table
    try {
      await sql`
        CREATE TABLE IF NOT EXISTS research_queries (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id VARCHAR(64),
          device_id VARCHAR(64),
          session_id UUID,
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
        )
      `
      await sql`CREATE INDEX IF NOT EXISTS idx_research_queries_device ON research_queries(device_id)`
      await sql`CREATE INDEX IF NOT EXISTS idx_research_queries_user ON research_queries(user_id)`
      await sql`CREATE INDEX IF NOT EXISTS idx_research_queries_created ON research_queries(created_at)`
      await sql`CREATE INDEX IF NOT EXISTS idx_research_queries_models ON research_queries USING GIN(selected_model_ids)`
      results.research_queries = 'created'
    } catch (e) {
      errors.push(`research_queries: ${e instanceof Error ? e.message : String(e)}`)
    }

    // 2. Create model_calls table
    try {
      await sql`
        CREATE TABLE IF NOT EXISTS model_calls (
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
        )
      `
      await sql`CREATE INDEX IF NOT EXISTS idx_model_calls_query ON model_calls(research_query_id)`
      await sql`CREATE INDEX IF NOT EXISTS idx_model_calls_model ON model_calls(model_id)`
      await sql`CREATE INDEX IF NOT EXISTS idx_model_calls_provider ON model_calls(provider)`
      await sql`CREATE INDEX IF NOT EXISTS idx_model_calls_created ON model_calls(created_at)`
      results.model_calls = 'created'
    } catch (e) {
      errors.push(`model_calls: ${e instanceof Error ? e.message : String(e)}`)
    }

    // 3. Create dim_models table
    try {
      await sql`
        CREATE TABLE IF NOT EXISTS dim_models (
          model_id VARCHAR(100) PRIMARY KEY,
          model_name VARCHAR(100),
          provider VARCHAR(50),
          description TEXT,
          blended_cost NUMERIC(10,4),
          supports_vision BOOLEAN DEFAULT FALSE,
          reasoning_type VARCHAR(20),
          is_default BOOLEAN DEFAULT FALSE,
          is_orchestrator BOOLEAN DEFAULT FALSE,
          is_active BOOLEAN DEFAULT TRUE,
          added_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          retired_at TIMESTAMP WITH TIME ZONE,
          last_synced_at TIMESTAMP WITH TIME ZONE
        )
      `
      results.dim_models = 'created'
    } catch (e) {
      errors.push(`dim_models: ${e instanceof Error ? e.message : String(e)}`)
    }

    // 4. Create dim_dates table
    try {
      await sql`
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
        )
      `
      results.dim_dates = 'created'
    } catch (e) {
      errors.push(`dim_dates: ${e instanceof Error ? e.message : String(e)}`)
    }

    // 5. Create model_calls_monthly table
    try {
      await sql`
        CREATE TABLE IF NOT EXISTS model_calls_monthly (
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
        )
      `
      await sql`CREATE UNIQUE INDEX IF NOT EXISTS idx_model_calls_monthly_key ON model_calls_monthly(month, model_id)`
      results.model_calls_monthly = 'created'
    } catch (e) {
      errors.push(`model_calls_monthly: ${e instanceof Error ? e.message : String(e)}`)
    }

    // 6. Populate dim_dates
    try {
      const datesCount = await populateDimDates()
      results.dim_dates_populated = datesCount
    } catch (e) {
      errors.push(`dim_dates population: ${e instanceof Error ? e.message : String(e)}`)
    }

    // 7. Sync dim_models from config
    try {
      const modelsSync = await syncDimModels()
      results.dim_models_synced = modelsSync
    } catch (e) {
      errors.push(`dim_models sync: ${e instanceof Error ? e.message : String(e)}`)
    }

    return NextResponse.json({
      success: errors.length === 0,
      results,
      errors: errors.length > 0 ? errors : undefined,
    })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        results,
        errors,
      },
      { status: 500 }
    )
  }
}
