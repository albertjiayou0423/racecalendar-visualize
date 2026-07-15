import { NextResponse } from "next/server"

const FE_BASE = "https://api.formula-e.pulselive.com/formula-e/v1"

export const revalidate = 3600

export async function GET() {
  try {
    // 获取当前赛季
    const champRes = await fetch(`${FE_BASE}/championships`, {
      next: { revalidate: 3600 },
    })
    if (!champRes.ok) throw new Error(`HTTP ${champRes.status}`)
    const champJson = await champRes.json()
    const champs = champJson?.championships ?? []
    const present = champs.find((c: { status: string }) => c.status === "Present") ?? champs[champs.length - 1]
    if (!present) throw new Error("未找到当前 FE 赛季")

    // 获取车手积分榜
    const standingsRes = await fetch(
      `${FE_BASE}/standings?championshipId=${present.id}&season=2026`,
      { next: { revalidate: 3600 } }
    )
    if (!standingsRes.ok) throw new Error(`HTTP ${standingsRes.status}`)
    const standingsJson = await standingsRes.json()

    // 获取车手详情（头像、国家）
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

    // 构建车手信息映射
    const driverMap = new Map<string, {
      firstName?: string
      lastName?: string
      teamName?: string
      country?: string
      countryCode?: string
      photoUrl?: string
    }>()

    for (const d of driversJson?.drivers ?? []) {
      driverMap.set(d.driverId, {
        firstName: d.firstName,
        lastName: d.lastName,
        teamName: d.teamName,
        country: d.country,
        countryCode: d.countryCode,
        photoUrl: d.photoUrl,
      })
    }

    // 从积分榜提取数据
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