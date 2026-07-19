import { NextRequest, NextResponse } from "next/server"
import type { LiveTimingData, LiveTimingDriver, OpenF1Session, OpenF1Driver, OpenF1Position, OpenF1Lap } from "@/lib/live-timing"

const OPENF1_BASE = "https://api.openf1.org/v1"

interface OpenF1Interval {
  gap_to_leader: number | null
  interval: number | null
  driver_number: number
  date: string
}

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
  const sessions = await fetchOpenF1<OpenF1Session[]>("sessions", {
    year: new Date().getFullYear().toString(),
  })

  if (!sessions || sessions.length === 0) return null

  const now = new Date().toISOString()
  const activeSession = sessions
    .filter((s) => s.date_start <= now && s.date_end >= now)
    .sort((a, b) => new Date(b.date_start).getTime() - new Date(a.date_start).getTime())[0]

  if (!activeSession) return null

  const sessionKey = activeSession.session_key.toString()

  const [drivers, positions, laps, intervals] = await Promise.all([
    fetchOpenF1<OpenF1Driver[]>("drivers", { session_key: sessionKey }),
    fetchOpenF1<OpenF1Position[]>("position", { session_key: sessionKey }),
    fetchOpenF1<OpenF1Lap[]>("laps", { session_key: sessionKey }),
    fetchOpenF1<OpenF1Interval[]>("intervals", { session_key: sessionKey }),
  ])

  if (!drivers || drivers.length === 0) return null

  const latestPositions = new Map<number, OpenF1Position>()
  if (positions) {
    positions.forEach((p) => {
      const existing = latestPositions.get(p.driver_number)
      if (!existing || new Date(p.date) > new Date(existing.date)) {
        latestPositions.set(p.driver_number, p)
      }
    })
  }

  const latestLaps = new Map<number, OpenF1Lap>()
  const bestLaps = new Map<number, number>()
  if (laps) {
    laps.forEach((l) => {
      const existing = latestLaps.get(l.driver_number)
      if (!existing || l.lap_number > existing.lap_number) {
        latestLaps.set(l.driver_number, l)
      }
      if (l.lap_duration && (!bestLaps.has(l.driver_number) || l.lap_duration < bestLaps.get(l.driver_number)!)) {
        bestLaps.set(l.driver_number, l.lap_duration)
      }
    })
  }

  // 引入 intervals 大盘数据
  const latestIntervals = new Map<number, OpenF1Interval>()
  if (intervals) {
    intervals.forEach((inv) => {
      const existing = latestIntervals.get(inv.driver_number)
      if (!existing || new Date(inv.date) > new Date(existing.date)) {
        latestIntervals.set(inv.driver_number, inv)
      }
    })
  }

  const driverList: LiveTimingDriver[] = drivers
    .map((d) => {
      const pos = latestPositions.get(d.driver_number)
      const lap = latestLaps.get(d.driver_number)
      const bestLap = bestLaps.get(d.driver_number)
      const inv = latestIntervals.get(d.driver_number)

      // 根据 OpenF1 intervals 规范完美解析 gap 差距
      let gapStr = "—"
      if (inv) {
        if (inv.gap_to_leader === null || inv.gap_to_leader === undefined) {
          gapStr = pos?.position === 1 ? "LEADER" : "—"
        } else if (typeof inv.gap_to_leader === "number") {
          gapStr = pos?.position === 1 ? "LEADER" : `+${inv.gap_to_leader.toFixed(3)}`
        } else {
          gapStr = String(inv.gap_to_leader)
        }
      }

      // 根据 OpenF1 intervals 规范完美解析 interval 区间
      let intervalStr = "—"
      if (inv) {
        if (inv.interval === null || inv.interval === undefined) {
          intervalStr = "—"
        } else if (typeof inv.interval === "number") {
          intervalStr = pos?.position === 1 ? "—" : `+${inv.interval.toFixed(3)}`
        } else {
          intervalStr = String(inv.interval)
        }
      }

      return {
        position: pos?.position ?? 0,
        driverNumber: d.driver_number.toString(),
        driverCode: d.name_acronym,
        driverName: d.broadcast_name || d.full_name,
        team: d.team_name,
        teamColor: d.team_colour ? `#${d.team_colour}` : undefined,
        gap: gapStr,
        interval: intervalStr,
        lastLap: lap?.lap_duration ? formatLapTime(lap.lap_duration) : "—",
        bestLap: bestLap ? formatLapTime(bestLap) : "—",
        laps: lap?.lap_number ?? 0,
        pitStops: 0,
        retired: false,
      }
    })
    .filter((d) => d.position > 0)
    .sort((a, b) => a.position - b.position)

  return {
    series: "F1",
    sessionName: activeSession.session_name,
    status: "live",
    totalLaps: 0,
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
