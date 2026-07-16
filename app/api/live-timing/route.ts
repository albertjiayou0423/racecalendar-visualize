import { NextRequest, NextResponse } from "next/server"
import type { LiveTimingData, LiveTimingDriver, OpenF1Session, OpenF1Driver, OpenF1Position, OpenF1Lap } from "@/lib/live-timing"

const OPENF1_BASE = "https://api.openf1.org/v1"

async function fetchOpenF1<T>(endpoint: string, params?: Record<string, string>): Promise<T | null> {
  try {
    const url = new URL(`${OPENF1_BASE}/${endpoint}`)
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value) url.searchParams.set(key, value)
      })
    }
    const res = await fetch(url.toString(), { next: { revalidate: 0 } })
    if (!res.ok) return null
    return await res.json() as T
  } catch (err) {
    console.error(`OpenF1 fetch error [${endpoint}]:`, err)
    return null
  }
}

async function getF1LiveTiming(): Promise<LiveTimingData | null> {
  // 获取最新的 session
  const sessions = await fetchOpenF1<OpenF1Session[]>("sessions", {
    year: new Date().getFullYear().toString(),
  })

  if (!sessions || sessions.length === 0) return null

  // 找到最近的或正在进行的 session
  const now = new Date().toISOString()
  const activeSession = sessions
    .filter((s) => s.date_start <= now && s.date_end >= now)
    .sort((a, b) => new Date(b.date_start).getTime() - new Date(a.date_start).getTime())[0]

  const latestSession = activeSession || sessions
    .filter((s) => s.date_start <= now)
    .sort((a, b) => new Date(b.date_start).getTime() - new Date(a.date_start).getTime())[0]

  if (!latestSession) return null

  const sessionKey = latestSession.session_key.toString()

  // 并行获取车手、位置、圈速数据
  const [drivers, positions, laps] = await Promise.all([
    fetchOpenF1<OpenF1Driver[]>("drivers", { session_key: sessionKey }),
    fetchOpenF1<OpenF1Position[]>("position", { session_key: sessionKey }),
    fetchOpenF1<OpenF1Lap[]>("laps", { session_key: sessionKey }),
  ])

  if (!drivers || drivers.length === 0) return null

  // 获取每个车手的最新位置
  const latestPositions = new Map<number, OpenF1Position>()
  if (positions) {
    positions.forEach((p) => {
      const existing = latestPositions.get(p.driver_number)
      if (!existing || new Date(p.date) > new Date(existing.date)) {
        latestPositions.set(p.driver_number, p)
      }
    })
  }

  // 获取每个车手的最新圈速
  const latestLaps = new Map<number, OpenF1Lap>()
  const bestLaps = new Map<number, number>()
  if (laps) {
    laps.forEach((l) => {
      const existing = latestLaps.get(l.driver_number)
      if (!existing || l.lap_number > existing.lap_number) {
        latestLaps.set(l.driver_number, l)
      }
      // 记录最佳圈速
      if (l.lap_duration && (!bestLaps.has(l.driver_number) || l.lap_duration < bestLaps.get(l.driver_number)!)) {
        bestLaps.set(l.driver_number, l.lap_duration)
      }
    })
  }

  // 构建车手数据
  const driverList: LiveTimingDriver[] = drivers
    .map((d) => {
      const pos = latestPositions.get(d.driver_number)
      const lap = latestLaps.get(d.driver_number)
      const bestLap = bestLaps.get(d.driver_number)

      return {
        position: pos?.position ?? 0,
        driverNumber: d.driver_number.toString(),
        driverCode: d.name_acronym,
        driverName: d.broadcast_name || d.full_name,
        team: d.team_name,
        teamColor: d.team_colour ? `#${d.team_colour}` : undefined,
        gap: "—",
        interval: "—",
        lastLap: lap?.lap_duration ? formatLapTime(lap.lap_duration) : "—",
        bestLap: bestLap ? formatLapTime(bestLap) : "—",
        laps: lap?.lap_number ?? 0,
        pitStops: 0,
        retired: false,
      }
    })
    .filter((d) => d.position > 0)
    .sort((a, b) => a.position - b.position)

  // 计算差距（简化版：第一名 gap 为 —，其他为与前一名的差距）
  if (driverList.length > 1) {
    // 由于没有精确的 gap 数据，这里简化处理
    for (let i = 1; i < driverList.length; i++) {
      driverList[i].gap = `+${i * 2}.5` // 占位，实际应从interval数据计算
    }
  }

  const isLive = activeSession !== undefined
  const status = isLive ? "live" : "finished"

  return {
    series: "F1",
    sessionName: latestSession.session_name,
    status,
    totalLaps: 0, // OpenF1 不直接提供总圈数
    currentLap: Math.max(...driverList.map((d) => d.laps), 0),
    safetyCar: false,
    virtualSafetyCar: false,
    redFlag: false,
    drivers: driverList,
    lastUpdated: new Date().toISOString(),
    source: "OpenF1",
  }
}

function formatLapTime(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins}:${secs.toFixed(3).padStart(6, "0")}`
}

// WRC Live Timing - 返回官方链接
function getWRCLiveTiming(): LiveTimingData {
  return {
    series: "WRC",
    sessionName: "Live Timing",
    status: "live",
    safetyCar: false,
    virtualSafetyCar: false,
    redFlag: false,
    drivers: [],
    lastUpdated: new Date().toISOString(),
    source: "wrc.com",
  }
}

// FE Live Timing - 返回官方链接
function getFELiveTiming(): LiveTimingData {
  return {
    series: "FE",
    sessionName: "Live Timing",
    status: "live",
    safetyCar: false,
    virtualSafetyCar: false,
    redFlag: false,
    drivers: [],
    lastUpdated: new Date().toISOString(),
    source: "fiaformulae.com",
  }
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const series = searchParams.get("series")

  if (!series || !["F1", "FE", "WRC"].includes(series)) {
    return NextResponse.json({ error: "Invalid series. Use F1, FE, or WRC" }, { status: 400 })
  }

  try {
    let data: LiveTimingData | null = null

    switch (series) {
      case "F1":
        data = await getF1LiveTiming()
        break
      case "WRC":
        data = getWRCLiveTiming()
        break
      case "FE":
        data = getFELiveTiming()
        break
    }

    if (!data) {
      return NextResponse.json({ error: "No live timing data available" }, { status: 404 })
    }

    return NextResponse.json(data)
  } catch (err) {
    console.error("Live timing error:", err)
    return NextResponse.json({ error: "Failed to fetch live timing" }, { status: 500 })
  }
}
