import { NextResponse } from "next/server"
import { logServerError } from "@/lib/server-log"

/** Same-origin adapter: visitors never need to reach Jolpica themselves. */
export async function GET() {
  try {
    const response = await fetch("https://api.jolpi.ca/ergast/f1/current/last/results.json", {
      next: { revalidate: 300 }, signal: AbortSignal.timeout(10000), redirect: "error",
    })
    if (!response.ok) throw new Error("Upstream unavailable")
    const data = await response.json()
    const race = data?.MRData?.RaceTable?.Races?.[0]
    if (!race || !Array.isArray(race.Results) || !race.Results.length) throw new Error("Invalid results")
    return NextResponse.json({ ok: true, MRData: { RaceTable: { Races: [race] } } }, {
      headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=3600" },
    })
  } catch (error) {
    logServerError("api.f1_last_result.fetch_failed", {}, error)
    return NextResponse.json({ ok: false, note: "上一站赛果暂时无法加载，请稍后重试。" }, {
      status: 502, headers: { "Cache-Control": "no-store" },
    })
  }
}
