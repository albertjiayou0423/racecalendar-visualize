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

    // 新增：WRC Itinerary 赛段数据库高可用持久化持久缓存表
    await sql`
      CREATE TABLE IF NOT EXISTS wrc_cache (
        round INTEGER PRIMARY KEY,
        sessions JSONB NOT NULL,
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `
  } catch (err) {
    console.error("Failed to init database tables:", err)
  }
}

export function isDbAvailable(): boolean {
  return !!process.env.DATABASE_URL
}
