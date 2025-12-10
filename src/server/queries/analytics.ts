/**
 * Analytics Queries
 *
 * Database operations for analytics fact tables (research_queries, model_calls).
 * Used for tracking query patterns, model performance, and costs.
 *
 * Created: December 2024
 *
 * @module server/queries/analytics
 */

import { getDb } from '../db'
import { MODEL_OPTIONS, ORCHESTRATOR_OPTIONS, DEFAULT_MODELS, DEFAULT_ORCHESTRATOR } from '@/config/models'

// ============================================================
// TYPES
// ============================================================

export interface ResearchQueryRecord {
  id?: string
  user_id?: string
  device_id: string
  session_id?: string
  query_text: string
  query_length?: number
  round_number?: number
  is_follow_up?: boolean
  selected_model_ids: string[]
  orchestrator_id: string
  model_count?: number
  used_default_models?: boolean
  used_default_orchestrator?: boolean
  has_attachments?: boolean
  attachment_count?: number
  attachment_extensions?: string[]
  has_images?: boolean
  has_pdfs?: boolean
  has_text_files?: boolean
  has_other_files?: boolean
  billing_type: 'free_tier' | 'credits' | 'byok'
}

export interface ModelCallRecord {
  research_query_id: string
  model_id: string
  model_name: string
  provider: string
  success: boolean
  error_code?: string
  error_message?: string
  response_text?: string
  duration_ms?: number
  prompt_tokens?: number
  completion_tokens?: number
  total_tokens?: number
  cost_cents?: number
  reasoning_mode?: string
  used_vision?: boolean
  used_pdf?: boolean
}

export interface ResearchQueryUpdate {
  success_count?: number
  failure_count?: number
  synthesis_text?: string
  error_code?: string
  error_type?: string
  total_cost_cents?: number
  total_duration_ms?: number
}

// ============================================================
// RESEARCH QUERIES (Primary Fact Table)
// ============================================================

/**
 * Create a research query record at the start of a research request.
 * Returns the query ID for linking model_calls.
 */
export async function createResearchQuery(record: ResearchQueryRecord): Promise<string> {
  const sql = getDb()

  // Calculate derived fields
  const queryLength = record.query_text.length
  const modelCount = record.selected_model_ids.length
  const usedDefaultModels = arraysEqual(record.selected_model_ids.sort(), [...DEFAULT_MODELS].sort())
  const usedDefaultOrchestrator = record.orchestrator_id === DEFAULT_ORCHESTRATOR

  // Categorize attachments
  const extensions = record.attachment_extensions ?? []
  const hasImages = extensions.some(ext => ['.png', '.jpg', '.jpeg', '.gif', '.webp'].includes(ext.toLowerCase()))
  const hasPdfs = extensions.some(ext => ext.toLowerCase() === '.pdf')
  const hasTextFiles = extensions.some(ext => ['.txt', '.md', '.json'].includes(ext.toLowerCase()))
  const hasOtherFiles = extensions.some(ext =>
    !['.png', '.jpg', '.jpeg', '.gif', '.webp', '.pdf', '.txt', '.md', '.json'].includes(ext.toLowerCase())
  )

  const result = await sql`
    INSERT INTO research_queries (
      user_id, device_id, session_id,
      query_text, query_length, round_number, is_follow_up,
      selected_model_ids, orchestrator_id, model_count,
      used_default_models, used_default_orchestrator,
      has_attachments, attachment_count, attachment_extensions,
      has_images, has_pdfs, has_text_files, has_other_files,
      billing_type
    ) VALUES (
      ${record.user_id ?? null},
      ${record.device_id},
      ${record.session_id ?? null},
      ${record.query_text},
      ${queryLength},
      ${record.round_number ?? 1},
      ${record.is_follow_up ?? false},
      ${record.selected_model_ids},
      ${record.orchestrator_id},
      ${modelCount},
      ${usedDefaultModels},
      ${usedDefaultOrchestrator},
      ${record.has_attachments ?? extensions.length > 0},
      ${record.attachment_count ?? extensions.length},
      ${extensions.length > 0 ? extensions : null},
      ${hasImages},
      ${hasPdfs},
      ${hasTextFiles},
      ${hasOtherFiles},
      ${record.billing_type}
    )
    RETURNING id
  ` as Array<{ id: string }>

  return result[0].id
}

/**
 * Update a research query record after completion.
 */
