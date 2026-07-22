"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { ArrowLeft, Trophy, Calendar, Flag, Car, LoaderCircle, TriangleAlert, ChevronDown, ChevronUp } from "lucide-react"
import { cn } from "@/lib/utils"

type SeriesType = "F1" | "FE"

interface F1Result {
  position: string
  Driver: { givenName: string; familyName: string; code: string }
  Constructor: { name: string }
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
  Circuit: { circuitName: string; Location: { locality: string; country: string } }
  date: string
  Results: F1Result[]
}

interface FeResult {
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

interface ResultsResponse {
  series: SeriesType
  season: string
  races?: F1Race[]
  results?: Record<string, FeResult[]>
  ok: boolean
  note?: string
}

export default function ResultsPage() {
  const [series, setSeries] = useState<SeriesType>("F1")
  const [season, setSeason] = useState("2025")
  const [data, setData] = useState<ResultsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [expandedRaces, setExpandedRaces] = useState<Set<string>>(new Set())

  useEffect(() => {
    fetchResults()
  }, [series, season])

  const fetchResults = async () => {
    setLoading(true)
    setError(false)
    try {
      const res = await fetch(`/api/results?series=${series}&season=${season}`)
      const json: ResultsResponse = await res.json()
      setData(json)
      if (!json.ok) setError(true)
      setExpandedRaces(new Set())
    } catch (e) {
      console.error("Failed to fetch results:", e)
      setError(true)
    } finally {
      setLoading(false)
    }
  }

  const toggleRace = (id: string) => {
    const next = new Set(expandedRaces)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setExpandedRaces(next)
  }

  const currentYear = new Date().getFullYear()
  const years = Array.from({ length: 10 }, (_, i) => String(currentYear - i))

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-8 sm:py-10">
      <header className="flex items-center gap-4">
        <Link
          href="/"
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground transition-colors hover:text-foreground"
          aria-label="返回首页"
        >
          <ArrowLeft className="size-4" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">历史赛果</h1>
          <p className="mt-1 text-sm text-muted-foreground">查询各赛季大奖赛完整成绩</p>
        </div>
      </header>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-2 rounded-lg border border-border bg-card p-1">
          <button
            onClick={() => setSeries("F1")}
            className={cn(
              "flex flex-1 items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors",
              series === "F1" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Trophy className="size-4" />
            F1
          </button>
          <button
            onClick={() => setSeries("FE")}
            className={cn(
              "flex flex-1 items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors",
              series === "FE" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Flag className="size-4" />
            FE
          </button>
        </div>

        <div className="flex items-center gap-2">
          <Calendar className="size-4 text-muted-foreground" />
          <select
            value={season}
            onChange={(e) => setSeason(e.target.value)}
            className="rounded-lg border border-border bg-card px-3 py-2 text-sm outline-none focus:border-primary"
          >
            {years.map((y) => (
              <option key={y} value={y}>{y} 赛季</option>
            ))}
          </select>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
          <LoaderCircle className="size-5 animate-spin" />
          加载赛果数据…
        </div>
      ) : error || !data?.ok ? (
        <div className="flex items-center justify-center gap-2 rounded-lg border border-destructive/40 bg-destructive/10 py-10 text-sm text-foreground">
          <TriangleAlert className="size-5 text-destructive" />
          {data?.note || "数据加载失败，请稍后重试。"}
        </div>
      ) : series === "F1" ? (
        <F1ResultsList races={data.races || []} expandedRaces={expandedRaces} onToggle={toggleRace} />
      ) : (
        <FeResultsList races={(data.races as FeRace[]) || []} results={data.results || {}} expandedRaces={expandedRaces} onToggle={toggleRace} />
      )}

      <footer className="pt-2 text-center text-[11px] text-muted-foreground">
        数据来源：{series === "F1" ? "Jolpica F1 API（Ergast 兼容）" : "Formula E 官方 API（pulselive）"}
      </footer>
    </div>
  )
}

function F1ResultsList({
  races,
  expandedRaces,
  onToggle,
}: {
  races: F1Race[]
  expandedRaces: Set<string>
  onToggle: (id: string) => void
}) {
  if (races.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-card p-8 text-center text-sm text-muted-foreground">
        该赛季暂无赛果数据
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {races.map((race) => {
        const raceId = `f1-${race.season}-${race.round}`
        const isExpanded = expandedRaces.has(raceId)
        const winner = race.Results?.[0]

        return (
          <div
            key={raceId}
            className="overflow-hidden rounded-xl border border-border bg-card"
          >
            <button
              onClick={() => onToggle(raceId)}
              className="flex w-full items-center justify-between p-4 text-left transition-colors hover:bg-secondary/30"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary text-sm font-bold">
                  {race.round}
                </div>
                <div>
                  <div className="font-medium">{race.raceName}</div>
                  <div className="text-xs text-muted-foreground">
                    {race.Circuit.circuitName} · {race.Circuit.Location.locality}, {race.Circuit.Location.country}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {winner && (
                  <div className="hidden text-right sm:block">
                    <div className="text-xs text-muted-foreground">冠军</div>
                    <div className="text-sm font-medium">
                      {winner.Driver.givenName} {winner.Driver.familyName}
                    </div>
                  </div>
                )}
                {isExpanded ? <ChevronUp className="size-4 text-muted-foreground" /> : <ChevronDown className="size-4 text-muted-foreground" />}
              </div>
            </button>

            {isExpanded && (
              <div className="border-t border-border px-4 py-3">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border text-left text-xs text-muted-foreground">
                        <th className="pb-2 pr-2">名次</th>
                        <th className="pb-2 pr-2">车手</th>
                        <th className="pb-2 pr-2 hidden sm:table-cell">车队</th>
                        <th className="pb-2 pr-2 hidden sm:table-cell">圈数</th>
                        <th className="pb-2 pr-2 hidden sm:table-cell">用时/状态</th>
                        <th className="pb-2 text-right">积分</th>
                      </tr>
                    </thead>
                    <tbody>
                      {race.Results?.slice(0, 20).map((result, idx) => (
                        <tr key={idx} className="border-b border-border/50 last:border-0">
                          <td className="py-2 pr-2 font-mono font-medium">{result.position}</td>
                          <td className="py-2 pr-2">
                            <div className="font-medium">{result.Driver.givenName} {result.Driver.familyName}</div>
                            <div className="text-xs text-muted-foreground sm:hidden">{result.Constructor.name}</div>
                          </td>
                          <td className="py-2 pr-2 hidden sm:table-cell text-muted-foreground">{result.Constructor.name}</td>
                          <td className="py-2 pr-2 hidden sm:table-cell font-mono">{result.laps}</td>
                          <td className="py-2 pr-2 hidden sm:table-cell text-muted-foreground">
                            {result.Time?.time || result.status}
                          </td>
                          <td className="py-2 text-right font-mono font-medium">{result.points}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

function FeResultsList({
  races,
  results,
  expandedRaces,
  onToggle,
}: {
  races: FeRace[]
  results: Record<string, FeResult[]>
  expandedRaces: Set<string>
  onToggle: (id: string) => void
}) {
  if (races.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-card p-8 text-center text-sm text-muted-foreground">
        该赛季暂无赛果数据
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {races.map((race) => {
        const isExpanded = expandedRaces.has(race.id)
        const raceResults = results[race.id] || []
        const winner = raceResults[0]

        return (
          <div
            key={race.id}
            className="overflow-hidden rounded-xl border border-border bg-card"
          >
            <button
              onClick={() => onToggle(race.id)}
              className="flex w-full items-center justify-between p-4 text-left transition-colors hover:bg-secondary/30"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary text-sm font-bold">
                  {race.sequence}
                </div>
                <div>
                  <div className="font-medium">{race.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {race.city}, {race.country}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {winner && (
                  <div className="hidden text-right sm:block">
                    <div className="text-xs text-muted-foreground">冠军</div>
                    <div className="text-sm font-medium">{winner.driver}</div>
                  </div>
                )}
                {isExpanded ? <ChevronUp className="size-4 text-muted-foreground" /> : <ChevronDown className="size-4 text-muted-foreground" />}
              </div>
            </button>

            {isExpanded && (
              <div className="border-t border-border px-4 py-3">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border text-left text-xs text-muted-foreground">
                        <th className="pb-2 pr-2">名次</th>
                        <th className="pb-2 pr-2">车手</th>
                        <th className="pb-2 pr-2 hidden sm:table-cell">车队</th>
                        <th className="pb-2 text-right">积分</th>
                      </tr>
                    </thead>
                    <tbody>
                      {raceResults.slice(0, 20).map((result, idx) => (
                        <tr key={idx} className="border-b border-border/50 last:border-0">
                          <td className="py-2 pr-2 font-mono font-medium">{result.position}</td>
                          <td className="py-2 pr-2">
                            <div className="font-medium">{result.driver}</div>
                            <div className="text-xs text-muted-foreground sm:hidden">{result.team}</div>
                          </td>
                          <td className="py-2 pr-2 hidden sm:table-cell text-muted-foreground">{result.team}</td>
                          <td className="py-2 text-right font-mono font-medium">{result.points}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
