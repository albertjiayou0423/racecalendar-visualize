import { neon, type NeonQueryFunction } from "@neondatabase/serverless"

let sqlInstance: NeonQueryFunction | null = null
let initialized = false

function cleanDbUrl(url: string): string {
  try {
    const u = new URL(url)
    u.searchParams.delete("channel_binding")
    return u.toString()
  } catch {
    return url
  }
}

export function getSql(): NeonQueryFunction | null {
  const DATABASE_URL = process.env.DATABASE_URL
  if (!DATABASE_URL) return null
  
  if (!sqlInstance) {
    try {
      const cleanUrl = cleanDbUrl(DATABASE_URL)
      sqlInstance = neon(cleanUrl)
    } catch (err) {
      console.error("Failed to create DB connection:", err)
      return null
    }
  }
  return sqlInstance
}

export async function getSqlOrFail(): Promise<NeonQueryFunction> {
  const sql = getSql()
  if (!sql) {
    throw new Error("DATABASE_URL is not defined")
  }
  return sql
}

export async function initDb(): Promise<void> {
  const sql = getSql()
  if (!sql) return

  if (initialized) return
  initialized = true

  try {
    await sql`
      CREATE TABLE IF NOT EXISTS predictions (
        id SERIAL PRIMARY KEY,
        event_id TEXT NOT NULL,
        driver_code TEXT NOT NULL,
        voter_id TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(event_id, voter_id)
      )
    `

    await sql`
      CREATE INDEX IF NOT EXISTS idx_predictions_event_id ON predictions(event_id)
    `

    // AI API 用量追踪表
    await sql`
      CREATE TABLE IF NOT EXISTS ai_usage (
        id SERIAL PRIMARY KEY,
        date DATE NOT NULL UNIQUE,
        count INTEGER DEFAULT 0
      )
    `

    // Web Push 推送订阅表
    await sql`
      CREATE TABLE IF NOT EXISTS push_subscriptions (
        id SERIAL PRIMARY KEY,
        endpoint TEXT NOT NULL UNIQUE,
        p256dh TEXT NOT NULL,
        auth TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `

    // 服务健康度历史记录表
    await sql`
      CREATE TABLE IF NOT EXISTS service_health_log (
        id SERIAL PRIMARY KEY,
        checked_at TIMESTAMP DEFAULT NOW(),
        service TEXT NOT NULL,
        ok BOOLEAN NOT NULL,
        event_count INTEGER DEFAULT 0,
        note TEXT
      )
    `
    await sql`
      CREATE INDEX IF NOT EXISTS idx_health_log_service_time ON service_health_log(service, checked_at)
    `
  } catch {
    // ignore errors (table might already exist)
  }
}

// AI API 用量管理
const AI_DAILY_LIMIT = 50

export async function checkAiQuota(): Promise<{ allowed: boolean; remaining: number; used: number }> {
  const sql = getSql()
  if (!sql) {
    return { allowed: true, remaining: AI_DAILY_LIMIT, used: 0 }
  }

  const today = new Date().toISOString().split('T')[0]

  try {
    const result = await sql`
      SELECT count FROM ai_usage WHERE date = ${today}
    `

    const used = result[0]?.count || 0
    const remaining = Math.max(0, AI_DAILY_LIMIT - Number(used))

    return {
      allowed: Number(used) < AI_DAILY_LIMIT,
      remaining,
      used: Number(used),
    }
  } catch {
    return { allowed: true, remaining: AI_DAILY_LIMIT, used: 0 }
  }
}

export async function incrementAiUsage(): Promise<number> {
  const sql = getSql()
  if (!sql) return 0

  const today = new Date().toISOString().split('T')[0]

  try {
    // 先尝试插入
    await sql`
      INSERT INTO ai_usage (date, count)
      VALUES (${today}, 1)
      ON CONFLICT (date) DO UPDATE SET count = ai_usage.count + 1
    `

    const result = await sql`
      SELECT count FROM ai_usage WHERE date = ${today}
    `

    return Number(result[0]?.count || 1)
  } catch {
    return 0
  }
}

export function isDbAvailable(): boolean {
  return !!process.env.DATABASE_URL
}