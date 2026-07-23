"use client"

import { useRef, useState, useEffect } from "react"
import { toPng } from "html-to-image"
import { Download, ImageIcon, RotateCcw, Smartphone, Monitor } from "lucide-react"
import { cn } from "@/lib/utils"
import type { RaceEvent, RaceSession } from "@/lib/types"

interface WallpaperGeneratorProps {
  events: RaceEvent[]
  month: number
  year: number
}

type AspectRatio = "phone" | "desktop"

const SERIES_COLORS: Record<string, string> = {
  F1: "#ef4444",
  WRC: "#3b82f6",
  FE: "#10b981",
}

export function WallpaperGenerator({ events, month, year }: WallpaperGeneratorProps) {
  const phoneRef = useRef<HTMLDivElement>(null)
  const desktopRef = useRef<HTMLDivElement>(null)
  const [mode, setMode] = useState<AspectRatio>("phone")
  const [generating, setGenerating] = useState(false)
  const [generatedUrl, setGeneratedUrl] = useState<string | null>(null)
  const [mounted, setMounted] = useState(false)
  const [host, setHost] = useState("")

  useEffect(() => {
    setMounted(true)
    if (typeof window !== "undefined") setHost(window.location.hostname)
  }, [])

  const monthNames = ["一月", "二月", "三月", "四月", "五月", "六月", "七月", "八月", "九月", "十月", "十一月", "十二月"]
  const grouped = eventsByDate(events, month, year)
  const yearGrouped = eventsByYear(events, year)
  const totalEvents = Object.values(grouped).flat().length
  const yearTotalEvents = Object.values(yearGrouped).reduce((acc, m) => acc + Object.values(m).flat().length, 0)

  const generate = async () => {
    const ref = mode === "phone" ? phoneRef : desktopRef
    if (!ref.current) return
    setGenerating(true)
    try {
      const dataUrl = await toPng(ref.current, { quality: 1, pixelRatio: 2 })
      setGeneratedUrl(dataUrl)
    } catch (err) {
      console.error("壁纸生成失败:", err)
    } finally {
      setGenerating(false)
    }
  }

  const download = () => {
    if (!generatedUrl) return
    const a = document.createElement("a")
    const suffix = mode === "phone" ? `${String(month + 1).padStart(2, "0")}` : "full-year"
    a.download = `race-calendar-${year}-${suffix}.png`
    a.href = generatedUrl
    a.click()
  }

  if (!mounted) return null

  return (
    <div className="space-y-4">
      {/* 控制栏 */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-2 rounded-lg border border-border bg-card p-1">
          <button
            onClick={() => setMode("phone")}
            className={cn(
              "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
              mode === "phone" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Smartphone className="size-3.5" />
            手机（当月）
          </button>
          <button
            onClick={() => setMode("desktop")}
            className={cn(
              "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
              mode === "desktop" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Monitor className="size-3.5" />
            桌面（全年）
          </button>
        </div>
        <div className="flex gap-2">
          <button
            onClick={generate}
            disabled={generating}
            className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
          >
            {generating ? <RotateCcw className="size-3.5 animate-spin" /> : <ImageIcon className="size-3.5" />}
            生成
          </button>
          {generatedUrl && (
            <button
              onClick={download}
              className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium transition-colors hover:bg-secondary"
            >
              <Download className="size-3.5" />
              下载
            </button>
          )}
        </div>
      </div>

      {/* 预览区 — 自适应布局，不使用 transform scale */}
      <div className="rounded-xl border border-border bg-black/5 p-3 sm:p-4">
        {mode === "phone" ? (
          <PhoneWallpaper
            ref={null}
            year={year}
            month={month}
            monthNames={monthNames}
            grouped={grouped}
            totalEvents={totalEvents}
            host={host}
            responsive
          />
        ) : (
          <DesktopWallpaper
            ref={null}
            year={year}
            monthNames={monthNames}
            yearGrouped={yearGrouped}
            totalEvents={yearTotalEvents}
            host={host}
            responsive
          />
        )}
      </div>

      {/* 生成用 DOM（屏幕外，固定高质量尺寸） */}
      <div
        className="pointer-events-none fixed -z-[9999]"
        style={{ left: "-9999px", top: 0 }}
        aria-hidden="true"
      >
        <PhoneWallpaper
          ref={phoneRef}
          year={year}
          month={month}
          monthNames={monthNames}
          grouped={grouped}
          totalEvents={totalEvents}
          host={host}
        />
      </div>
      <div
        className="pointer-events-none fixed -z-[9999]"
        style={{ left: "-9999px", top: 700 }}
        aria-hidden="true"
      >
        <DesktopWallpaper
          ref={desktopRef}
          year={year}
          monthNames={monthNames}
          yearGrouped={yearGrouped}
          totalEvents={yearTotalEvents}
          host={host}
        />
      </div>
    </div>
  )
}

// 手机壁纸
const PhoneWallpaper = ({
  ref,
  year,
  month,
  monthNames,
  grouped,
  totalEvents,
  host,
  responsive = false,
}: {
  ref: React.RefObject<HTMLDivElement | null>
  year: number
  month: number
  monthNames: string[]
  grouped: Record<string, RaceEvent[]>
  totalEvents: number
  host: string
  responsive?: boolean
}) => {
  const weekDays = ["日", "一", "二", "三", "四", "五", "六"]

  return (
    <div
      ref={ref}
      className={cn(
        "relative overflow-hidden rounded-xl bg-[#0a0a0f] text-white",
        responsive ? "w-full" : "shrink-0"
      )}
      style={
        responsive
          ? { aspectRatio: "9/16", padding: "6% 5%" }
          : { width: 1080, height: 1920, padding: "60px 40px" }
      }
    >
      <div className="absolute inset-0 opacity-10 pointer-events-none">
        <div className="absolute -top-20 -right-20 h-60 w-60 rounded-full bg-red-500 blur-3xl" />
        <div className="absolute -bottom-20 -left-20 h-60 w-60 rounded-full bg-blue-500 blur-3xl" />
      </div>

      <div className="relative z-10 h-full flex flex-col">
        <div className="text-center">
          <div className="text-[11px] font-medium tracking-widest text-white/40 uppercase">Race Calendar</div>
          <h2 className="mt-1 text-3xl font-bold">{year} {monthNames[month]}</h2>
          <div className="mt-1 text-sm text-white/30">{totalEvents} 场赛事</div>
        </div>

        <div className="mt-6 flex-1 space-y-3 overflow-hidden">
          {Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b)).slice(0, 12).map(([date, dateEvents]) => {
            const d = new Date(date)
            return (
              <div key={date} className="rounded-lg bg-white/5 p-3">
                <div className="flex items-center gap-3 text-sm text-white/50">
                  <span className="font-mono font-bold text-white/80">{d.getDate()}</span>
                  <span>周{weekDays[d.getDay()]}</span>
                </div>
                <div className="mt-2 space-y-1">
                  {dateEvents.map((event) => {
                    const s = getMainSession(event)
                    return (
                      <div key={event.id} className="flex items-center gap-2">
                        <div
                          className="h-2 w-2 rounded-full shrink-0"
                          style={{ backgroundColor: SERIES_COLORS[event.series] }}
                        />
                        <span className="text-sm text-white/90 truncate flex-1">{event.name}</span>
                        {s && <span className="text-xs text-white/40 font-mono">{formatTime(s.utc)}</span>}
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
          {Object.keys(grouped).length === 0 && (
            <div className="text-center text-base text-white/30 py-8">该月暂无赛事</div>
          )}
          {Object.keys(grouped).length > 12 && (
            <div className="text-center text-xs text-white/30">+{Object.keys(grouped).length - 12} 个比赛日</div>
          )}
        </div>

        <div className="mt-4 text-center">
          <div className="text-xs text-white/20">{host || "racecalendar-visualize.vercel.app"}</div>
        </div>
      </div>
    </div>
  )
}

// 桌面壁纸
const DesktopWallpaper = ({
  ref,
  year,
  monthNames,
  yearGrouped,
  totalEvents,
  host,
  responsive = false,
}: {
  ref: React.RefObject<HTMLDivElement | null>
  year: number
  monthNames: string[]
  yearGrouped: Record<number, Record<string, RaceEvent[]>>
  totalEvents: number
  host: string
  responsive?: boolean
}) => {
  const weekDays = ["日", "一", "二", "三", "四", "五", "六"]

  return (
    <div
      ref={ref}
      className={cn(
        "relative overflow-hidden rounded-xl bg-gradient-to-br from-[#0a0a0f] via-[#0f0f1a] to-[#0a0a0f] text-white",
        responsive ? "w-full" : "shrink-0"
      )}
      style={
        responsive
          ? { aspectRatio: "16/9", padding: "2.5% 2.5%" }
          : { width: 1920, height: 1080, padding: "40px 50px" }
      }
    >
      <div className="absolute inset-0 opacity-[0.06] pointer-events-none">
        <div className="absolute -top-40 -right-40 h-96 w-96 rounded-full bg-red-600 blur-3xl" />
        <div className="absolute top-1/4 -left-40 h-96 w-96 rounded-full bg-blue-600 blur-3xl" />
        <div className="absolute bottom-0 right-1/3 h-96 w-96 rounded-full bg-purple-600 blur-3xl" />
      </div>

      <div className="relative z-10 flex h-full flex-col">
        {/* 头部 */}
        <div className="flex items-start justify-between border-b border-white/10 pb-3 mb-3">
          <div>
            <div className="text-sm font-bold tracking-[0.3em] text-white/30 uppercase">
              Race Calendar · Full Year
            </div>
            <h1 className="mt-1 text-4xl font-bold bg-gradient-to-r from-white via-white/80 to-white/40 bg-clip-text text-transparent">
              {year} 赛季全年赛历
            </h1>
          </div>
          <div className="text-right">
            <div className="text-4xl font-bold text-white">{totalEvents}</div>
            <div className="text-sm text-white/40">Scheduled Events</div>
          </div>
        </div>

        {/* 12个月份网格 */}
        <div className="grid grid-cols-3 grid-rows-4 gap-3 flex-1">
          {Array.from({ length: 12 }).map((_, m) => {
            const grouped = yearGrouped[m] || {}
            const monthEvents = Object.values(grouped).flat()
            const daysInMonth = new Date(year, m + 1, 0).getDate()
            const firstDay = new Date(year, m, 1).getDay()

            return (
              <div
                key={m}
                className="rounded-xl bg-white/[0.03] border border-white/5 p-3 flex flex-col"
              >
                {/* 月份标题 */}
                <div className="flex items-baseline justify-between mb-2">
                  <h3 className="text-lg font-bold text-white/90">{monthNames[m]}</h3>
                  <span className="text-xs text-white/30 font-mono">{monthEvents.length} 场</span>
                </div>

                {/* 日历 */}
                <div className="grid grid-cols-7 gap-px">
                  {weekDays.map((d) => (
                    <div key={d} className="text-center text-[10px] font-semibold text-white/30 py-1">
                      {d}
                    </div>
                  ))}
                  {Array.from({ length: firstDay }).map((_, i) => (
                    <div key={`e-${m}-${i}`} />
                  ))}
                  {Array.from({ length: daysInMonth }).map((_, i) => {
                    const day = i + 1
                    const dateStr = `${year}-${String(m + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`
                    const dayEvents = grouped[dateStr] || []
                    const f1 = dayEvents.some((e) => e.series === "F1")
                    const wrc = dayEvents.some((e) => e.series === "WRC")
                    const fe = dayEvents.some((e) => e.series === "FE")
                    return (
                      <div
                        key={day}
                        className={cn(
                          "flex flex-col items-center justify-center rounded-md",
                          dayEvents.length > 0 ? "bg-white/[0.08]" : ""
                        )}
                        style={{ height: "28px" }}
                      >
                        <span
                          className={cn(
                            "text-sm font-mono leading-none",
                            dayEvents.length > 0 ? "text-white/80 font-bold" : "text-white/25"
                          )}
                        >
                          {day}
                        </span>
                        {dayEvents.length > 0 && (
                          <div className="flex gap-0.5 mt-0.5">
                            {f1 && <div className="w-1.5 h-1.5 rounded-full bg-[#ef4444]" />}
                            {wrc && <div className="w-1.5 h-1.5 rounded-full bg-[#3b82f6]" />}
                            {fe && <div className="w-1.5 h-1.5 rounded-full bg-[#10b981]" />}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>

                {/* 当月赛事 */}
                {monthEvents.length > 0 && (
                  <div className="mt-2 space-y-1 border-t border-white/5 pt-2">
                    {monthEvents.slice(0, 2).map((event) => {
                      const s = getMainSession(event)
                      return (
                        <div key={event.id} className="flex items-center gap-2">
                          <div
                            className="w-2 h-2 rounded-full shrink-0"
                            style={{ backgroundColor: SERIES_COLORS[event.series] }}
                          />
                          <span className="text-xs text-white/70 truncate flex-1">{event.name}</span>
                          {s && <span className="text-xs text-white/30 font-mono shrink-0">{formatTime(s.utc)}</span>}
                        </div>
                      )
                    })}
                    {monthEvents.length > 2 && (
                      <div className="text-[10px] text-white/25 text-center">
                        +{monthEvents.length - 2} 更多
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* 底部图例 */}
        <div className="mt-3 flex items-center justify-between border-t border-white/10 pt-3">
          <div className="flex items-center gap-6">
            {Object.entries(SERIES_COLORS).map(([series, color]) => (
              <div key={series} className="flex items-center gap-2">
                <div className="w-3 h-3 rounded" style={{ backgroundColor: color }} />
                <span className="text-sm text-white/40 font-medium">{series}</span>
              </div>
            ))}
          </div>
          <div className="text-sm text-white/20 font-mono">
            {host || "racecalendar-visualize.vercel.app"}
          </div>
        </div>
      </div>
    </div>
  )
}

function eventsByDate(events: RaceEvent[], month: number, year: number): Record<string, RaceEvent[]> {
  const g: Record<string, RaceEvent[]> = {}
  for (const e of events) {
    const s = getMainSession(e)
    if (!s) continue
    const d = new Date(s.utc)
    if (d.getMonth() !== month || d.getFullYear() !== year) continue
    const k = d.toISOString().split("T")[0]
    if (!g[k]) g[k] = []
    g[k].push(e)
  }
  return g
}

function eventsByYear(events: RaceEvent[], year: number): Record<number, Record<string, RaceEvent[]>> {
  const r: Record<number, Record<string, RaceEvent[]>> = {}
  for (let m = 0; m < 12; m++) r[m] = {}
  for (const e of events) {
    const s = getMainSession(e)
    if (!s) continue
    const d = new Date(s.utc)
    if (d.getFullYear() !== year) continue
    const m = d.getMonth()
    const k = d.toISOString().split("T")[0]
    if (!r[m][k]) r[m][k] = []
    r[m][k].push(e)
  }
  return r
}

function getMainSession(event: RaceEvent): RaceSession | undefined {
  return event.sessions.find((s) => s.isMain) || event.sessions[event.sessions.length - 1]
}

function formatTime(utc: string): string {
  const d = new Date(utc)
  const bj = new Date(d.getTime() + 8 * 60 * 60 * 1000)
  return `${String(bj.getHours()).padStart(2, "0")}:${String(bj.getMinutes()).padStart(2, "0")}`
}
