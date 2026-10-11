import { NextRequest, NextResponse } from "next/server"
import { fetchJolpicaResults } from "@/lib/jolpica-results"
import { fetchFeResults } from "@/lib/fe-results"
export async function GET(request: NextRequest) {
  const series = request.nextUrl.searchParams.get("series") || "F1"
  const season = request.nextUrl.searchParams.get("season") || String(new Date().getFullYear())
  const year = Number(season)
  if (!["F1", "FE"].includes(series) || !/^\d{4}$/.test(season) || year < (series === "FE" ? 2015 : 1950) || year > new Date().getFullYear() + 1) {
    return NextResponse.json({ ok: false, note: "系列或赛季参数无效" }, { status: 400 })
  }
  try {
    if (series === "F1") return NextResponse.json({ series, season, races: await fetchJolpicaResults(season), ok: true })
    const race = request.nextUrl.searchParams.get("race") || undefined
    if (race && !/^\d+-[a-z0-9-]+$/.test(race)) return NextResponse.json({ ok: false, note: "赛事参数无效" }, { status: 400 })
    return NextResponse.json({ series, season, ...await fetchFeResults(year, race), ok: true })
  } catch {
    return NextResponse.json({ series, season, races: [], results: {}, ok: false, note: series + " 赛果暂时无法加载，请稍后重试。" }, { status: 502, headers: { "Cache-Control": "no-store" } })
  }
}
