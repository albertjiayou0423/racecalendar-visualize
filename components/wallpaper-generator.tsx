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

const DESKTOP_WIDTH = 1280
const DESKTOP_HEIGHT = 720
const PHONE_WIDTH = 360
const PHONE_HEIGHT = 640

export function WallpaperGenerator({ events, month, year }: WallpaperGeneratorProps) {
  const generateRef = useRef<HTMLDivElement>(null)
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>("phone")
  const [generating, setGenerating] = useState(false)
  const [generatedUrl, setGeneratedUrl] = useState<string | null>(null)
  const [mounted, setMounted] = useState(false)
  const [host, setHost] = useState("")

  useEffect(() => {
    setMounted(true)
    if (typeof window !== "undefined") {
      setHost(window.location.hostname)
    }
  }, [])

  const monthNames = ["一月", "二月", "三月", "四月", "五月", "六月", "七月", "八月", "九月", "十月", "十一月", "十二月"]

  const grouped = eventsByDate(events, month, year)
  const yearGrouped = eventsByYear(events, year)
  const totalEvents = Object.values(grouped).flat().length
  const yearTotalEvents = Object.values(yearGrouped).reduce((acc, m) => acc + Object.values(m).flat().length, 0)

  const generateWallpaper = async () => {
    if (!generateRef.current) return
    setGenerating(true)
    try {
      const dataUrl = await toPng(generateRef.current, {
        quality: 1,
        pixelRatio: 2,
      })
      setGeneratedUrl(dataUrl)
    } catch (err) {
      console.error("壁纸生成失败:", err)
    } finally {
      setGenerating(false)
    }
  }

  const downloadWallpaper = () => {
    if (!generatedUrl) return
    const link = document.createElement("a")
    const suffix = aspectRatio === "phone" ? `${String(month + 1).padStart(2, "0")}` : "full-year"
    link.download = `race-calendar-${year}-${suffix}.png`
    link.href = generatedUrl
    link.click()
  }

  if (!mounted) return null

  const targetW = aspectRatio === "phone" ? PHONE_WIDTH : DESKTOP_WIDTH
  const targetH = aspectRatio === "phone" ? PHONE_HEIGHT : DESKTOP_HEIGHT

  return (
    <div className="space-y-4">
      {/* 控制栏 */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-2 rounded-lg border border-border bg-card p-1">
          <button
            onClick={() => setAspectRatio("phone")}
            className={cn(
              "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
              aspectRatio === "phone"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Smartphone className="size-3.5" />
            手机（当月）
          </button>
          <button
            onClick={() => setAspectRatio("desktop")}
            className={cn(
              "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
              aspectRatio === "desktop"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Monitor className="size-3.5" />
            桌面（全年）
          </button>
        </div>

        <div className="flex gap-2">
          <button
            onClick={generateWallpaper}
            disabled={generating}
            className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
          >
            {generating ? (
              <RotateCcw className="size-3.5 animate-spin" />
            ) : (
              <ImageIcon className="size-3.5" />
            )}
            生成
          </button>
          {generatedUrl && (
            <button
              onClick={downloadWallpaper}
              className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium transition-colors hover:bg-secondary"
            >
              <Download className="size-3.5" />
              下载
            </button>
          )}
        </div>
      </div>

      {/* 预览区（固定宽高比，内部用 scale 填满） */}
      <PreviewContainer targetWidth={targetW} targetHeight={targetH}>
        {aspectRatio === "phone" ? (
          <PhoneWallpaper
            ref={null}
            year={year}
            month={month}
            monthNames={monthNames}
            grouped={grouped}
            totalEvents={totalEvents}
            host={host}
          />
        ) : (
          <DesktopWallpaper
            ref={null}
            year={year}
            monthNames={monthNames}
            yearGrouped={yearGrouped}
            totalEvents={yearTotalEvents}
            host={host}
          />
        )}
      </PreviewContainer>

      {/* 生成用 DOM（屏幕外，专门用于 html-to-image） */}
      <div
        className="pointer-events-none fixed -z-[9999]"
        style={{ left: "-9999px", top: 0 }}
        aria-hidden="true"
      >
        {aspectRatio === "phone" ? (
          <PhoneWallpaper
            ref={generateRef}
            year={year}
            month={month}
            monthNames={monthNames}
            grouped={grouped}
            totalEvents={totalEvents}
            host={host}
          />
        ) : (
          <DesktopWallpaper
            ref={generateRef}
            year={year}
            monthNames={monthNames}
            yearGrouped={yearGrouped}
            totalEvents={yearTotalEvents}
            host={host}
          />
        )}
      </div>
    </div>
  )
}

// 预览容器：动态计算缩放比例，确保内容完整显示
function PreviewContainer({
  targetWidth,
  targetHeight,
  children,
}: {
  targetWidth: number
  targetHeight: number
  children: React.ReactNode
}) {
  const wrapperRef = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(1)

  useEffect(() => {
    const updateScale = () => {
      if (!wrapperRef.current) return
      const containerWidth = wrapperRef.current.clientWidth
      const s = Math.min(1, Math.max(0.1, containerWidth / targetWidth))
      setScale(s)
    }
    updateScale()
    window.addEventListener("resize", updateScale)
    return () => window.removeEventListener("resize", updateScale)
  }, [targetWidth])

  return (
    <div className="w-full overflow-hidden rounded-xl border border-border bg-black/5 p-3 sm:p-4">
      <div ref={wrapperRef} className="w-full">
        <div
          style={{
            width: targetWidth,
            height: targetHeight,
            transform: `scale(${scale})`,
            transformOrigin: "top left",
            marginBottom: `${targetHeight * (scale - 1)}px`,
          }}
        >
          {children}
        </div>
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
}: {
  ref: React.RefObject<HTMLDivElement | null>
  year: number
  month: number
  monthNames: string[]
  grouped: Record<string, RaceEvent[]>
  totalEvents: number
  host: string
}) => {
  const weekDays = ["日", "一", "二", "三", "四", "五", "六"]

  return (
    <div
      ref={ref}
      className="relative shrink-0 overflow-hidden rounded-xl bg-[#0a0a0f] text-white"
      style={{ width: PHONE_WIDTH, height: PHONE_HEIGHT, padding: "24px 16px" }}
    >
      <div className="absolute inset-0 opacity-10 pointer-events-none">
        <div className="absolute -top-20 -right-20 h-60 w-60 rounded-full bg-red-500 blur-3xl" />
        <div className="absolute -bottom-20 -left-20 h-60 w-60 rounded-full bg-blue-500 blur-3xl" />
      </div>

      <div className="relative z-10 h-full flex flex-col">
        <div className="text-center">
          <div className="text-[10px] font-medium tracking-widest text-white/40 uppercase">Race Calendar</div>
          <h2 className="mt-1 text-2xl font-bold">{year} {monthNames[month]}</h2>
          <div className="mt-1 text-xs text-white/30">{totalEvents} 场赛事</div>
        </div>

        <div className="mt-4 flex-1 space-y-2 overflow-hidden">
          {Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b)).slice(0, 10).map(([date, dateEvents]) => {
            const d = new Date(date)
            return (
              <div key={date} className="rounded-lg bg-white/5 p-2.5">
                <div className="flex items-center gap-2 text-xs text-white/50">
                  <span className="font-mono font-bold text-white/80">{d.getDate()}</span>
                  <span>周{weekDays[d.getDay()]}</span>
                </div>
                <div className="mt-1 space-y-0.5">
                  {dateEvents.map((event) => {
                    const mainSession = getMainSession(event)
                    return (
                      <div key={event.id} className="flex items-center gap-2">
                        <div
                          className="h-1.5 w-1.5 rounded-full shrink-0"
                          style={{ backgroundColor: SERIES_COLORS[event.series] }}
                        />
                        <span className="text-[11px] text-white/90 truncate flex-1">{event.name}</span>
                        {mainSession && (
                          <span className="text-[9px] text-white/40 font-mono">
                            {formatTime(mainSession.utc)}
                          </span>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
          {Object.keys(grouped).length === 0 && (
            <div className="text-center text-sm text-white/30 py-8">该月暂无赛事</div>
          )}
          {Object.keys(grouped).length > 10 && (
            <div className="text-center text-[10px] text-white/30">+{Object.keys(grouped).length - 10} 个比赛日</div>
          )}
        </div>

        <div className="mt-3 text-center">
          <div className="text-[10px] text-white/20">{host || "racecalendar-visualize.vercel.app"}</div>
        </div>
      </div>
    </div>
  )
}

// 桌面壁纸（全年赛历横版 1280x720，3列4行 — 紧凑布局）
const DesktopWallpaper = ({
  ref,
  year,
  monthNames,
  yearGrouped,
  totalEvents,
  host,
}: {
  ref: React.RefObject<HTMLDivElement | null>
  year: number
  monthNames: string[]
  yearGrouped: Record<number, Record<string, RaceEvent[]>>
  totalEvents: number
  host: string
}) => {
  const weekDays = ["日", "一", "二", "三", "四", "五", "六"]

  return (
    <div
      ref={ref}
      className="relative shrink-0 overflow-hidden rounded-xl bg-gradient-to-br from-[#0a0a0f] via-[#0f0f1a] to-[#0a0a0f] text-white"
      style={{ width: DESKTOP_WIDTH, height: DESKTOP_HEIGHT, padding: "28px 32px" }}
    >
      {/* 背景光晕 */}
      <div className="absolute inset-0 opacity-[0.08] pointer-events-none">
        <div className="absolute -top-40 -right-40 h-96 w-96 rounded-full bg-red-600 blur-3xl" />
        <div className="absolute top-1/3 -left-40 h-96 w-96 rounded-full bg-blue-600 blur-3xl" />
        <div className="absolute bottom-0 right-1/4 h-96 w-96 rounded-full bg-purple-600 blur-3xl" />
      </div>

      {/* 网格背景 */}
      <div className="absolute inset-0 opacity-[0.03] pointer-events-none">
        <div
          className="h-full w-full"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)",
            backgroundSize: "40px 40px",
          }}
        />
      </div>

      <div className="relative z-10 flex h-full flex-col">
        {/* 头部 */}
        <div className="flex items-start justify-between border-b border-white/10 pb-3 mb-3">
          <div>
            <div className="text-[10px] font-bold tracking-[0.3em] text-white/30 uppercase">
              Race Calendar · Full Year
            </div>
            <h1 className="mt-0.5 text-2xl font-bold bg-gradient-to-r from-white via-white/80 to-white/40 bg-clip-text text-transparent">
              {year} 赛季
            </h1>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold text-white">{totalEvents}</div>
            <div className="text-[10px] text-white/40">Scheduled Events</div>
          </div>
        </div>

        {/* 12个月份网格 - 3列4行，紧凑布局 */}
        <div className="grid grid-cols-3 grid-rows-4 gap-2.5 flex-1">
          {Array.from({ length: 12 }).map((_, m) => {
            const grouped = yearGrouped[m] || {}
            const monthEvents = Object.values(grouped).flat()
            const daysInMonth = new Date(year, m + 1, 0).getDate()
            const firstDayOfWeek = new Date(year, m, 1).getDay()

            return (
              <div
                key={m}
                className="rounded-lg bg-white/[0.03] border border-white/5 p-2 flex flex-col overflow-hidden"
              >
                {/* 月份标题 */}
                <div className="flex items-baseline justify-between mb-1">
                  <h3 className="text-xs font-bold text-white/90">{monthNames[m]}</h3>
                  <span className="text-[8px] text-white/30 font-mono">
                    {monthEvents.length} 场
                  </span>
                </div>

                {/* 日历网格 - 紧凑行高 */}
                <div className="grid grid-cols-7 gap-px">
                  {weekDays.map((d) => (
                    <div
                      key={d}
                      className="text-center text-[7px] font-semibold text-white/30 leading-none py-0.5"
                    >
                      {d}
                    </div>
                  ))}
                  {Array.from({ length: firstDayOfWeek }).map((_, i) => (
                    <div key={`empty-${m}-${i}`} />
                  ))}
                  {Array.from({ length: daysInMonth }).map((_, i) => {
                    const day = i + 1
                    const dateStr = `${year}-${String(m + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`
                    const dayEvents = grouped[dateStr] || []
                    const hasF1 = dayEvents.some((e) => e.series === "F1")
                    const hasWRC = dayEvents.some((e) => e.series === "WRC")
                    const hasFE = dayEvents.some((e) => e.series === "FE")

                    return (
                      <div
                        key={day}
                        className={cn(
                          "flex flex-col items-center justify-center leading-none",
                          "h-[13px]",
                          dayEvents.length > 0
                            ? "bg-white/[0.08] rounded-sm border border-white/10"
                            : ""
                        )}
                      >
                        <span
                          className={cn(
                            "font-mono font-bold leading-none",
                            "text-[8px]",
                            dayEvents.length > 0 ? "text-white/80" : "text-white/20"
                          )}
                        >
                          {day}
                        </span>
                        {dayEvents.length > 0 && (
                          <div className="flex gap-px mt-px">
                            {hasF1 && <div className="w-0.5 h-0.5 rounded-full bg-[#ef4444]" />}
                            {hasWRC && <div className="w-0.5 h-0.5 rounded-full bg-[#3b82f6]" />}
                            {hasFE && <div className="w-0.5 h-0.5 rounded-full bg-[#10b981]" />}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>

                {/* 当月赛事列表（最多2条） */}
                {monthEvents.length > 0 && (
                  <div className="mt-1 space-y-0.5 border-t border-white/5 pt-1">
                    {monthEvents.slice(0, 2).map((event) => {
                      const mainSession = getMainSession(event)
                      return (
                        <div key={event.id} className="flex items-center gap-1 text-[8px] leading-tight">
                          <div
                            className="w-1 h-1 rounded-full shrink-0 mt-0.5"
                            style={{ backgroundColor: SERIES_COLORS[event.series] }}
                          />
                          <span className="text-white/60 truncate flex-1">{event.name}</span>
                          {mainSession && (
                            <span className="text-white/25 font-mono shrink-0">
                              {formatTime(mainSession.utc)}
                            </span>
                          )}
                        </div>
                      )
                    })}
                    {monthEvents.length > 2 && (
                      <div className="text-[7px] text-white/25 text-center leading-none">
                        +{monthEvents.length - 2}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* 底部：图例 + 版权 */}
        <div className="mt-3 flex items-center justify-between border-t border-white/10 pt-2.5">
          <div className="flex items-center gap-4">
            {Object.entries(SERIES_COLORS).map(([series, color]) => (
              <div key={series} className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-sm" style={{ backgroundColor: color }} />
                <span className="text-[9px] text-white/40 font-medium">{series}</span>
              </div>
            ))}
          </div>
          <div className="text-[9px] text-white/20 font-mono">
            {host || "racecalendar-visualize.vercel.app"}
          </div>
        </div>
      </div>
    </div>
  )
}

function eventsByDate(events: RaceEvent[], month: number, year: number): Record<string, RaceEvent[]> {
  const grouped: Record<string, RaceEvent[]> = {}
  const monthEvents = events.filter((e) => {
    const mainSession = getMainSession(e)
    if (!mainSession) return false
    const date = new Date(mainSession.utc)
    return date.getMonth() === month && date.getFullYear() === year
  })

  for (const event of monthEvents) {
    const mainSession = getMainSession(event)
    if (!mainSession) continue
    const dateStr = new Date(mainSession.utc).toISOString().split("T")[0]
    if (!grouped[dateStr]) grouped[dateStr] = []
    grouped[dateStr].push(event)
  }

  return grouped
}

function eventsByYear(events: RaceEvent[], year: number): Record<number, Record<string, RaceEvent[]>> {
  const result: Record<number, Record<string, RaceEvent[]>> = {}
  for (let m = 0; m < 12; m++) result[m] = {}

  const yearEvents = events.filter((e) => {
    const mainSession = getMainSession(e)
    if (!mainSession) return false
    return new Date(mainSession.utc).getFullYear() === year
  })

  for (const event of yearEvents) {
    const mainSession = getMainSession(event)
    if (!mainSession) continue
    const d = new Date(mainSession.utc)
    const m = d.getMonth()
    const dateStr = d.toISOString().split("T")[0]
    if (!result[m][dateStr]) result[m][dateStr] = []
    result[m][dateStr].push(event)
  }

  return result
}

function getMainSession(event: RaceEvent): RaceSession | undefined {
  return event.sessions.find((s) => s.isMain) || event.sessions[event.sessions.length - 1]
}

function formatTime(utc: string): string {
  const d = new Date(utc)
  const beijing = new Date(d.getTime() + 8 * 60 * 60 * 1000)
  return `${String(beijing.getHours()).padStart(2, "0")}:${String(beijing.getMinutes()).padStart(2, "0")}`
}
