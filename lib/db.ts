import { neon } from "@neondatabase/serverless"

const DATABASE_URL = process.env.DATABASE_URL

if (!DATABASE_URL) {
  throw new Error("DATABASE_URL is not defined")
}

export const sql = neon(DATABASE_URL)

// 初始化表
export async function initDb() {
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
}
