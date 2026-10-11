import { NextResponse } from "next/server"
import { fetchFeStandings } from "@/lib/fe-results"
export async function GET() {
  try {
    return NextResponse.json({ drivers: await fetchFeStandings(), ok: true })
  } catch {
    return NextResponse.json({ drivers: [], ok: false, note: "FE 官方积分榜暂时无法加载，请稍后重试。" }, { status: 502, headers: { "Cache-Control": "no-store" } })
  }
}
