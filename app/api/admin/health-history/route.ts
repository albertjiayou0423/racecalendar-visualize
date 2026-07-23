import { NextResponse } from "next/server"
import { getSql } from "@/lib/db"

export async function GET(request: Request) {
  const sql = getSql()
  if (!sql) {
    return NextResponse.json({ ok: false, message: "数据库不可用" }, { status: 503 })
  }

  const { searchParams } = new URL(request.url)
  const hours = Math.min(parseInt(searchParams.get("hours") || "24", 10), 168)

  try {
    const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString()
    const rows = await sql`
      SELECT checked_at, service, ok, event_count, note
      FROM service_health_log
      WHERE checked_at >= ${since}
      ORDER BY checked_at DESC
      LIMIT 1000
    `
    return NextResponse.json({ ok: true, data: rows })
  } catch (err) {
    console.error("Health history error:", err)
    return NextResponse.json({ ok: false, message: "查询失败" }, { status: 500 })
  }
}
