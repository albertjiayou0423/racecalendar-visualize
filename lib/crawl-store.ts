import type { Series } from "./types"
import { getSql } from "./db"

// ─── 表初始化 ───────────────────────────────────────────────

/** 创建爬虫相关表（幂等，IF NOT EXISTS） */
export async function initCrawlTables(): Promise<void> {
  const sql = getSql()
  if (!sql) return

  try {
    // 爬取快照表
    await sql`
      CREATE TABLE IF NOT EXISTS crawl_snapshots (
        id SERIAL PRIMARY KEY,
        series TEXT NOT NULL,
        data JSONB NOT NULL,
        fetched_at TIMESTAMP NOT NULL DEFAULT NOW(),
        source TEXT
      )
    `

    // 爬取配额表
    await sql`
      CREATE TABLE IF NOT EXISTS crawl_quota (
        id SERIAL PRIMARY KEY,
        series TEXT NOT NULL,
        date TEXT NOT NULL,
        count INT NOT NULL DEFAULT 0,
        UNIQUE(series, date)
      )
    `

    // 手动覆盖表
    await sql`
      CREATE TABLE IF NOT EXISTS event_overrides (
        event_id TEXT PRIMARY KEY,
        data JSONB NOT NULL,
        updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_by TEXT DEFAULT 'admin'
      )
    `
  } catch (err) {
    console.error("初始化爬虫表失败:", err)
  }
}

// ─── 爬取快照 ───────────────────────────────────────────────

/** 保存爬取快照 */
export async function saveCrawlSnapshot(
  series: Series,
  data: any,
  source?: string
): Promise<void> {
  const sql = getSql()
  if (!sql) return

  try {
    await sql`
      INSERT INTO crawl_snapshots (series, data, source)
      VALUES (${series}, ${JSON.stringify(data)}, ${source ?? null})
    `
  } catch (err) {
    console.error("保存爬取快照失败:", err)
  }
}

/** 获取指定系列的最新快照 */
export async function getLatestSnapshot(
  series: Series
): Promise<{ data: any; fetchedAt: string; source: string } | null> {
  const sql = getSql()
  if (!sql) return null

  try {
    const rows = await sql`
      SELECT data, fetched_at, source
      FROM crawl_snapshots
      WHERE series = ${series}
      ORDER BY fetched_at DESC
      LIMIT 1
    `
    if (rows.length === 0) return null

    const row = rows[0]
    return {
      data: typeof row.data === "string" ? JSON.parse(row.data) : row.data,
      fetchedAt: row.fetched_at,
      source: row.source ?? "",
    }
  } catch (err) {
    console.error("获取最新快照失败:", err)
    return null
  }
}

// ─── 爬取配额 ───────────────────────────────────────────────

/** 每日爬取上限 */
const CRAWL_LIMIT = 10

/** 获取当天日期字符串 (YYYY-MM-DD) */
function todayStr(): string {
  return new Date().toISOString().slice(0, 10)
}

/** 增加爬取计数，返回当前计数和上限 */
export async function incrementCrawlCount(
  series: Series
): Promise<{ count: number; limit: number }> {
  const sql = getSql()
  if (!sql) return { count: 0, limit: CRAWL_LIMIT }

  const date = todayStr()

  try {
    // 尝试插入，若已存在则递增
    const rows = await sql`
      INSERT INTO crawl_quota (series, date, count)
      VALUES (${series}, ${date}, 1)
      ON CONFLICT (series, date)
      DO UPDATE SET count = crawl_quota.count + 1
      RETURNING count
    `
    return { count: rows[0].count, limit: CRAWL_LIMIT }
  } catch (err) {
    console.error("递增爬取计数失败:", err)
    return { count: 0, limit: CRAWL_LIMIT }
  }
}

/** 获取当日爬取配额使用情况 */
export async function getCrawlQuota(
  series: Series
): Promise<{ used: number; limit: number }> {
  const sql = getSql()
  if (!sql) return { used: 0, limit: CRAWL_LIMIT }

  const date = todayStr()

  try {
    const rows = await sql`
      SELECT count FROM crawl_quota
      WHERE series = ${series} AND date = ${date}
    `
    const used = rows.length > 0 ? rows[0].count : 0
    return { used, limit: CRAWL_LIMIT }
  } catch (err) {
    console.error("获取爬取配额失败:", err)
    return { used: 0, limit: CRAWL_LIMIT }
  }
}

// ─── 手动覆盖 ───────────────────────────────────────────────

/** 保存（upsert）手动覆盖数据 */
export async function saveEventOverride(
  eventId: string,
  data: Record<string, any>
): Promise<void> {
  const sql = getSql()
  if (!sql) return

  try {
    await sql`
      INSERT INTO event_overrides (event_id, data, updated_at)
      VALUES (${eventId}, ${JSON.stringify(data)}, NOW())
      ON CONFLICT (event_id)
      DO UPDATE SET data = ${JSON.stringify(data)}, updated_at = NOW()
    `
  } catch (err) {
    console.error("保存手动覆盖失败:", err)
  }
}

/** 获取单个赛事的手动覆盖数据 */
export async function getEventOverride(
  eventId: string
): Promise<Record<string, any> | null> {
  const sql = getSql()
  if (!sql) return null

  try {
    const rows = await sql`
      SELECT data FROM event_overrides
      WHERE event_id = ${eventId}
    `
    if (rows.length === 0) return null

    const raw = rows[0].data
    return typeof raw === "string" ? JSON.parse(raw) : raw
  } catch (err) {
    console.error("获取手动覆盖失败:", err)
    return null
  }
}

/** 获取所有手动覆盖 */
export async function getAllOverrides(): Promise<
  { eventId: string; data: Record<string, any>; updatedAt: string }[]
> {
  const sql = getSql()
  if (!sql) return []

  try {
    const rows = await sql`
      SELECT event_id, data, updated_at
      FROM event_overrides
      ORDER BY updated_at DESC
    `
    return rows.map((row: any) => ({
      eventId: row.event_id,
      data: typeof row.data === "string" ? JSON.parse(row.data) : row.data,
      updatedAt: row.updated_at,
    }))
  } catch (err) {
    console.error("获取所有覆盖失败:", err)
    return []
  }
}

/** 删除手动覆盖 */
export async function deleteEventOverride(
  eventId: string
): Promise<void> {
  const sql = getSql()
  if (!sql) return

  try {
    await sql`
      DELETE FROM event_overrides
      WHERE event_id = ${eventId}
    `
  } catch (err) {
    console.error("删除手动覆盖失败:", err)
  }
}
