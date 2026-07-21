import { NextRequest, NextResponse } from "next/server"

const FE_BASE = "https://api.formula-e.pulselive.com/formula-e/v1"

interface F1Result {
  position: string
  Driver: {
    givenName: string
    familyName: string
    code: string
    nationality: string
  }
  Constructor: {
    name: string
  }
  laps: string
  Time?: { time: string }
  status: string
  grid: string
  points: string
}

interface F1Race {
  season: string
  round: string
  raceName: string
  Circuit: {
    circuitName: string
    Location: { locality: string; country: string }
  }
  date: string
  Results: F1Result[]
}

interface FeRaceResult {
  position: string
  driver: string
  driverCode: string
  team: string
  points: number
  fastestLap?: string
}

interface FeRace {
  id: string
  name: string
  sequence: number
  date: string
  city: string
  country: string
}

async function fetchF1Results(season: string): Promise<{ races: F1Race[]; ok: boolean; note?: string }> {
  try {
    const res = await fetch(`https://api.jolpi.ca/ergast/f1/${season}/results.json?limit=1000`, {
      next: { revalidate: 3600 },
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)

    const json = await res.json()
    const races: F1Race[] = json?.MRData?.RaceTable?.Races ?? []

    return { races, ok: true }
  } catch (err) {
    return { races: [], ok: false, note: err instanceof Error ? err.message : "F1 赛果获取失败" }
  }
}

async function fetchFeResults(season: string): Promise<{ races: FeRace[]; results: Record<string, FeRaceResult[]>; ok: boolean; note?: string }> {
  try {
    const champRes = await fetch(`${FE_BASE}/championships`, { next: { revalidate: 3600 } })
    if (!champRes.ok) throw new Error(`HTTP ${champRes.status}`)

    const champJson = await champRes.json()
    const champs = champJson?.championships ?? []
    const currentYear = new Date().getFullYear()
    const targetYear = Number(season) || currentYear

    const targetChamp = champs.find((c: { name: string }) => c.name?.includes(String(targetYear)))
    if (!targetChamp) {
      return { races: [], results: {}, ok: false, note: `未找到 ${targetYear} 赛季 FE 数据` }
    }

    const racesRes = await fetch(`${FE_BASE}/races?championshipId=${targetChamp.id}`, { next: { revalidate: 3600 } })
    if (!racesRes.ok) throw new Error(`HTTP ${racesRes.status}`)

    const racesJson = await racesRes.json()
    const races: FeRace[] = (racesJson?.races ?? []).map((r: FeRace) => r)

    const results: Record<string, FeRaceResult[]> = {}
    for (const race of races) {
      try {
        const res = await fetch(`${FE_BASE}/races/${race.id}/results`, { next: { revalidate: 3600 } })
        if (!res.ok) continue
        const data = await res.json()
        const raceResults: FeRaceResult[] = (data?.results ?? []).map((r: { position: number; driver: { name: string; code: string }; team: { name: string }; points: number; fastestLapTime?: string }) => ({
          position: String(r.position),
          driver: r.driver?.name || "Unknown",
          driverCode: r.driver?.code || "",
          team: r.team?.name || "Unknown",
          points: r.points || 0,
          fastestLap: r.fastestLapTime,
        }))
        results[race.id] = raceResults
      } catch {
        // ignore individual race errors
      }
    }

    return { races, results, ok: true }
  } catch (err) {
    return { races: [], results: {}, ok: false, note: err instanceof Error ? err.message : "FE 赛果获取失败" }
  }
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const series = searchParams.get("series") || "F1"
  const season = searchParams.get("season") || new Date().getFullYear().toString()

  try {
    if (series === "F1") {
      const { races, ok, note } = await fetchF1Results(season)
      return NextResponse.json({ series, season, races, ok, note })
    }

    if (series === "FE") {
      const { races, results, ok, note } = await fetchFeResults(season)
      return NextResponse.json({ series, season, races, results, ok, note })
    }

    return NextResponse.json({ error: "Unsupported series" }, { status: 400 })
  } catch (err) {
    console.error("Results API error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
