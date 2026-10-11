import { NextResponse } from "next/server"
import { getLatestSnapshot, getAllOverrides, initCrawlTables } from "@/lib/crawl-store"
import { normalizeF1Metadata } from "@/lib/f1-metadata"
import { buildSubscriptionCalendar } from "@/lib/subscription-calendar"
import type { RaceEvent, Series } from "@/lib/types"

export const dynamic = "force-dynamic"
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams
  const selected = (params.get("series") || "F1,WRC,FE").split(",")
  if (!selected.length || new Set(selected).size !== selected.length || selected.length > 3 || selected.some(s => !["F1", "WRC", "FE"].includes(s)) || !["main", "all"].includes(params.get("sessions") || "main")) return NextResponse.json({ error: "订阅参数无效" }, { status: 400, headers: { "Cache-Control": "no-store" } })
  try {
    await initCrawlTables()
    const snapshots = await Promise.all(selected.map(s => getLatestSnapshot(s as Series)))
    if (snapshots.some(s => !s?.data?.events?.length)) return NextResponse.json({ error: "所选系列赛程暂不可用，请稍后重试" }, { status: 503, headers: { "Cache-Control": "no-store", "Retry-After": "3600" } })
    const overrideRows = await getAllOverrides()
    const overrides = new Map(overrideRows.map(row => [row.eventId, row.data]))
    const events = snapshots.flatMap(s => s!.data.events).map(normalizeF1Metadata).map(event => ({ ...event, ...overrides.get(event.id) })) as RaceEvent[]
    const modified = [...snapshots.map(s => s!.fetchedAt), ...overrideRows.filter(row => events.some(e => e.id === row.eventId)).map(row => row.updatedAt)].filter(s => Number.isFinite(Date.parse(s))).sort().at(-1) || "1970-01-01T00:00:00Z"
    const body = buildSubscriptionCalendar(events, params.get("sessions") === "all", new Date(modified))
    return new NextResponse(body, { headers: { "Content-Type": "text/calendar; charset=utf-8", "Content-Disposition": 'inline; filename="racecalendar-subscription.ics"', "Cache-Control": "public, max-age=300", "X-Content-Type-Options": "nosniff" } })
  } catch { return NextResponse.json({ error: "订阅暂不可用，请稍后重试" }, { status: 503, headers: { "Cache-Control": "no-store" } }) }
}
