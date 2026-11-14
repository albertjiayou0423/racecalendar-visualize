import { randomUUID } from "node:crypto"
import { getSql } from "./db"
import type { RaceEvent, Series } from "./types"
import type { WrcRequestDiagnostics } from "./wrc-request-budget"

export type DataFlowStage = "fetching" | "checking" | "fallback" | "persisting" | "complete" | "failed"
export type DataFlowStatus = "active" | "complete" | "fallback" | "failed"
export type DataFlowTrigger = "schedule-api" | "schedule-background" | "admin-manual"

export type DataFlowSample = {
  id: string
  series: Series
  round: number
  name: string
  country: string
  circuit: string
  sessionCount: number
  mainSession: { name: string; utc: string | null; tentative: boolean } | null
  tentative: boolean
}

export function summarizeDataEvent(event: RaceEvent | undefined): DataFlowSample | null {
  if (!event) return null
  const main = event.sessions.find(session => session.isMain) ?? event.sessions[0]
  return {
    id: event.id,
    series: event.series,
    round: event.round,
    name: event.name,
    country: event.country,
    circuit: event.circuit,
    sessionCount: event.sessions.length,
    mainSession: main ? {
      name: main.name,
      utc: main.tentative || event.tentative ? null : main.utc,
      tentative: Boolean(main.tentative || event.tentative),
    } : null,
    tentative: Boolean(event.tentative || event.sessions.some(session => session.tentative)),
  }
}

function safeNote(stage: DataFlowStage, eventCount: number, persistenceError = false) {
  if (stage === "fetching") return "正在请求赛事公开数据源"
  if (stage === "checking") return eventCount ? `已解析 ${eventCount} 场，正在检查完整性` : "正在检查来源返回结果"
  if (stage === "fallback") return "来源数据不可用，正在查找最近成功快照"
  if (stage === "persisting") return "数据通过检查，正在保存成功快照"
  if (stage === "complete") return persistenceError ? "数据已获取，但快照保存失败" : `刷新完成，共处理 ${eventCount} 场`
  if (stage === "failed") return "本次没有可用的新数据，保留已有快照"
  return "正在处理"
}

export async function recordDataFlowStage(input: {
  series: Series
  runId: string
  stage: DataFlowStage
  trigger: DataFlowTrigger
  startedAt: string
  eventCount?: number
  sample?: DataFlowSample | null
  diagnostics?: WrcRequestDiagnostics
  persistenceError?: boolean
  usedSnapshot?: boolean
}) {
  const sql = getSql()
  if (!sql) return

  const eventCount = Math.max(0, Math.trunc(input.eventCount ?? 0))
  const active = input.stage !== "complete" && input.stage !== "failed"
  const status: DataFlowStatus = active
    ? "active"
    : input.stage === "complete" && input.usedSnapshot
      ? "fallback"
      : input.stage === "complete" && !input.persistenceError
      ? "complete"
      : "failed"
  const finishedAt = active ? null : new Date().toISOString()
  const note = input.usedSnapshot ? "来源暂不可用，已回退到最近成功快照" : safeNote(input.stage, eventCount, input.persistenceError)

  await sql`
    INSERT INTO data_flow_runs (
      series, run_id, status, stage, triggered_by, started_at, updated_at,
      finished_at, event_count, sample_event, diagnostics, note
    ) VALUES (
      ${input.series}, ${input.runId}, ${status}, ${input.stage}, ${input.trigger},
      ${input.startedAt}, NOW(), ${finishedAt}, ${eventCount},
      ${input.sample ? JSON.stringify(input.sample) : null}::jsonb,
      ${input.diagnostics ? JSON.stringify(input.diagnostics) : null}::jsonb,
      ${note}
    )
    ON CONFLICT (series) DO UPDATE SET
      run_id = EXCLUDED.run_id,
      status = EXCLUDED.status,
      stage = EXCLUDED.stage,
      triggered_by = EXCLUDED.triggered_by,
      started_at = EXCLUDED.started_at,
      updated_at = NOW(),
      finished_at = EXCLUDED.finished_at,
      event_count = EXCLUDED.event_count,
      sample_event = COALESCE(EXCLUDED.sample_event, data_flow_runs.sample_event),
      diagnostics = COALESCE(EXCLUDED.diagnostics, data_flow_runs.diagnostics),
      note = EXCLUDED.note
    WHERE data_flow_runs.run_id = EXCLUDED.run_id
       OR data_flow_runs.started_at < EXCLUDED.started_at
  `
}

export function createDataFlowRunId() {
  return randomUUID()
}
