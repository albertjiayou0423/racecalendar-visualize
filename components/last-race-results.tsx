"use client"

import { useEffect, useState } from "react"
import { Trophy, Medal, ChevronRight, Eye, AlertTriangle } from "lucide-react"

interface DriverResult {
  position: string
  points: string
  driver: {
    code: string
    givenName: string
    familyName: string
  }
  constructor: {
    name: string
  }
  time: string
  grid: string
  fastestLap: string
  status: string
}

interface LastRaceData {
  raceName: string
  round: string
  season: string
  date: string
  circuit: string
  locality: string
  country: string
  results: DriverResult[]
}

export function LastRaceResults() {
  const [data, setData] = useState<LastRaceData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [showResults, setShowResults] = useState(false)

  useEffect(() => {
    fetchLastRace()
  }, [])

  const fetchLastRace = async () => {
    try {
      const res = await fetch("https://api.jolpi.ca/ergast/f1/current/last/results.json")
      const json = await res.json()
      const race = json?.MRData?.RaceTable?.Races?.[0]
      if (!race) throw new Error("No data")

      const results: DriverResult[] = race.Results.slice(0, 10).map((r: any) => ({
        position: r.position,
        points: r.points,
        driver: {
          code: r.Driver.code,
          givenName: r.Driver.givenName,
          familyName: r.Driver.familyName,
        },
        constructor: {
          name: r.Constructor.name,
        },
        time: r.Time?.time ?? r.status,
        grid: r.grid,
        fastestLap: r.FastestLap?.Time?.time ?? "",
        status: r.status,
      }))

      setData({
        raceName: race.raceName,
        round: race.round,
        season: race.season,
        date: race.date,
        circuit: race.Circuit.circuitName,
        locality: race.Circuit.Location.locality,
        country: race.Circuit.Location.country,
        results,
      })
    } catch (e) {
      console.error("Failed to fetch last race:", e)
      setError(true)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <section className="rounded-2xl border border-border bg-card p-5 sm:p-6">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <div className="size-4 animate-pulse rounded bg-muted" />
          <div className="h-4 w-32 animate-pulse rounded bg-muted" />
        </div>
        <div className="mt-4 space-y-2">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-10 animate-pulse rounded-lg bg-muted/50" />
          ))}
        </div>
      </section>
    )
  }

  if (error || !data) return null

  const podium = data.results.slice(0, 3)
  const rest = data.results.slice(3)

  return (
    <section
      className="relative overflow-hidden rounded-2xl border border-border bg-card p-5 sm:p-6"
      aria-label="上一站回顾"
    >
      <div
        className="absolute inset-x-0 top-0 h-1"
        style={{ backgroundColor: "#E10600" }}
        aria-hidden
      />
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <span
          className="rounded px-2 py-0.5 font-bold text-white"
          style={{ backgroundColor: "#E10600" }}
        >
          F1
        </span>
        <span>Formula 1</span>
        <span>·</span>
        <span>上一站回顾</span>
      </div>

      <h2 className="mt-3 text-pretty text-xl font-bold leading-tight sm:text-2xl">
        {data.raceName}
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        {data.circuit} · {data.locality}，{data.country}
      </p>

      {!showResults ? (
        <div className="mt-5 flex flex-col items-center gap-4 rounded-xl bg-muted/30 p-6 text-center">
          <AlertTriangle className="size-8 text-amber-500" />
          <div className="max-w-xs">
            <p className="font-medium">含比赛结果剧透</p>
            <p className="mt-1 text-sm text-muted-foreground">点击下方按钮查看上一站完整成绩</p>
          </div>
          <button
            onClick={() => setShowResults(true)}
            className="flex items-center gap-2 rounded-lg bg-primary px-6 py-2.5 font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            <Eye className="size-4" />
            确认查看结果
          </button>
        </div>
      ) : (
        <>
          <div className="mt-5 grid grid-cols-3 gap-2 sm:gap-3">
            {[podium[1], podium[0], podium[2]].map((driver, idx) => {
              if (!driver) return <div key={idx} />
              const pos = idx === 0 ? 2 : idx === 1 ? 1 : 3
              const medals = ["🥈", "🥇", "🥉"]
              const heights = ["h-20", "h-28", "h-16"]
              return (
                <div key={driver.position} className="flex flex-col items-center gap-1.5">
                  <div className="text-2xl">{medals[idx]}</div>
                  <div className="text-center">
                    <div className="font-bold text-sm">{driver.driver.code}</div>
                    <div className="text-[10px] text-muted-foreground">{driver.constructor.name}</div>
                  </div>
                  <div
                    className={`w-full rounded-t-lg ${heights[idx]} flex items-end justify-center pb-2`}
                    style={{
                      backgroundColor: pos === 1 ? "#FFD70033" : pos === 2 ? "#C0C0C033" : "#CD7F3233",
                    }}
                  >
                    <span className="font-mono text-xs font-bold text-muted-foreground">
                      P{pos}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>

          <div className="mt-4 space-y-1">
            {rest.map((driver) => (
              <div
                key={driver.position}
                className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors hover:bg-muted/30"
              >
                <span className="w-6 text-center font-mono text-xs font-bold text-muted-foreground">
                  {driver.position}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">
                    {driver.driver.givenName} {driver.driver.familyName}
                  </div>
                  <div className="text-xs text-muted-foreground">{driver.constructor.name}</div>
                </div>
                <div className="text-right">
                  <div className="font-mono text-xs tabular-nums">{driver.time}</div>
                  <div className="text-[10px] text-muted-foreground">+{driver.points} pts</div>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
            <span>第 {data.round} 轮 · {data.season} 赛季</span>
            <a
              href={`https://www.formula1.com/en/results.html`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-primary hover:underline"
            >
              查看完整结果
              <ChevronRight className="size-3" />
            </a>
          </div>
        </>
      )}
    </section>
  )
}