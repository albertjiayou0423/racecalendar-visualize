import { NextRequest, NextResponse } from "next/server"
import { fetchJolpicaResults } from "@/lib/jolpica-results"
import { fetchFeResults } from "@/lib/fe-results"
import { fetchWrcSeasonResults } from "@/lib/wrc-results"
import { logServerError } from "@/lib/server-log"
export async function GET(request: NextRequest) {
  const series = request.nextUrl.searchParams.get("series") || "F1"
  const season = request.nextUrl.searchParams.get("season") || String(new Date().getFullYear())
  const year = Number(season)
  const minimumYear = series === "FE" ? 2015 : series === "WRC" ? 2018 : 1950
  if (!["F1", "FE", "WRC"].includes(series) || !/^\d{4}$/.test(season) || year < minimumYear || year > new Date().getFullYear() + 1) {
    return NextResponse.json({ ok: false, note: "系列或赛季参数无效" }, { status: 400 })
  }
  try {
    if (series === "F1") return NextResponse.json({ series, season, races: await fetchJolpicaResults(season), ok: true })
    if (series === "WRC") {
      const rallies = await fetchWrcSeasonResults(year)
      const note = rallies.length > 0 && rallies.every(rally => !rally.resultsAvailable)
        ? "赛程目录已加载，但暂时无法取得各站最终排名，请稍后重试。"
        : undefined
      return NextResponse.json({ series, season, rallies, ok: true, ...(note ? { note } : {}) }, {
        headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400" },
      })
    }
    const race = request.nextUrl.searchParams.get("race") || undefined
    if (race && !/^\d+-[a-z0-9-]+$/.test(race)) return NextResponse.json({ ok: false, note: "赛事参数无效" }, { status: 400 })
    return NextResponse.json({ series, season, ...await fetchFeResults(year, race), ok: true })
  } catch (error) {
    logServerError("api.results.fetch_failed", { series, season, hasRaceFilter: Boolean(request.nextUrl.searchParams.get("race")) }, error)
    return NextResponse.json({ series, season, races: [], results: {}, ok: false, note: series + " 赛果暂时无法加载，请稍后重试。" }, { status: 502, headers: { "Cache-Control": "no-store" } })
  }
}
