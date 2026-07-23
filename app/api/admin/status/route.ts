import { NextResponse } from "next/server"
import { fetchF1, fetchFe, fetchWrc } from "@/lib/fetchers"
import { getSql } from "@/lib/db"

export const maxDuration = 300

export async function GET() {
  const [f1, fe, wrc] = await Promise.all([fetchF1(), fetchFe(), fetchWrc()])

  const result = {
    status: "ok",
    timestamp: new Date().toISOString(),
    services: {
      f1: { ok: f1.ok, eventCount: f1.events.length, note: f1.note, status: f1.ok ? "success" : "error" },
      fe: { ok: fe.ok, eventCount: fe.events.length, note: fe.note, status: fe.ok ? "success" : "error" },
      wrc: { ok: wrc.ok, eventCount: wrc.events.length, note: wrc.note, status: wrc.ok ? "success" : "error" },
    },
  }

  // 异步记录到数据库
  const sql = getSql()
  if (sql) {
    try {
      const nowIso = new Date().toISOString()
      for (const [key, svc] of Object.entries(result.services)) {
        await sql`
          INSERT INTO service_health_log (checked_at, service, ok, event_count, note)
          VALUES (${nowIso}, ${key}, ${svc.ok}, ${svc.eventCount}, ${svc.note ?? null})
        `
      }
    } catch (e) {
      console.error("Failed to log health:", e)
    }
  }

  return NextResponse.json(result)
}
