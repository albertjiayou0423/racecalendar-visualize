import { NextResponse } from "next/server"
import { getSql } from "@/lib/db"
import type { DataFlowSample } from "@/lib/data-flow-telemetry"
import type { Series } from "@/lib/types"

export const dynamic = "force-dynamic"
export const revalidate = 0

const SERIES: Series[] = ["F1", "FE", "WRC"]
const headers = { "Cache-Control": "no-store, max-age=0" }

function parseJson(value: unknown): any {
  if (typeof value !== "string") return value
  try { return JSON.parse(value) } catch { return null }
}

/** crawl_snapshots.fetched_at is TIMESTAMP without time zone and is stored in UTC. */
function snapshotTimeUtc(value: unknown): string | null {
  if (value instanceof Date) return Number.isFinite(value.getTime()) ? value.toISOString() : null
  if (typeof value !== "string" || !value.trim()) return null
  const normalized = value.trim().replace(" ", "T")
  const hasZone = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(normalized)
  const parsed = new Date(hasZone ? normalized : `${normalized}Z`)
  return Number.isFinite(parsed.getTime()) ? parsed.toISOString() : null
}

function toSample(event: any): DataFlowSample | null {
  if (!event || typeof event.id !== "string" || !SERIES.includes(event.series)) return null
  const sessions = Array.isArray(event.sessions) ? event.sessions : []
  const main = sessions.find((session: any) => session?.isMain) ?? sessions[0]
  return {
    id: event.id,
    series: event.series,
    round: Number.isFinite(Number(event.round)) ? Number(event.round) : 0,
    name: typeof event.name === "string" ? event.name.slice(0, 180) : "未命名赛事",
    country: typeof event.country === "string" ? event.country.slice(0, 100) : "",
    circuit: typeof event.circuit === "string" ? event.circuit.slice(0, 180) : "",
    sessionCount: sessions.length,
    mainSession: main && typeof main.name === "string" && typeof main.utc === "string"
      ? { name: main.name.slice(0, 100), utc: main.tentative || event.tentative ? null : main.utc.slice(0, 40), tentative: Boolean(main.tentative || event.tentative) }
      : null,
    tentative: Boolean(event.tentative || sessions.some((session: any) => session?.tentative)),
  }
}

/** Read-only, bounded summaries. Never returns raw snapshots, job tokens, URLs, or user data. */
export async function GET(request: Request) {
  const sql = getSql()
  if (!sql) return NextResponse.json({ configured: false, telemetryAvailable: false, snapshots: [], runs: [], quotas: [], clientCrawl: [] }, { headers })

  const eventId = new URL(request.url).searchParams.get("eventId")?.slice(0, 120) ?? ""
  try {
    const [summaryRows] = await Promise.all([sql`
      WITH latest_runs AS (
        SELECT series, run_id, status, stage, triggered_by, started_at, updated_at,
               finished_at, event_count, sample_event, diagnostics, note
        FROM data_flow_runs WHERE series IN ('F1', 'FE', 'WRC')
      ), latest_snapshots AS (
        SELECT DISTINCT ON (series) series, data, fetched_at, source
        FROM crawl_snapshots
        WHERE series IN ('F1', 'FE', 'WRC')
          AND data->>'ok' = 'true'
          AND jsonb_typeof(data->'events') = 'array'
          AND data->'events' <> '[]'::jsonb
        ORDER BY series, fetched_at DESC
      ), today_quota AS (
        SELECT series, count FROM crawl_quota
        WHERE date = ${new Date().toISOString().slice(0, 10)}
          AND series IN ('F1', 'FE', 'WRC')
      )
      SELECT
        COALESCE((SELECT jsonb_agg(to_jsonb(latest_runs)) FROM latest_runs), '[]'::jsonb) AS runs,
        COALESCE((SELECT jsonb_agg(to_jsonb(latest_snapshots)) FROM latest_snapshots), '[]'::jsonb) AS snapshots,
        COALESCE((SELECT jsonb_agg(to_jsonb(today_quota)) FROM today_quota), '[]'::jsonb) AS quotas
    `])
    const summary = summaryRows[0] ?? {}
    const runs = parseJson(summary.runs) ?? []
    const snapshotRows = parseJson(summary.snapshots) ?? []
    const quotaRows = parseJson(summary.quotas) ?? []

    const snapshots = snapshotRows.map((row: any) => {
      const data = parseJson(row.data)
      const events = Array.isArray(data?.events) ? data.events : []
      const sourceEvent = eventId ? events.find((event: any) => event?.id === eventId) : null
      const tentativeCount = events.filter((event: any) => event?.tentative || event?.sessions?.some((session: any) => session?.tentative)).length
      return {
        series: row.series,
        fetchedAt: snapshotTimeUtc(row.fetched_at),
        source: typeof row.source === "string" ? row.source.slice(0, 60) : null,
        eventCount: events.length,
        tentativeCount,
        sourceEvent: toSample(sourceEvent),
      }
    })

    let clientCrawl: { series: Series; status: string; createdAt: string | null; receivedAt: string | null; filled: number }[] = []
    try {
      const jobs = await sql`
        SELECT DISTINCT ON (series) series, status, created_at, received_at, data
        FROM client_crawl_jobs
        WHERE series = ANY(${SERIES})
        ORDER BY series, created_at DESC
      `
      clientCrawl = jobs.map((row: any) => ({
        series: row.series,
        status: typeof row.status === "string" ? row.status : "unknown",
        createdAt: row.created_at ?? null,
        receivedAt: row.received_at ?? null,
        filled: Math.max(0, Number(parseJson(row.data)?.filled ?? 0) || 0),
      }))
    } catch {
      // The optional visitor-crawl table may not have been initialized yet.
    }

    return NextResponse.json({
      configured: true,
      telemetryAvailable: true,
      generatedAt: new Date().toISOString(),
      snapshots,
      runs: runs.map((row: any) => ({
        series: row.series,
        runId: row.run_id,
        status: row.status,
        stage: row.stage,
        triggeredBy: row.triggered_by,
        startedAt: row.started_at,
        updatedAt: row.updated_at,
        finishedAt: row.finished_at,
        eventCount: Number(row.event_count) || 0,
        sampleEvent: parseJson(row.sample_event),
        diagnostics: parseJson(row.diagnostics),
        note: typeof row.note === "string" ? row.note.slice(0, 180) : "",
      })),
      quotas: quotaRows.map((row: any) => ({ series: row.series, used: Number(row.count) || 0, limit: 10 })),
      clientCrawl,
    }, { headers })
  } catch (error) {
    console.warn("data_flow.read_failed", { error: error instanceof Error ? error.name : "unknown" })
    return NextResponse.json({ configured: true, telemetryAvailable: false, snapshots: [], runs: [], quotas: [], clientCrawl: [] }, { headers })
  }
}
