"use client"

import { useEffect, useState } from "react"
import { Trophy, Medal, ChevronRight, Eye, AlertTriangle, ArrowUp, ArrowDown, Minus, CalendarDays, Timer } from "lucide-react"

interface DriverResult {
  position: string
  points: string
  driver: {
    driverId: string
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
  championshipPosition?: number
  championshipDelta?: number // +: up, -: down, 0: same
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
    fetchLastRaceAndDelta()
  }, [])

  const fetchLastRaceAndDelta = async () => {
    try {
      const lastRes = await fetch("https://api.jolpi.ca/ergast/f1/current/last/results.json")
      if (!lastRes.ok) throw new Error("Failed to fetch last race results")
      const lastJson = await lastRes.json()
      const race = lastJson?.MRData?.RaceTable?.Races?.[0]
      if (!race) throw new Error("No last race data found")

      const round = Number(race.round)
      const resultsRaw = race.Results || []

      let currentStandingsMap = new Map<string, number>()
      let prevStandingsMap = new Map<string, number>()

      try {
        const currentStandingsRes = await fetch(`https://api.jolpi.ca/ergast/f1/current/${round}/driverStandings.json`)
        if (currentStandingsRes.ok) {
          const currentStandingsJson = await currentStandingsRes.json()
          const list = currentStandingsJson?.MRData?.StandingsTable?.StandingsLists?.[0]?.DriverStandings || []
          list.forEach((s: any) => {
            currentStandingsMap.set(s.Driver.driverId, Number(s.position))
          })
        }

        if (round > 1) {
          const prevStandingsRes = await fetch(`https://api.jolpi.ca/ergast/f1/current/${round - 1}/driverStandings.json`)
          if (prevStandingsRes.ok) {
            const prevStandingsJson = await prevStandingsRes.json()
            const list = prevStandingsJson?.MRData?.StandingsTable?.StandingsLists?.[0]?.DriverStandings || []
            list.forEach((s: any) => {
              prevStandingsMap.set(s.Driver.driverId, Number(s.position))
            })
          }
        }
      } catch (err) {
        console.error("Failed to compute standings delta:", err)
      }

      const results: DriverResult[] = resultsRaw.slice(0, 10).map((r: any) => {
        const driverId = r.Driver.driverId
        const currentPos = currentStandingsMap.get(driverId)
        const prevPos = prevStandingsMap.get(driverId)

        let championshipDelta: number | undefined = undefined
        if (currentPos !== undefined) {
          if (prevPos !== undefined) {
            championshipDelta = prevPos - currentPos
          } else if (round > 1) {
            championshipDelta = 999
          } else {
            championshipDelta = 0
          }
        }

        return {
          position: r.position,
          points: r.points,
          driver: {
            driverId,
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
          championshipPosition: currentPos,
          championshipDelta,
        }
      })

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
      console.error("Failed to fetch last race results:", e)
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
      className="relative overflow-hidden rounded-2xl border border-border bg-card p-4 sm:p-5"
      aria-label="上一站回顾"
    >
      <div
        className="absolute inset-x-0 top-0 h-[3px]"
        style={{ backgroundColor: "#E10600" }}
        aria-hidden
      />
      <div className="flex items-center justify-between gap-2 border-b border-border/40 pb-2 mb-3">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span className="rounded bg-[#E10600] px-1.5 py-0.5 text-[9px] font-extrabold text-white font-mono">F1</span>
          <span className="font-semibold text-[10px] tracking-wider uppercase">Last Round</span>
        </div>
        <div className="flex items-center gap-1 text-[10px] font-mono text-muted-foreground/80">
          <CalendarDays className="size-3.5" />
          <span>R{data.round}</span>
        </div>
      </div>

      <h2 className="text-base sm:text-lg font-extrabold leading-tight text-foreground truncate">
        {data.raceName}
      </h2>
      <p className="text-[10px] text-muted-foreground font-mono mt-0.5 truncate">
        {data.circuit} · {data.locality}
      </p>

      {!showResults ? (
        <div className="mt-4 flex flex-col items-center gap-3 rounded-xl bg-muted/20 p-5 text-center border border-border/30">
          <AlertTriangle className="size-6 text-amber-500 animate-pulse" />
          <div>
            <p className="font-extrabold text-xs text-foreground uppercase tracking-wide">Spoiler Alert</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">结果包含领奖台与积分榜变动</p>
          </div>
          <button
            onClick={() => setShowResults(true)}
            className="rounded-lg bg-foreground text-background px-4 py-1.5 text-[10px] font-bold uppercase transition-all active:scale-95 shadow-sm"
          >
            Reveal Results
          </button>
        </div>
      ) : (
        <>
          {/* 领领奖台可视化：极简单线条高阶表现 */}
          <div className="mt-4 grid grid-cols-3 gap-2 border-b border-border/30 pb-4">
            {[podium[1], podium[0], podium[2]].map((driver, idx) => {
              if (!driver) return <div key={idx} />
              const pos = idx === 0 ? 2 : idx === 1 ? 1 : 3
              const heights = ["h-16", "h-20", "h-12"]
              const borderStyles = pos === 1
                ? "border-amber-500/35 bg-amber-500/5 text-amber-500"
                : pos === 2
                  ? "border-slate-400/35 bg-slate-400/5 text-slate-400"
                  : "border-amber-700/35 bg-amber-700/5 text-amber-600"

              return (
                <div key={driver.position} className="flex flex-col items-center gap-1">
                  <div className="text-center">
                    <div className="font-black text-xs text-foreground">{driver.driver.code}</div>
                    <div className="text-[8px] text-muted-foreground font-mono truncate max-w-[70px] mt-0.2">{driver.constructor.name}</div>
                  </div>
                  <div
                    className={`w-full rounded-lg border ${borderStyles} ${heights[idx]} flex flex-col items-center justify-end pb-1.5 gap-1 shadow-sm relative`}
                  >
                    {driver.championshipPosition !== undefined && (
                      <div className="text-[8px] font-mono font-bold flex items-center gap-0.5 px-1 py-0.2 rounded bg-black/40 text-white leading-none scale-90">
                        <Trophy className="size-2 text-muted-foreground shrink-0" />
                        <span>{driver.championshipPosition}</span>
                        {renderDeltaBadge(driver.championshipDelta)}
                      </div>
                    )}
                    <span className="font-mono text-[10px] font-extrabold uppercase opacity-85">
                      P{pos}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>

          {/* 积分列表 */}
          <div className="mt-3 space-y-1">
            {rest.map((driver) => (
              <div
                key={driver.position}
                className="flex items-center gap-3 rounded-lg px-2 py-1.5 text-xs transition-colors hover:bg-secondary/40 border border-transparent hover:border-border/30"
              >
                <span className="w-5 text-center font-mono text-[10px] font-extrabold text-muted-foreground">
                  {driver.position}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-foreground truncate">
                    {driver.driver.familyName}
                  </div>
                  <div className="text-[9px] text-muted-foreground font-mono truncate">{driver.constructor.name}</div>
                </div>

                {/* 积分位置变化：使用 Trophy 线条图标替代 WDC 文字 */}
                {driver.championshipPosition !== undefined && (
                  <div className="flex items-center gap-0.5 text-[9px] px-1.5 py-0.5 rounded bg-secondary/45 shrink-0 font-mono text-muted-foreground/90 border border-border/20">
                    <Trophy className="size-2.5 text-muted-foreground" />
                    <span className="font-extrabold text-foreground">{driver.championshipPosition}</span>
                    {renderDeltaBadge(driver.championshipDelta)}
                  </div>
                )}

                <div className="text-right min-w-[55px] font-mono leading-none">
                  <div className="text-[10px] font-bold text-foreground">{driver.time}</div>
                  <div className="text-[8px] text-muted-foreground mt-0.5">+{driver.points} PTS</div>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-3 flex items-center justify-between text-[10px] text-muted-foreground font-mono">
            <span>F1 {data.season} · ROUND {data.round}</span>
            <a
              href={`https://www.formula1.com/en/results.html`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-0.5 text-primary hover:underline font-bold"
            >
              <span>FULL RESULTS</span>
              <ChevronRight className="size-3" />
            </a>
          </div>
        </>
      )}
    </section>
  )
}

function renderDeltaBadge(delta?: number) {
  if (delta === undefined) return null

  if (delta === 999) {
    return (
      <span className="text-[7px] bg-emerald-500/10 text-emerald-500 px-0.5 rounded scale-90 font-black shrink-0 ml-0.5">
        NEW
      </span>
    )
  }

  if (delta > 0) {
    return (
      <span className="inline-flex items-center text-emerald-500 font-extrabold scale-90 shrink-0 ml-0.5">
        <ArrowUp className="size-2.5" />
        <span>{delta}</span>
      </span>
    )
  }

  if (delta < 0) {
    return (
      <span className="inline-flex items-center text-destructive font-extrabold scale-90 shrink-0 ml-0.5">
        <ArrowDown className="size-2.5" />
        <span>{Math.abs(delta)}</span>
      </span>
    )
  }

  return (
    <span className="inline-flex items-center text-muted-foreground/50 font-normal scale-90 shrink-0 ml-0.5">
      <Minus className="size-2.5" />
    </span>
  )
}