export async function updateResearchQuery(
  queryId: string,
  update: ResearchQueryUpdate
): Promise<void> {
  const sql = getDb()

  await sql`
    UPDATE research_queries SET
      success_count = COALESCE(${update.success_count ?? null}, success_count),
      failure_count = COALESCE(${update.failure_count ?? null}, failure_count),
      synthesis_text = COALESCE(${update.synthesis_text ?? null}, synthesis_text),
      error_code = COALESCE(${update.error_code ?? null}, error_code),
      error_type = COALESCE(${update.error_type ?? null}, error_type),
      total_cost_cents = COALESCE(${update.total_cost_cents ?? null}, total_cost_cents),
      total_duration_ms = COALESCE(${update.total_duration_ms ?? null}, total_duration_ms)
    WHERE id = ${queryId}::uuid
  `
}

// ============================================================
// MODEL CALLS (Granular Fact Table)
// ============================================================

/**
 * Record a model call after it completes (success or failure).
 */
export async function createModelCall(record: ModelCallRecord): Promise<string> {
  const sql = getDb()

  const result = await sql`
    INSERT INTO model_calls (
      research_query_id, model_id, model_name, provider,
      success, error_code, error_message, response_text,
      duration_ms, prompt_tokens, completion_tokens, total_tokens,
      cost_cents, reasoning_mode, used_vision, used_pdf
    ) VALUES (
      ${record.research_query_id}::uuid,
      ${record.model_id},
      ${record.model_name},
      ${record.provider},
      ${record.success},
      ${record.error_code ?? null},
      ${record.error_message ?? null},
      ${record.response_text ?? null},
      ${record.duration_ms ?? null},
      ${record.prompt_tokens ?? null},
      ${record.completion_tokens ?? null},
      ${record.total_tokens ?? null},
      ${record.cost_cents ?? null},
      ${record.reasoning_mode ?? 'none'},
      ${record.used_vision ?? false},
      ${record.used_pdf ?? false}
    )
    RETURNING id
  ` as Array<{ id: string }>

  return result[0].id
}

// ============================================================
// DIM_MODELS SYNC
// ============================================================

/**
 * Sync dim_models table from MODEL_OPTIONS and ORCHESTRATOR_OPTIONS config.
 * - Upserts all models from config
 * - Marks models not in config as retired (but doesn't delete)
 */
export async function syncDimModels(): Promise<{
  inserted: number
  updated: number
  retired: number
}> {
  const sql = getDb()
  const now = new Date().toISOString()
  let inserted = 0
  let updated = 0

  // Combine research models and orchestrator models
  const allModelIds = new Set<string>()

  // Sync research models
  for (const model of MODEL_OPTIONS) {
    allModelIds.add(model.id)
    const isDefault = DEFAULT_MODELS.includes(model.id)

    const result = await sql`
      INSERT INTO dim_models (
        model_id, model_name, provider, description, blended_cost,
        supports_vision, reasoning_type,
        is_default, is_orchestrator, is_active, last_synced_at
      ) VALUES (
        ${model.id},
        ${model.name},
        ${model.provider},
        ${model.description ?? null},
        ${model.blendedCost ?? 0},
        ${model.supportsVision ?? false},
        ${model.reasoning ?? 'none'},
        ${isDefault},
        false,
        true,
        ${now}
      )
      ON CONFLICT (model_id) DO UPDATE SET
        model_name = EXCLUDED.model_name,
        provider = EXCLUDED.provider,
        description = EXCLUDED.description,
        blended_cost = EXCLUDED.blended_cost,
        supports_vision = EXCLUDED.supports_vision,
        reasoning_type = EXCLUDED.reasoning_type,
        is_default = EXCLUDED.is_default,
        is_active = true,
        retired_at = NULL,
        last_synced_at = ${now}
      RETURNING (xmax = 0) as is_insert
    ` as Array<{ is_insert: boolean }>

    if (result[0]?.is_insert) inserted++
    else updated++
  }

  // Sync orchestrator models (may overlap with research models)
  for (const orch of ORCHESTRATOR_OPTIONS) {
    allModelIds.add(orch.id)

    const result = await sql`
      INSERT INTO dim_models (
        model_id, model_name, provider, blended_cost,
        is_orchestrator, is_active, last_synced_at
      ) VALUES (
        ${orch.id},
        ${orch.name},
        'Unknown',
        ${orch.blendedCost ?? 0},
        true,
        true,
        ${now}
      )
      ON CONFLICT (model_id) DO UPDATE SET
        model_name = EXCLUDED.model_name,
        blended_cost = EXCLUDED.blended_cost,
        is_orchestrator = true,
        is_active = true,
        retired_at = NULL,
        last_synced_at = ${now}
      RETURNING (xmax = 0) as is_insert
    ` as Array<{ is_insert: boolean }>

    if (result[0]?.is_insert) inserted++
    else updated++
  }

  // Retire models not in current config
  const modelIdArray = Array.from(allModelIds)
  const retiredResult = await sql`
    UPDATE dim_models
    SET is_active = false, retired_at = ${now}
    WHERE NOT (model_id = ANY(${modelIdArray}))
      AND is_active = true
  `
  const retired = typeof retiredResult === 'object' && 'count' in retiredResult
    ? (retiredResult as { count: number }).count
    : 0

  return { inserted, updated, retired }
}

