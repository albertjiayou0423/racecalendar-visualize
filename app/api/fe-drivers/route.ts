import { NextResponse } from "next/server"

const FE_BASE = "https://api.formula-e.pulselive.com/formula-e/v1"

export const revalidate = 3600

export async function GET() {
  try {
    const champRes = await fetch(`${FE_BASE}/championships`, {
      next: { revalidate: 3600 },
    })
    if (!champRes.ok) throw new Error(`HTTP ${champRes.status}`)
    const champJson = await champRes.json()
    const champs = champJson?.championships ?? []
    const present = champs.find((c: { status: string }) => c.status === "Present") ?? champs[champs.length - 1]
    if (!present) throw new Error("未找到当前 FE 赛季")

    const champDetails = await fetch(`${FE_BASE}/championships/${present.id}`, {
      next: { revalidate: 3600 },
    })
    const champData = champDetails.ok ? await champDetails.json() : {}
    const lastFinishedRound = champData?.lastFinishedRound ?? 0

    if (lastFinishedRound === 0) {
      return NextResponse.json({
        drivers: [],
        ok: true,
        note: "当前赛季尚未开始，暂无积分榜数据",
      })
    }

    const standingsRes = await fetch(
      `${FE_BASE}/standings?championshipId=${present.id}&season=2026`,
      { next: { revalidate: 3600 } }
    )

    if (!standingsRes.ok) {
      return NextResponse.json({
        drivers: [],
        ok: true,
        note: "FE 官方积分榜接口暂不可用",
      })
    }

    const standingsJson = await standingsRes.json()

    const driversRes = await fetch(`${FE_BASE}/drivers?championshipId=${present.id}`, {
      next: { revalidate: 3600 },
    })
    const driversJson = driversRes.ok ? await driversRes.json() : { drivers: [] }

    const drivers: {
      code: string
      name: string
      team: string
      country: string
      countryCode: string
      photoUrl: string
      points: number
      position: number
    }[] = []

    const driverMap = new Map<string, {
      firstName?: string
      lastName?: string
      teamName?: string
      country?: string
      countryCode?: string
      photoUrl?: string
    }>()

    for (const d of driversJson?.drivers ?? []) {
      driverMap.set(d.id, {
        firstName: d.driverFirstName,
        lastName: d.driverLastName,
        teamName: d.team?.name,
        country: d.country,
        countryCode: d.countryCode,
        photoUrl: d.photoUrl,
      })
    }

    for (const entry of standingsJson?.driverStandings ?? []) {
      const info = driverMap.get(entry.driverId) ?? {}
      drivers.push({
        code: entry.driverCode ?? entry.driverId,
        name: `${info.firstName ?? ""} ${info.lastName ?? ""}`.trim() || entry.driverName,
        team: info.teamName ?? entry.teamName ?? "",
        country: info.country ?? "",
        countryCode: info.countryCode ?? "",
        photoUrl: info.photoUrl ?? "",
        points: entry.points ?? 0,
        position: entry.position ?? 0,
      })
    }

    return NextResponse.json({ drivers, ok: true })
  } catch (err) {
    return NextResponse.json(
      { drivers: [], ok: false, note: err instanceof Error ? err.message : "FE 车手数据获取失败" },
      { status: 500 }
    )
  }
}