import { NextResponse } from "next/server"
import { fetchF1, fetchFe } from "@/lib/fetchers"
import { buildWrcEvents } from "@/lib/wrc-data"
import type { ScheduleResponse } from "@/lib/types"

export const revalidate = 3600

export async function GET() {
  const [f1, fe] = await Promise.all([fetchF1(), fetchFe()])
  const wrcEvents = buildWrcEvents()

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
        label: "FIA / WRC 官方赛历",
        ok: true,
        note: "官方公布赛历（赛段具体时间以官方 itinerary 为准）",
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
