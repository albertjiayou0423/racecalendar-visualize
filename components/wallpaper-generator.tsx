"use client"

import { useRef, useState, useEffect, useCallback } from "react"
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
  const wallpaperRef = useRef<HTMLDivElement>(null)
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>("phone")
  const [generating, setGenerating] = useState(false)
  const [generatedUrl, setGeneratedUrl] = useState<string | null>(null)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const grouped = eventsByDate(events, month, year)
  const monthNames = ["一月", "二月", "三月", "四月", "五月", "六月", "七月", "八月", "九月", "十月", "十一月", "十二月"]

  const generateWallpaper = async () => {
    if (!wallpaperRef.current) return
    setGenerating(true)
    try {
      const dataUrl = await toPng(wallpaperRef.current, {
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
    link.download = `race-calendar-${year}-${String(month + 1).padStart(2, "0")}.png`
    link.href = generatedUrl
    link.click()
  }

  if (!mounted) return null

  const totalEvents = Object.values(grouped).flat().length

  return (
    <div className="space-y-4">
      {/* 控制栏 */}
      <div className="flex items-center justify-between">
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
            手机
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
            桌面
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

      {/* 壁纸预览 */}
      <div className="flex justify-center overflow-hidden rounded-xl border border-border bg-black/5 p-4">
        {aspectRatio === "phone" ? (
          <PhoneWallpaper
            ref={wallpaperRef}
            year={year}
            month={month}
            monthNames={monthNames}
            grouped={grouped}
            totalEvents={totalEvents}
          />
        ) : (
          <DesktopWallpaper
            ref={wallpaperRef}
            year={year}
            month={month}
            monthNames={monthNames}
            grouped={grouped}
            totalEvents={totalEvents}
          />
        )}
      </div>
    </div>
  )
}

// 手机壁纸组件
const PhoneWallpaper = ({
  ref,
  year,
  month,
  monthNames,
  grouped,
  totalEvents,
}: {
  ref: React.RefObject<HTMLDivElement | null>
  year: number
  month: number
  monthNames: string[]
  grouped: Record<string, RaceEvent[]>
  totalEvents: number
}) => {
  const weekDays = ["日", "一", "二", "三", "四", "五", "六"]

  return (
    <div
      ref={ref}
      className="relative w-[360px] overflow-hidden rounded-xl bg-[#0a0a0f] text-white"
      style={{ aspectRatio: "9/16", padding: "24px 16px" }}
    >
      {/* 背景 */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute -top-20 -right-20 h-60 w-60 rounded-full bg-red-500 blur-3xl" />
        <div className="absolute -bottom-20 -left-20 h-60 w-60 rounded-full bg-blue-500 blur-3xl" />
      </div>

      <div className="relative z-10 h-full flex flex-col">
        {/* 头部 */}
        <div className="text-center">
          <div className="text-[10px] font-medium tracking-widest text-white/40 uppercase">Race Calendar</div>
          <h2 className="mt-1 text-2xl font-bold">{year} {monthNames[month]}</h2>
          <div className="mt-1 text-xs text-white/30">{totalEvents} 场赛事</div>
        </div>

        {/* 赛事列表 */}
        <div className="mt-4 flex-1 space-y-2 overflow-y-auto">
          {Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b)).map(([date, dateEvents]) => {
            const d = new Date(date)
            return (
              <div key={date} className="rounded-lg bg-white/5 p-3">
                <div className="flex items-center gap-2 text-xs text-white/50">
                  <span className="font-mono font-bold text-white/80">{d.getDate()}</span>
                  <span>周{weekDays[d.getDay()]}</span>
                </div>
                <div className="mt-1.5 space-y-1">
                  {dateEvents.map((event) => {
                    const mainSession = getMainSession(event)
                    return (
                      <div key={event.id} className="flex items-center gap-2">
                        <div
                          className="h-2 w-2 rounded-full shrink-0"
                          style={{ backgroundColor: SERIES_COLORS[event.series] }}
                        />
                        <span className="text-xs text-white/90 truncate flex-1">{event.name}</span>
                        {mainSession && (
                          <span className="text-[10px] text-white/40 font-mono">
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
        </div>

        {/* 底部 */}
        <div className="mt-4 text-center">
          <div className="text-[10px] text-white/20">racecalendar-visualize.vercel.app</div>
        </div>
      </div>
    </div>
  )
}

// 桌面壁纸组件 - 改进版布局
const DesktopWallpaper = ({
  ref,
  year,
  month,
  monthNames,
  grouped,
  totalEvents,
}: {
  ref: React.RefObject<HTMLDivElement | null>
  year: number
  month: number
  monthNames: string[]
  grouped: Record<string, RaceEvent[]>
  totalEvents: number
}) => {
  const weekDays = ["日", "一", "二", "三", "四", "五", "六"]
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const firstDayOfWeek = new Date(year, month, 1).getDay()
  
  const allEvents = Object.entries(grouped).flatMap(([date, events]) => 
    events.map(e => ({ ...e, date }))
  ).slice(0, 6)

  return (
    <div
      ref={ref}
      className="relative w-[800px] overflow-hidden rounded-xl bg-gradient-to-br from-[#0a0a0f] via-[#0f0f1a] to-[#0a0a0f] text-white"
      style={{ aspectRatio: "16/9", padding: "32px" }}
    >
      {/* 背景装饰 */}
      <div className="absolute inset-0 opacity-8">
        <div className="absolute -top-40 -right-40 h-96 w-96 rounded-full bg-red-600 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 h-96 w-96 rounded-full bg-blue-600 blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[600px] w-[600px] rounded-full bg-purple-600 blur-3xl" />
      </div>

      {/* 网格背景 */}
      <div className="absolute inset-0 opacity-[0.03]">
        <div className="h-full w-full" style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
      </div>

      <div className="relative z-10 h-full flex flex-col">
        {/* 头部 */}
        <div className="flex items-start justify-between">
          <div>
            <div className="text-[10px] font-bold tracking-[0.3em] text-white/30 uppercase">Race Calendar</div>
            <h1 className="mt-2 text-4xl font-bold bg-gradient-to-r from-white via-white/80 to-white/40 bg-clip-text text-transparent">
              {year} {monthNames[month]}
            </h1>
          </div>
          <div className="flex items-end gap-2">
            <div className="text-right">
              <div className="text-4xl font-bold text-white">{totalEvents}</div>
              <div className="text-xs text-white/40">Scheduled Events</div>
            </div>
          </div>
        </div>

        {/* 主体区域：左侧日历 + 右侧赛事列表 */}
        <div className="mt-6 flex-1 flex gap-6">
          {/* 左侧：日历网格 */}
          <div className="flex-1">
            <div className="grid grid-cols-7 gap-1.5">
              {weekDays.map((d) => (
                <div key={d} className="text-center text-xs font-semibold text-white/30 py-2">
                  {d}
                </div>
              ))}
              {Array.from({ length: firstDayOfWeek }).map((_, i) => (
                <div key={`empty-${i}`} className="aspect-square" />
              ))}
              {Array.from({ length: daysInMonth }).map((_, i) => {
                const day = i + 1
                const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`
                const dayEvents = grouped[dateStr] || []
                const hasF1 = dayEvents.some(e => e.series === "F1")
                const hasWRC = dayEvents.some(e => e.series === "WRC")
                const hasFE = dayEvents.some(e => e.series === "FE")
                
                return (
                  <div
                    key={day}
                    className={cn(
                      "aspect-square rounded-lg flex flex-col items-center justify-center p-1 transition-all",
                      dayEvents.length > 0 
                        ? "bg-white/8 backdrop-blur-sm border border-white/10" 
                        : ""
                    )}
                  >
                    <div className={cn(
                      "text-xs font-mono font-bold",
                      dayEvents.length > 0 ? "text-white/90" : "text-white/20"
                    )}>
                      {day}
                    </div>
                    {dayEvents.length > 0 && (
                      <div className="mt-1 flex gap-0.5">
                        {hasF1 && <div className="w-1.5 h-1.5 rounded-full bg-[#ef4444]" title="F1" />}
                        {hasWRC && <div className="w-1.5 h-1.5 rounded-full bg-[#3b82f6]" title="WRC" />}
                        {hasFE && <div className="w-1.5 h-1.5 rounded-full bg-[#10b981]" title="FE" />}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {/* 右侧：赛事列表 */}
          <div className="w-64">
            <div className="text-xs font-semibold tracking-wider text-white/30 uppercase mb-3">
              Featured Events
            </div>
            <div className="space-y-3">
              {allEvents.length > 0 ? (
                allEvents.map((event, index) => {
                  const mainSession = getMainSession(event)
                  const d = new Date(event.date)
                  return (
                    <div
                      key={event.id}
                      className="rounded-lg bg-white/5 backdrop-blur-sm border border-white/5 p-3 hover:bg-white/8 transition-colors"
                      style={{ animationDelay: `${index * 50}ms` }}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <div 
                          className="w-2 h-2 rounded-full"
                          style={{ backgroundColor: SERIES_COLORS[event.series] }}
                        />
                        <span className="text-[10px] font-mono text-white/50">
                          {d.getDate()}日
                        </span>
                        <span className="text-[10px] text-white/30">
                          {weekDays[d.getDay()]}
                        </span>
                      </div>
                      <div className="text-sm font-medium text-white/90 truncate">
                        {event.name}
                      </div>
                      <div className="text-[10px] text-white/40 truncate mt-0.5">
                        {event.circuit}
                      </div>
                      {mainSession && (
                        <div className="text-[10px] font-mono text-white/50 mt-1">
                          {formatTime(mainSession.utc)}
                        </div>
                      )}
                    </div>
                  )
                })
              ) : (
                <div className="rounded-lg bg-white/5 p-4 text-center">
                  <div className="text-sm text-white/40">本月暂无赛事</div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 底部：图例 + 版权 */}
        <div className="mt-6 flex items-center justify-between border-t border-white/5 pt-4">
          <div className="flex items-center gap-6">
            {Object.entries(SERIES_COLORS).map(([series, color]) => (
              <div key={series} className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-md" style={{ backgroundColor: color }} />
                <span className="text-xs text-white/40 font-medium">{series}</span>
              </div>
            ))}
          </div>
          <div className="text-[10px] text-white/20 font-mono">
            racecalendar.vercel.app
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

function getMainSession(event: RaceEvent): RaceSession | undefined {
  return event.sessions.find((s) => s.isMain) || event.sessions[event.sessions.length - 1]
}

function formatTime(utc: string): string {
  const d = new Date(utc)
  const beijing = new Date(d.getTime() + 8 * 60 * 60 * 1000)
  return `${String(beijing.getHours()).padStart(2, "0")}:${String(beijing.getMinutes()).padStart(2, "0")}`
}