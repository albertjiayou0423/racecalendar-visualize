"use client"

import { useEffect, useState } from "react"
import { Trophy, Medal, ChevronRight, Eye, AlertTriangle, ArrowUp, ArrowDown, Minus } from "lucide-react"

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
  // 联动排名变动字段
  championshipPosition?: number
  championshipDelta?: number // 积分榜排名变化：+表示上升，-表示下降，0表示不变
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
      // 1. 获取上一站比赛结果
      const lastRes = await fetch("https://api.jolpi.ca/ergast/f1/current/last/results.json")
      if (!lastRes.ok) throw new Error("Failed to fetch last race results")
      const lastJson = await lastRes.json()
      const race = lastJson?.MRData?.RaceTable?.Races?.[0]
      if (!race) throw new Error("No last race data found")

      const round = Number(race.round)
      const resultsRaw = race.Results || []

      // 2. 尝试并行抓取本站后 (round) 和本站前 (round-1) 的车手积分榜，用于计算 standings delta
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

      // 3. 构建结果列表并计算 delta
      const results: DriverResult[] = resultsRaw.slice(0, 10).map((r: any) => {
        const driverId = r.Driver.driverId
        const currentPos = currentStandingsMap.get(driverId)
        const prevPos = prevStandingsMap.get(driverId)

        let championshipDelta: number | undefined = undefined
        if (currentPos !== undefined) {
          if (prevPos !== undefined) {
            // 注意：排名数字越小越靠前，prevPos - currentPos 为正表示排名上升（例如：从第3名升到第1名，3-1 = +2）
            championshipDelta = prevPos - currentPos
          } else if (round > 1) {
            // 如果之前没有名次，当前有了，表示首次进入积分榜
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
          className="rounded px-2 py-0.5 font-bold text-white text-[10px]"
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
            <p className="font-medium text-sm">含比赛结果与积分榜变动剧透</p>
            <p className="mt-1 text-xs text-muted-foreground">点击下方按钮查看上一站完整成绩与世界积分榜即时变化</p>
          </div>
          <button
            onClick={() => setShowResults(true)}
            className="flex items-center gap-2 rounded-lg bg-primary px-6 py-2 text-xs font-semibold text-primary-foreground transition-all hover:bg-primary/90"
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
                    <div className="font-bold text-xs">{driver.driver.code}</div>
                    <div className="text-[10px] text-muted-foreground truncate max-w-[80px]">{driver.constructor.name}</div>
                  </div>
                  <div
                    className={`w-full rounded-t-lg ${heights[idx]} flex flex-col items-center justify-end pb-2 gap-1`}
                    style={{
                      backgroundColor: pos === 1 ? "#FFD70033" : pos === 2 ? "#C0C0C033" : "#CD7F3233",
                    }}
                  >
                    {/* Podium 上的积分榜变化 */}
                    {driver.championshipPosition !== undefined && (
                      <div className="text-[10px] scale-90 flex items-center gap-0.5 px-1 py-0.5 rounded bg-black/35 font-medium">
                        <span className="text-muted-foreground">WDC:</span>
                        <span className="font-bold">{driver.championshipPosition}</span>
                        {renderDeltaBadge(driver.championshipDelta, true)}
                      </div>
                    )}
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
                  <div className="font-medium text-xs truncate">
                    {driver.driver.givenName} {driver.driver.familyName}
                  </div>
                  <div className="text-[11px] text-muted-foreground truncate">{driver.constructor.name}</div>
                </div>

                {/* 积分榜排名变化联动 */}
                {driver.championshipPosition !== undefined && (
                  <div className="flex items-center gap-1 text-[11px] px-2 py-1 rounded bg-secondary/30 shrink-0 font-mono text-muted-foreground">
                    <span>WDC</span>
                    <span className="font-bold text-foreground">{driver.championshipPosition}</span>
                    {renderDeltaBadge(driver.championshipDelta)}
                  </div>
                )}

                <div className="text-right min-w-[70px]">
                  <div className="font-mono text-xs tabular-nums text-foreground">{driver.time}</div>
                  <div className="text-[10px] text-muted-foreground font-mono">+{driver.points} pts</div>
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
              className="flex items-center gap-1 text-primary hover:underline font-medium"
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

function renderDeltaBadge(delta?: number, isPodium: boolean = false) {
  if (delta === undefined) return null

  if (delta === 999) {
    return (
      <span className="text-[9px] bg-emerald-500/10 text-emerald-500 px-1 rounded scale-90 font-bold shrink-0">
        NEW
      </span>
    )
  }

  if (delta > 0) {
    return (
      <span className="inline-flex items-center text-emerald-500 font-bold scale-90 shrink-0">
        <ArrowUp className="size-2.5" />
        <span>{delta}</span>
      </span>
    )
  }

  if (delta < 0) {
    return (
      <span className="inline-flex items-center text-destructive font-bold scale-90 shrink-0">
        <ArrowDown className="size-2.5" />
        <span>{Math.abs(delta)}</span>
      </span>
    )
  }

  return (
    <span className="inline-flex items-center text-muted-foreground/60 font-normal scale-90 shrink-0">
      <Minus className="size-2.5" />
    </span>
  )
}
