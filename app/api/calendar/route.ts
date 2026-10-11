import { NextRequest } from "next/server"
import { buildRaceCalendar } from "@/lib/calendar"
import type { RaceEvent, Series } from "@/lib/types"

/** Stateless export: no upstream crawl or database write is needed. */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams
  const id = params.get("id") ?? ""
  const series = params.get("series") ?? ""
  const utc = params.get("utc") ?? ""
  const round = Number(params.get("round"))
  const name = params.get("name") ?? ""
  const circuit = params.get("circuit") ?? ""
  const locality = params.get("locality") ?? ""
  const country = params.get("country") ?? ""
  if (!/^[a-z0-9-]{1,100}$/.test(id) || !["F1", "FE", "WRC"].includes(series)
    || !Number.isInteger(round) || round < 1 || round > 100 || !name.trim()
    || [name, circuit, locality, country].some(value => value.length > 300)
    || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(utc) || !Number.isFinite(Date.parse(utc))
    || new Date(utc).toISOString().slice(0, 19) !== utc.slice(0, 19)) {
    return Response.json({ ok: false, note: "日历导出参数无效" }, { status: 400, headers: { "Cache-Control": "no-store" } })
  }
  const event: RaceEvent = { id, series: series as Series, round, name, circuit, locality, country, tz: "UTC", sessions: [{ name: "正赛", utc, isMain: true }] }
  const calendar = buildRaceCalendar(event)
  if (!calendar) return Response.json({ ok: false, note: "赛事时间无效" }, { status: 400 })
  return new Response(calendar, { headers: {
    "Content-Type": "text/calendar; charset=utf-8",
    "Content-Disposition": `attachment; filename="${id}.ics"`,
    "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff",
  } })
}
