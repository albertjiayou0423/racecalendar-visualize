import { NextRequest, NextResponse } from "next/server"
export async function GET(request: NextRequest) {
  const season = request.nextUrl.searchParams.get("season") ?? String(new Date().getFullYear())
  if (!/^\d{4}$/.test(season) || Number(season) < 1950 || Number(season) > new Date().getFullYear()) return NextResponse.json({ ok: false, drivers: [] }, { status: 400 })
  try {
    const response = await fetch(`https://api.jolpi.ca/ergast/f1/${season}/driverStandings.json?limit=100`, { next: { revalidate: 3600 }, signal: AbortSignal.timeout(10000) })
    if (!response.ok) throw new Error("upstream")
    const rows = (await response.json())?.MRData?.StandingsTable?.StandingsLists?.[0]?.DriverStandings
    if (!Array.isArray(rows) || !rows.length) throw new Error("empty")
    const drivers = rows.map((row: { Driver: { code?: string; driverId?: string; givenName: string; familyName: string }; Constructors?: { name: string }[] }) => ({
      code: row.Driver.code?.trim() || row.Driver.driverId?.trim().toUpperCase(),
      name: `${row.Driver.givenName} ${row.Driver.familyName}`,
      team: row.Constructors?.at(-1)?.name ?? "",
    }))
    if (drivers.some(driver => !driver.code || !driver.name.trim())) throw new Error("invalid")
    return NextResponse.json({ ok: true, drivers })
  } catch (error) {
    console.error("Failed to fetch F1 prediction candidates:", error instanceof Error ? error.message : "unknown error")
    return NextResponse.json({ ok: false, drivers: [], note: "该赛季预测候选暂时无法加载，请重试。" }, { status: 502, headers: { "Cache-Control": "no-store" } })
  }
}
