import { neon, type NeonQueryFunction } from "@neondatabase/serverless"

let sqlInstance: NeonQueryFunction | null = null
let initialized = false

export function getSql(): NeonQueryFunction | null {
  const DATABASE_URL = process.env.DATABASE_URL
  if (!DATABASE_URL) return null
  
  if (!sqlInstance) {
    try {
      sqlInstance = neon(DATABASE_URL)
    } catch {
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
  } catch {
    // ignore errors (table might already exist)
  }
}

export function isDbAvailable(): boolean {
  return !!process.env.DATABASE_URL
}