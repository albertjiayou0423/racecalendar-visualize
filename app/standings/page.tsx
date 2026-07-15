"use client"

import { useEffect, useState } from "react"
import { ArrowLeft, Trophy, Users, Car, LoaderCircle, TriangleAlert } from "lucide-react"
import Link from "next/link"

type StandingTab = "drivers" | "constructors"

interface DriverStanding {
  position: string
  points: string
  wins: string
  Driver: {
    code: string
    givenName: string
    familyName: string
    nationality: string
  }
  Constructors: { name: string }[]
}

interface ConstructorStanding {
  position: string
  points: string
  wins: string
  Constructor: {
    name: string
    nationality: string
  }
}

export default function StandingsPage() {
  const [tab, setTab] = useState<StandingTab>("drivers")
  const [drivers, setDrivers] = useState<DriverStanding[]>([])
  const [constructors, setConstructors] = useState<ConstructorStanding[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [season, setSeason] = useState("2026")
  const [round, setRound] = useState("")

  useEffect(() => {
    fetchStandings()
  }, [tab])

  const fetchStandings = async () => {
    setLoading(true)
    setError(false)
    try {
      const endpoint = tab === "drivers" ? "driverStandings" : "constructorStandings"
      const res = await fetch(
        `https://api.jolpi.ca/ergast/f1/current/${endpoint}.json?limit=50`
      )
      const json = await res.json()
      const table = json?.MRData?.StandingsTable
      const standings = table?.StandingsLists?.[0]

      if (!standings) throw new Error("No data")

      setSeason(table.season || "2026")
      setRound(standings.round || "")

      if (tab === "drivers") {
        setDrivers(standings.DriverStandings || [])
      } else {
        setConstructors(standings.ConstructorStandings || [])
      }
    } catch (e) {
      console.error("Failed to fetch standings:", e)
      setError(true)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-8 sm:py-10">
      <header className="flex items-center gap-4">
        <Link
          href="/"
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground transition-colors hover:text-foreground"
          aria-label="返回首页"
        >
          <ArrowLeft className="size-4" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">积分榜</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            F1 {season} 赛季{round ? ` · 第 ${round} 轮后` : ""}
          </p>
        </div>
      </header>

      <div className="flex gap-2 rounded-lg border border-border bg-card p-1">
        <button
          onClick={() => setTab("drivers")}
          className={cn(
            "flex flex-1 items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors",
            tab === "drivers"
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <Users className="size-4" />
          车手积分榜
        </button>
        <button
          onClick={() => setTab("constructors")}
          className={cn(
            "flex flex-1 items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors",
            tab === "constructors"
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <Car className="size-4" />
          车队积分榜
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
          <LoaderCircle className="size-5 animate-spin" />
          加载积分榜数据…
        </div>
      ) : error ? (
        <div className="flex items-center justify-center gap-2 rounded-lg border border-destructive/40 bg-destructive/10 py-10 text-sm text-foreground">
          <TriangleAlert className="size-5 text-destructive" />
          数据加载失败，请稍后重试。
        </div>
      ) : tab === "drivers" ? (
        <DriverStandingsList data={drivers} />
      ) : (
        <ConstructorStandingsList data={constructors} />
      )}

      <footer className="pt-2 text-center text-[11px] text-muted-foreground">
        数据来源：Jolpica F1 API（Ergast 兼容）
      </footer>
    </div>
  )
}

function DriverStandingsList({ data }: { data: DriverStanding[] }) {
  return (
    <div className="flex flex-col gap-1.5">
      {data.map((driver, idx) => {
        const isTop3 = idx < 3
        const medalColor = idx === 0 ? "text-amber-400" : idx === 1 ? "text-gray-300" : "text-amber-600"
        const bgOpacity = idx === 0 ? "bg-amber-500/5" : idx === 1 ? "bg-gray-400/5" : "bg-amber-700/5"
        return (
          <div
            key={driver.position}
            className={`flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 ${isTop3 ? bgOpacity : ""}`}
          >
            <div
              className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold ${
                isTop3 ? medalColor : "text-muted-foreground"
              }`}
            >
              {driver.position}
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-medium truncate">
                {driver.Driver.givenName} {driver.Driver.familyName}
              </div>
              <div className="text-xs text-muted-foreground truncate">
                {driver.Constructors?.[0]?.name} · {driver.wins} 胜
              </div>
            </div>
            <div className="text-right">
              <div className="font-mono text-lg font-bold tabular-nums">{driver.points}</div>
              <div className="text-[10px] text-muted-foreground">PTS</div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

function ConstructorStandingsList({ data }: { data: ConstructorStanding[] }) {
  return (
    <div className="flex flex-col gap-1.5">
      {data.map((constructor, idx) => {
        const isTop3 = idx < 3
        const medalColor = idx === 0 ? "text-amber-400" : idx === 1 ? "text-gray-300" : "text-amber-600"
        const bgOpacity = idx === 0 ? "bg-amber-500/5" : idx === 1 ? "bg-gray-400/5" : "bg-amber-700/5"
        return (
          <div
            key={constructor.position}
            className={`flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 ${isTop3 ? bgOpacity : ""}`}
          >
            <div
              className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold ${
                isTop3 ? medalColor : "text-muted-foreground"
              }`}
            >
              {constructor.position}
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-medium truncate">{constructor.Constructor.name}</div>
              <div className="text-xs text-muted-foreground truncate">
                {constructor.Constructor.nationality} · {constructor.wins} 胜
              </div>
            </div>
            <div className="text-right">
              <div className="font-mono text-lg font-bold tabular-nums">{constructor.points}</div>
              <div className="text-[10px] text-muted-foreground">PTS</div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

function cn(...classes: (string | boolean | undefined)[]): string {
  return classes.filter(Boolean).join(" ")
}