// ============================================================
// DIM_DATES POPULATION
// ============================================================

/**
 * Populate dim_dates table with calendar data from 2024-2030.
 * Safe to run multiple times (uses ON CONFLICT DO NOTHING).
 */
export async function populateDimDates(): Promise<number> {
  const sql = getDb()

  const result = await sql`
    INSERT INTO dim_dates (date_key, year, quarter, month, month_name, week_of_year, day_of_week, day_name, is_weekend)
    SELECT
      d::date,
      EXTRACT(YEAR FROM d)::integer,
      EXTRACT(QUARTER FROM d)::integer,
      EXTRACT(MONTH FROM d)::integer,
      TRIM(TO_CHAR(d, 'Month')),
      EXTRACT(WEEK FROM d)::integer,
      EXTRACT(DOW FROM d)::integer,
      TRIM(TO_CHAR(d, 'Day')),
      EXTRACT(DOW FROM d) IN (0, 6)
    FROM generate_series('2024-01-01'::date, '2030-12-31'::date, '1 day'::interval) d
    ON CONFLICT (date_key) DO NOTHING
  `

  // Return approximate count (generate_series produces 2557 days for 2024-2030)
  return typeof result === 'object' && 'count' in result
    ? (result as { count: number }).count
    : 2557
}

// ============================================================
// ANALYTICS QUERIES
// ============================================================

/**
 * Get average cost per query for the last N days.
 */
export async function getAverageCostPerQuery(days: number = 30): Promise<{
  avgCostCents: number
  totalQueries: number
}> {
  const sql = getDb()

  const result = await sql`
    SELECT
      COALESCE(AVG(total_cost_cents), 0) as avg_cost,
      COUNT(*) as total
    FROM research_queries
    WHERE created_at >= NOW() - INTERVAL '1 day' * ${days}
      AND total_cost_cents IS NOT NULL
  ` as Array<{ avg_cost: number; total: number }>

  return {
    avgCostCents: Math.round(result[0]?.avg_cost ?? 0),
    totalQueries: Number(result[0]?.total ?? 0),
  }
}

interface PopularModelResult {
  model_id: string
  model_name: string
  provider: string
  times_used: number
  avg_duration_ms: number
  total_cost_cents: number
}

/**
 * Get most popular models by usage count.
 */
export async function getPopularModels(
  days: number = 30,
  limit: number = 10,
  excludeDefaultUsers: boolean = false
): Promise<PopularModelResult[]> {
  const sql = getDb()

  if (excludeDefaultUsers) {
    const result = await sql`
      SELECT
        mc.model_id,
        mc.model_name,
        mc.provider,
        COUNT(*) as times_used,
        ROUND(AVG(mc.duration_ms)) as avg_duration_ms,
        SUM(mc.cost_cents) as total_cost_cents
      FROM model_calls mc
      JOIN research_queries rq ON mc.research_query_id = rq.id
      WHERE mc.created_at >= NOW() - INTERVAL '1 day' * ${days}
        AND rq.used_default_models = false
      GROUP BY mc.model_id, mc.model_name, mc.provider
      ORDER BY times_used DESC
      LIMIT ${limit}
    `
    return result as PopularModelResult[]
  }

  const result = await sql`
    SELECT
      model_id,
      model_name,
      provider,
      COUNT(*) as times_used,
      ROUND(AVG(duration_ms)) as avg_duration_ms,
      SUM(cost_cents) as total_cost_cents
    FROM model_calls
    WHERE created_at >= NOW() - INTERVAL '1 day' * ${days}
    GROUP BY model_id, model_name, provider
    ORDER BY times_used DESC
    LIMIT ${limit}
  `
  return result as PopularModelResult[]
}

// ============================================================
// HELPERS
// ============================================================

function arraysEqual(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false
  return a.every((val, idx) => val === b[idx])
}
