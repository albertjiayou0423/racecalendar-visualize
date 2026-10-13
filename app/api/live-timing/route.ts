import { NextRequest, NextResponse } from "next/server"
import { formatGap } from "@/lib/live-timing"
import type { LiveTimingData, LiveTimingDriver, OpenF1Session, OpenF1Driver, OpenF1Position, OpenF1Lap, OpenF1Interval, OpenF1Pit, OpenF1RaceControl } from "@/lib/live-timing"

const OPENF1_BASE = "https://api.openf1.org/v1"
const UPSTREAM_TIMEOUT_MS = 8000

async function fetchOpenF1<T>(endpoint: string, params: Record<string, string> | undefined, signal: AbortSignal): Promise<T | null> {
  try {
    const url = new URL(`${OPENF1_BASE}/${endpoint}`)
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value) url.searchParams.set(key, value)
      })
    }
    const res = await fetch(url.toString(), { next: { revalidate: 0 }, signal })
    if (!res.ok) return null
    return await res.json() as T
  } catch (err) {
    console.error(`OpenF1 fetch error [${endpoint}]:`, err)
    return null
  }
}

async function getF1LiveTiming(): Promise<LiveTimingData | null> {
  const upstreamSignal = AbortSignal.timeout(UPSTREAM_TIMEOUT_MS)
  const sessions = await fetchOpenF1<OpenF1Session[]>("sessions", {
    year: new Date().getFullYear().toString(),
  }, upstreamSignal)

  if (!sessions || sessions.length === 0) return null

  const now = new Date().toISOString()
  const activeSession = sessions
    .filter((s) => s.date_start <= now && s.date_end >= now)
    .sort((a, b) => new Date(b.date_start).getTime() - new Date(a.date_start).getTime())[0]

  if (!activeSession) return null

  const sessionKey = activeSession.session_key.toString()

  const [drivers, positions, laps, intervals, pits, raceControl] = await Promise.all([
    fetchOpenF1<OpenF1Driver[]>("drivers", { session_key: sessionKey }, upstreamSignal),
    fetchOpenF1<OpenF1Position[]>("position", { session_key: sessionKey }, upstreamSignal),
    fetchOpenF1<OpenF1Lap[]>("laps", { session_key: sessionKey }, upstreamSignal),
    fetchOpenF1<OpenF1Interval[]>("intervals", { session_key: sessionKey }, upstreamSignal),
    fetchOpenF1<OpenF1Pit[]>("pit", { session_key: sessionKey }, upstreamSignal),
    fetchOpenF1<OpenF1RaceControl[]>("race_control", { session_key: sessionKey }, upstreamSignal),
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

  const latestIntervals = new Map<number, OpenF1Interval>()
  if (intervals) {
    intervals.forEach((item) => {
      const existing = latestIntervals.get(item.driver_number)
      if (!existing || new Date(item.date) > new Date(existing.date)) latestIntervals.set(item.driver_number, item)
    })
  }

  const pitStops = new Map<number, number>()
  if (pits) pits.forEach((item) => pitStops.set(item.driver_number, (pitStops.get(item.driver_number) ?? 0) + 1))
  const raceFlags = getRaceFlags(raceControl)

  const driverList: LiveTimingDriver[] = drivers
    .map((d) => {
      const pos = latestPositions.get(d.driver_number)
      const lap = latestLaps.get(d.driver_number)
      const bestLap = bestLaps.get(d.driver_number)
      const interval = latestIntervals.get(d.driver_number)

      return {
        position: pos?.position ?? 0,
        driverNumber: d.driver_number.toString(),
        driverCode: d.name_acronym,
        driverName: d.broadcast_name || d.full_name,
        team: d.team_name,
        teamColor: d.team_colour ? `#${d.team_colour}` : undefined,
        gap: formatGap(interval?.gap_to_leader),
        interval: formatGap(interval?.interval),
        lastLap: lap?.lap_duration ? formatLapTime(lap.lap_duration) : "—",
        bestLap: bestLap ? formatLapTime(bestLap) : "—",
        laps: lap?.lap_number ?? 0,
        pitStops: pits ? pitStops.get(d.driver_number) ?? 0 : null,
        retired: null,
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
    safetyCar: raceFlags.safetyCar,
    virtualSafetyCar: raceFlags.virtualSafetyCar,
    redFlag: raceFlags.redFlag,
    drivers: driverList,
    lastUpdated: new Date().toISOString(),
    source: "OpenF1",
  }
}

function getRaceFlags(events: OpenF1RaceControl[] | null) {
  const flags = { safetyCar: null as boolean | null, virtualSafetyCar: null as boolean | null, redFlag: null as boolean | null }
  if (!events) return flags
  const sorted = [...events].sort((a, b) => Date.parse(a.date) - Date.parse(b.date))
  for (const event of sorted) {
    const message = event.message.toUpperCase()
    if (event.category === "SafetyCar") {
      const isVirtual = message.includes("VIRTUAL SAFETY CAR")
      const key = isVirtual ? "virtualSafetyCar" : "safetyCar"
      if (message.includes("DEPLOYED")) flags[key] = true
      else if (/\b(IN THIS LAP|ENDING|ENDED|WITHDRAWN)\b/.test(message)) flags[key] = false
    }
    if (event.category === "Flag" && (event.scope === "Track" || event.scope === null)) {
      const value = (event.flag ?? "").toUpperCase()
      if (value === "RED" || message.includes("RED FLAG")) flags.redFlag = true
      else if (value === "GREEN" || value === "CHEQUERED") flags.redFlag = false
    }
  }
  return flags
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
      return NextResponse.json({ error: "No live timing data available" }, {
        status: 404,
        headers: { "Cache-Control": "public, s-maxage=30, stale-while-revalidate=30", "Retry-After": "30" },
      })
    }

    return NextResponse.json(data, {
      headers: { "Cache-Control": "public, s-maxage=5, stale-while-revalidate=10" },
    })
  } catch (err) {
    console.error("Live timing error:", err)
    return NextResponse.json({ error: "Failed to fetch live timing" }, { status: 500 })
  }
}
