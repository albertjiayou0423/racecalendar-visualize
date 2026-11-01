import { NextResponse } from "next/server"
import { logServerError } from "@/lib/server-log"
import { getSql } from "@/lib/db"
import { getLatestSnapshot } from "@/lib/crawl-store"
import { recordScheduleHealth, sendDatabaseAvailabilityAlert, sendMonthlyHealthReport, sendScheduleIncidentAlert } from "@/lib/notification-mail"

export const dynamic = "force-dynamic"
export const maxDuration = 30

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret) {
    logServerError("notifications.cron_secret_missing")
    return NextResponse.json({ ok: false, reason: "cron-secret-not-configured" }, { status: 503 })
  }
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false }, { status: 401 })
  }

  try {
    const sql = getSql()
    if (!sql) throw new Error("DATABASE_URL is not configured")
    await sql`SELECT 1`

    // Read persisted snapshots only; the health check must never start a crawl.
    const series = ["F1", "FE", "WRC"] as const
    const snapshots = await Promise.all(series.map(name => getLatestSnapshot(name)))
    const statuses = snapshots.map((snapshot, index) => ({
      series: series[index],
      ok: Boolean(snapshot?.data?.ok && snapshot.data.events?.length),
    }))
    await recordScheduleHealth(statuses)
    if (statuses.every(status => !status.ok)) await sendScheduleIncidentAlert()

    const result = await sendMonthlyHealthReport()
    return NextResponse.json({ ok: true, healthChecked: true, ...result }, { headers: { "Cache-Control": "no-store" } })
  } catch (error) {
    logServerError("notifications.daily_health_check_failed", {}, error)
    await sendDatabaseAvailabilityAlert()
    return NextResponse.json({ ok: false, reason: "health-check-failed" }, { status: 500, headers: { "Cache-Control": "no-store" } })
  }
}
