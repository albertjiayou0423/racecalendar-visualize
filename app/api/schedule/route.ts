import { NextResponse } from "next/server"
import { fetchF1, fetchFe, fetchWrc } from "@/lib/fetchers"
import { buildWrcEvents } from "@/lib/wrc-data"
import type { ScheduleResponse } from "@/lib/types"

export const dynamic = "force-dynamic"
export const maxDuration = 300

const MAX_DAILY_REQUESTS = 100
let todayCount = 0
let todayDate = new Date().toDateString()

function getTodayCount(): number {
  const now = new Date().toDateString()
  if (now !== todayDate) {
    todayDate = now
    todayCount = 0
  }
  return todayCount
}

function incrementCount() {
  todayCount++
}

export async function GET() {
  const count = getTodayCount()
  const shouldScrapeWrc = count < MAX_DAILY_REQUESTS

  if (shouldScrapeWrc) {
    incrementCount()
  }

  const [f1, fe, wrc] = await Promise.all([
    fetchF1(),
    fetchFe(),
    shouldScrapeWrc ? fetchWrc() : Promise.resolve({ events: buildWrcEvents(), ok: false, note: "今日爬取次数已达上限，使用估计数据" }),
  ])
  
  const wrcEvents = wrc.ok && wrc.events.length > 0 
    ? wrc.events 
    : buildWrcEvents()

  const body: ScheduleResponse = {
    events: [...f1.events, ...wrcEvents, ...fe.events],
    sources: [
      {
        series: "F1",
        label: "Jolpica F1 API（Ergast 兼容）",
        ok: f1.ok,
        note: f1.ok ? "实时公开数据，时间为 UTC" : f1.note,
      },
      {
        series: "WRC",
        label: "WRC 官方 itinerary（爬取 / ocblacktop fallback）",
        ok: wrc.ok,
        note: wrc.ok 
          ? wrc.note || "成功从官方 itinerary 爬取真实赛段时间"
          : "爬取失败，使用估计时间（以官方 itinerary 为准）",
      },
      {
        series: "FE",
        label: "Formula E 官方 API（pulselive）",
        ok: fe.ok,
        note: fe.ok ? "实时公开数据，含当地时间与 GMT 偏移" : fe.note,
      },
    ],
    fetchedAt: new Date().toISOString(),
  }

  return NextResponse.json(body)
}
