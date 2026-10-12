import { NextRequest, NextResponse } from "next/server"
import { fetchFeStandings } from "@/lib/fe-results"

export async function GET(request: NextRequest) {
  const seasonValue = request.nextUrl.searchParams.get("season")
  const season = seasonValue === null ? undefined : Number(seasonValue)
  if (seasonValue !== null && (!/^\d{1,2}$/.test(seasonValue) || !Number.isInteger(season) || season! < 1)) {
    return NextResponse.json({ ok: false, drivers: [], note: "FE 赛季参数无效。" }, { status: 400, headers: { "Cache-Control": "no-store" } })
  }
  try {
    return NextResponse.json({ drivers: await fetchFeStandings(season), ok: true, season: season ?? null }, {
      headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400" },
    })
  } catch {
    return NextResponse.json({ drivers: [], ok: false, note: "FE 官方积分榜暂时无法加载，请稍后重试。" }, { status: 502, headers: { "Cache-Control": "no-store" } })
  }
}
