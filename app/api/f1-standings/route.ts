import { NextRequest, NextResponse } from "next/server"

const API_BASE = "https://api.jolpi.ca/ergast/f1"
const CACHE_SECONDS = 3600
const UPSTREAM_TIMEOUT_MS = 10000

type StandingType = "drivers" | "constructors"

interface JolpicaResponse {
  MRData?: {
    StandingsTable?: {
      season?: string
      StandingsLists?: Array<{
        round?: string
        DriverStandings?: unknown[]
        ConstructorStandings?: unknown[]
      }>
    }
  }
}

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams
  const type = params.get("type") ?? "drivers"
  const season = params.get("season") ?? "current"
  const currentYear = new Date().getFullYear()

  if (type !== "drivers" && type !== "constructors") {
    return NextResponse.json({ ok: false, note: "积分榜类别无效。" }, { status: 400 })
  }
  if (season !== "current" && (!/^\d{4}$/.test(season) || Number(season) < 1950 || Number(season) > currentYear)) {
    return NextResponse.json({ ok: false, note: "赛季无效。" }, { status: 400 })
  }

  try {
    const response = await fetch(`${API_BASE}/${season}/${type === "drivers" ? "driverStandings" : "constructorStandings"}.json?limit=50`, {
      next: { revalidate: CACHE_SECONDS },
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
      headers: { Accept: "application/json" },
    })
    if (!response.ok) throw new Error(`Jolpica returned ${response.status}`)

    const payload = await response.json() as JolpicaResponse
    const table = payload.MRData?.StandingsTable
    const standings = table?.StandingsLists?.[0]
    const rows = type === "drivers" ? standings?.DriverStandings : standings?.ConstructorStandings
    if (!table || !standings || !Array.isArray(rows)) throw new Error("Jolpica returned an invalid standings payload")

    return NextResponse.json({
      ok: true,
      season: table.season ?? season,
      round: standings.round ?? "",
      ...(type === "drivers" ? { drivers: rows } : { constructors: rows }),
    }, { headers: { "Cache-Control": `public, s-maxage=${CACHE_SECONDS}, stale-while-revalidate=86400` } })
  } catch (error) {
    const timedOut = typeof error === "object" && error !== null && "name" in error && error.name === "TimeoutError"
    console.error("Failed to fetch F1 standings:", error instanceof Error ? error.message : "unknown error")
    return NextResponse.json({
      ok: false,
      note: timedOut ? "F1 积分榜请求超时，请稍后重试。" : "F1 积分榜暂时无法加载，请稍后重试。",
    }, { status: 502, headers: { "Cache-Control": "no-store" } })
  }
}
