"use client"

import { useState, useEffect, useMemo } from "react"
import Link from "next/link"
import { ArrowLeft, ImageIcon, Calendar, LoaderCircle } from "lucide-react"
import { WallpaperGenerator } from "@/components/wallpaper-generator"
import type { RaceEvent, ScheduleResponse } from "@/lib/types"

export default function WallpaperPage() {
  const [events, setEvents] = useState<RaceEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [month, setMonth] = useState(new Date().getMonth())
  const [year, setYear] = useState(new Date().getFullYear())

  useEffect(() => {
    fetch("/api/schedule")
      .then((res) => res.json() as Promise<ScheduleResponse>)
      .then((data) => {
        setEvents(data.events || [])
      })
      .catch((err) => console.error("Failed to fetch schedule:", err))
      .finally(() => setLoading(false))
  }, [])

  const months = [
    "一月", "二月", "三月", "四月", "五月", "六月",
    "七月", "八月", "九月", "十月", "十一月", "十二月"
  ]

  const eventCount = useMemo(() => {
    return events.filter((e) => {
      const main = e.sessions.find((s) => s.isMain) || e.sessions[e.sessions.length - 1]
      if (!main) return false
      const d = new Date(main.utc)
      return d.getMonth() === month && d.getFullYear() === year
    }).length
  }, [events, month, year])

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
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">壁纸生成</h1>
          <p className="mt-1 text-sm text-muted-foreground">生成你的专属赛事日历壁纸</p>
        </div>
      </header>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-xl border border-border bg-card p-4">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Calendar className="size-4" />
          选择月份
        </div>
        <div className="flex gap-2">
          <select
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
          >
            {[2025, 2026, 2027].map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
          <select
            value={month}
            onChange={(e) => setMonth(Number(e.target.value))}
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
          >
            {months.map((m, idx) => (
              <option key={idx} value={idx}>{m}</option>
            ))}
          </select>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
          <LoaderCircle className="size-5 animate-spin" />
          加载赛程数据…
        </div>
      ) : (
        <WallpaperGenerator events={events} month={month} year={year} />
      )}

      <footer className="pt-2 text-center text-[11px] text-muted-foreground">
        数据来源：racecalendar-visualize 赛程 API
      </footer>
    </div>
  )
}
