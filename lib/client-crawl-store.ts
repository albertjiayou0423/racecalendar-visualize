import { createHash, randomBytes } from "node:crypto"
import { getSql } from "./db"
import { getCrawlQuota, getLatestSnapshot, initCrawlTables } from "./crawl-store"
import { buildWrcEvents } from "./wrc-data"
import { CLIENT_CRAWL_INTERVAL, clientSourceUrl, fillClientGaps, parseClientF1, type ClientCrawlJob } from "./client-crawl"
import { parseClientWrcFeed } from "./wrc-puppeteer"
import type { RaceEvent } from "./types"

const hash = (token: string) => createHash("sha256").update(token).digest("hex")
let initialized: Promise<void> | undefined
export async function initClientCrawlTable() {
  const sql = getSql()
  if (!sql) throw new Error("数据库未配置")
  if (!initialized) initialized = sql`
    CREATE TABLE IF NOT EXISTS client_crawl_jobs (
      id TEXT PRIMARY KEY, series TEXT NOT NULL, token_hash TEXT NOT NULL,
      source_url TEXT NOT NULL, event_id TEXT, expires_at TIMESTAMPTZ NOT NULL,
      status TEXT NOT NULL DEFAULT 'assigned', data JSONB, received_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `.then(() => undefined).catch(error => { initialized = undefined; throw error })
  await initialized
}

async function loadBase(series: "F1" | "WRC") {
  const snapshot = await getLatestSnapshot(series)
  const events = (snapshot?.data?.events || (series === "WRC" ? buildWrcEvents() : [])) as RaceEvent[]
  return { snapshot, events }
}

export async function claimClientJobs(now = Date.now()): Promise<ClientCrawlJob[]> {
  await initClientCrawlTable()
  const sql = getSql()!
  const jobs: ClientCrawlJob[] = []
  for (const series of ["F1", "WRC"] as const) {
    if (series === "F1") { const quota = await getCrawlQuota(series); if (quota.used >= quota.limit) continue }
    const { events: base } = await loadBase(series)
    if (!base.length) continue
    const year = new Date(now).getUTCFullYear()
    const target = series === "WRC" ? [...base].filter(event => event.eventSlug && event.sessions.length)
      .sort((a, b) => {
        const distance = (event: RaceEvent) => {
          const time = Date.parse(event.sessions[0].utc)
          return time >= now - 7 * 86400000 ? Math.abs(time - now) : Number.MAX_SAFE_INTEGER - time
        }
        return distance(a) - distance(b)
      })[0] : undefined
    if (series === "WRC" && !target) continue
    const id = `${series}-${Math.floor(now / CLIENT_CRAWL_INTERVAL)}`
    const token = randomBytes(24).toString("hex")
    const url = clientSourceUrl(series, year, target?.eventSlug)
    const rows = await sql`
      INSERT INTO client_crawl_jobs (id, series, token_hash, source_url, event_id, expires_at)
      VALUES (${id}, ${series}, ${hash(token)}, ${url}, ${target?.id || null}, ${new Date(now + 120000).toISOString()})
      ON CONFLICT (id) DO NOTHING RETURNING id
    `
    if (rows.length) jobs.push({ id, token, series, year, eventSlug: target?.eventSlug, url })
  }
  return jobs
}

export async function submitClientJob(input: { id: string; token: string; raw?: string; failed?: boolean }) {
  await initClientCrawlTable()
  const sql = getSql()!
  // One-use lease prevents parallel uploads or retries from replacing an accepted result.
  const rows = await sql`
    UPDATE client_crawl_jobs SET status = 'processing'
    WHERE id = ${input.id} AND token_hash = ${hash(input.token)} AND status = 'assigned' AND expires_at > NOW()
    RETURNING id, series, event_id, source_url
  `
  const job = rows[0]
  if (!job) return { saved: false, status: "expired-or-used", filled: 0 }
  const finish = async (status: string) => {
    await sql`UPDATE client_crawl_jobs SET status = ${status}, received_at = NOW() WHERE id = ${input.id} AND status = 'processing'`
    return { saved: false, status, filled: 0 }
  }
  if (input.failed || typeof input.raw !== "string") return finish("failed")
  const { snapshot, events: base } = await loadBase(job.series)
  let candidate: RaceEvent[]
  try {
    const json = JSON.parse(input.raw)
    const year = new Date().getUTCFullYear()
    if (job.series === "F1") candidate = parseClientF1(json, base, year)
    else {
      const target = base.find(event => event.id === job.event_id)
      if (!target) throw new Error("未知赛事")
      candidate = parseClientWrcFeed(json, target)
    }
  } catch { return finish("invalid") }
  const merged = fillClientGaps(base, candidate, job.source_url, new Date().toISOString())
  if (!merged.filled) return finish("unchanged")
  await initCrawlTables()
  const data = { events: merged.events, ok: true, dataSource: job.series === "WRC" ? "scraped" : "api", note: `客户端自动补齐 ${merged.filled} 个缺失场次；客户端时间尚未经独立核验` }
  // All application snapshot writers share this lock. The following Read Committed
  // statement sees writers that finished while acquiring it, then rejects stale input.
  const result = await sql.transaction([
    sql`SELECT pg_advisory_xact_lock(1681090, hashtext(${job.series}))`,
    sql`
    WITH accepted AS (
      UPDATE client_crawl_jobs SET status = 'saved', data = ${JSON.stringify({ filled: merged.filled, eventIds: candidate.map(event => event.id) })}::jsonb, received_at = NOW()
      WHERE id = ${input.id} AND status = 'processing'
        AND NOT EXISTS (SELECT 1 FROM crawl_snapshots WHERE series = ${job.series} AND fetched_at > ${snapshot?.fetchedAt || '1970-01-01T00:00:00Z'}::timestamptz)
        AND NOT EXISTS (SELECT 1 FROM crawl_quota WHERE series = ${job.series} AND date = ${new Date().toISOString().slice(0, 10)} AND count >= 10 AND ${job.series} <> 'WRC')
      RETURNING id
    ), saved AS (
      INSERT INTO crawl_snapshots (series, data, source, fetched_at)
      SELECT ${job.series}, ${JSON.stringify(data)}::jsonb, 'client-upload', clock_timestamp() FROM accepted RETURNING id
    ), counted AS (
      INSERT INTO crawl_quota (series, date, count)
      SELECT ${job.series}, ${new Date().toISOString().slice(0, 10)}, 1 FROM saved WHERE ${job.series} <> 'WRC'
      ON CONFLICT (series, date) DO UPDATE SET count = crawl_quota.count + 1 RETURNING id
    ) SELECT id FROM saved
    `,
  ], { isolationLevel: "ReadCommitted" })
  const saved = result[1]
  if (!saved.length) return finish("superseded-or-quota")
  return { saved: true, status: "saved", filled: merged.filled }
}
