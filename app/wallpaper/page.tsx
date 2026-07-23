"use client"

import { useState, useEffect, useMemo } from "react"
import Link from "next/link"
import { ArrowLeft, ImageIcon, Calendar, LoaderCircle } from "lucide-react"
import { WallpaperGenerator } from "@/components/wallpaper-generator"
import type { RaceEvent, ScheduleResponse } from "@/lib/types"

const DEMO_EVENTS: RaceEvent[] = buildDemoEvents(2026)

export default function WallpaperPage() {
  const [events, setEvents] = useState<RaceEvent[]>(DEMO_EVENTS)
  const [loading, setLoading] = useState(false)
  const [month, setMonth] = useState(new Date().getMonth())
  const [year, setYear] = useState(new Date().getFullYear())

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    const timer = setTimeout(() => {
      fetch("/api/schedule")
        .then((res) => res.json() as Promise<ScheduleResponse>)
        .then((data) => {
          if (cancelled) return
          if (data.events && data.events.length > 0) {
            setEvents(data.events)
          }
        })
        .catch((err) => console.error("Failed to fetch schedule:", err))
        .finally(() => {
          if (!cancelled) setLoading(false)
        })
    }, 1500)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
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
    <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-8 sm:py-10">
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

      {loading && events.length === 0 ? (
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

function buildDemoEvents(year: number): RaceEvent[] {
  const samples: { series: RaceEvent["series"]; month: number; day: number; name: string; circuit: string }[] = [
    { series: "F1", month: 0, day: 8, name: "巴林大奖赛", circuit: "Bahrain" },
    { series: "F1", month: 0, day: 15, name: "沙特阿拉伯大奖赛", circuit: "Jeddah" },
    { series: "F1", month: 1, day: 29, name: "澳大利亚大奖赛", circuit: "Albert Park" },
    { series: "FE", month: 1, day: 28, name: "利雅得 E-Prix", circuit: "Riyadh" },
    { series: "F1", month: 2, day: 15, name: "日本大奖赛", circuit: "Suzuka" },
    { series: "F1", month: 2, day: 22, name: "中国大奖赛", circuit: "Shanghai" },
    { series: "FE", month: 2, day: 22, name: "上海 E-Prix", circuit: "Shanghai" },
    { series: "F1", month: 3, day: 5, name: "迈阿密大奖赛", circuit: "Miami" },
    { series: "FE", month: 3, day: 10, name: "东京 E-Prix", circuit: "Tokyo" },
    { series: "F1", month: 3, day: 19, name: "艾米利亚-罗马涅大奖赛", circuit: "Enzo e Dino Ferrari" },
    { series: "F1", month: 3, day: 26, name: "摩纳哥大奖赛", circuit: "Monte Carlo" },
    { series: "WRC", month: 4, day: 2, name: "葡萄牙拉力赛", circuit: "Matosinhos" },
    { series: "F1", month: 4, day: 10, name: "西班牙大奖赛", circuit: "Barcelona" },
    { series: "FE", month: 4, day: 12, name: "柏林 E-Prix", circuit: "Berlin" },
    { series: "F1", month: 4, day: 24, name: "加拿大大奖赛", circuit: "Montreal" },
    { series: "WRC", month: 4, day: 30, name: "希腊卫城拉力赛", circuit: "Lamia" },
    { series: "F1", month: 5, day: 7, name: "英国大奖赛", circuit: "Silverstone" },
    { series: "F1", month: 5, day: 21, name: "匈牙利大奖赛", circuit: "Hungaroring" },
    { series: "FE", month: 5, day: 24, name: "罗马 E-Prix", circuit: "Rome" },
    { series: "F1", month: 6, day: 5, name: "比利时大奖赛", circuit: "Spa-Francorchamps" },
    { series: "F1", month: 6, day: 26, name: "荷兰大奖赛", circuit: "Zandvoort" },
    { series: "FE", month: 6, day: 28, name: "伦敦 E-Prix", circuit: "London" },
    { series: "F1", month: 7, day: 25, name: "意大利大奖赛", circuit: "Monza" },
    { series: "WRC", month: 7, day: 30, name: "芬兰拉力赛", circuit: "Jyväskylä" },
    { series: "F1", month: 8, day: 5, name: "阿塞拜疆大奖赛", circuit: "Baku" },
    { series: "F1", month: 8, day: 19, name: "新加坡大奖赛", circuit: "Marina Bay" },
    { series: "F1", month: 9, day: 2, name: "日本大奖赛", circuit: "Suzuka" },
    { series: "FE", month: 9, day: 12, name: "首尔 E-Prix", circuit: "Seoul" },
    { series: "F1", month: 9, day: 16, name: "中国大奖赛", circuit: "Shanghai" },
    { series: "F1", month: 10, day: 14, name: "墨西哥大奖赛", circuit: "Mexico City" },
    { series: "F1", month: 10, day: 24, name: "圣保罗大奖赛", circuit: "Interlagos" },
    { series: "WRC", month: 10, day: 30, name: "西班牙加泰罗尼亚拉力赛", circuit: "Mataró" },
    { series: "F1", month: 11, day: 7, name: "拉斯维加斯大奖赛", circuit: "Las Vegas" },
    { series: "F1", month: 11, day: 21, name: "卡塔尔大奖赛", circuit: "Lusail" },
    { series: "F1", month: 11, day: 28, name: "阿布扎比大奖赛", circuit: "Yas Marina" },
  ]
  return samples.map((s, idx) => {
    const utc = new Date(Date.UTC(year, s.month, s.day, 14, 0, 0)).toISOString()
    return {
      id: `demo-${idx}`,
      series: s.series,
      name: s.name,
      circuit: s.circuit,
      circuitImageUrl: undefined,
      sessions: [
        { id: `s1-${idx}`, name: "Practice 1", utc: new Date(Date.UTC(year, s.month, s.day, 10, 30, 0)).toISOString(), isMain: false },
        { id: `s2-${idx}`, name: "Qualifying", utc: new Date(Date.UTC(year, s.month, s.day, 13, 0, 0)).toISOString(), isMain: false },
        { id: `s3-${idx}`, name: s.series === "FE" ? "Race" : "Race", utc, isMain: true },
      ],
    }
  })
}
