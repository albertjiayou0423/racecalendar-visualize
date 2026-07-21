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

const SERIES_LABELS: Record<string, string> = {
  F1: "F1",
  WRC: "WRC",
  FE: "FE",
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

  // 按日期分组赛事
  const eventsByDate = useCallback(() => {
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
  }, [events, month, year])

  const grouped = eventsByDate()
  const monthNames = ["一月", "二月", "三月", "四月", "五月", "六月", "七月", "八月", "九月", "十月", "十一月", "十二月"]
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const firstDayOfWeek = new Date(year, month, 1).getDay()
  const weekDays = ["日", "一", "二", "三", "四", "五", "六"]

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

  return (
    <div className="space-y-4">
      {/* 预览控制 */}
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
            手机 (9:16)
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
            桌面 (16:9)
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
            生成壁纸
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
        <div
          ref={wallpaperRef}
          className={cn(
            "relative overflow-hidden rounded-xl bg-[#0a0a0f] text-white",
            aspectRatio === "phone" ? "w-[360px]" : "w-[720px]"
          )}
          style={{
            aspectRatio: aspectRatio === "phone" ? "9/16" : "16/9",
            padding: aspectRatio === "phone" ? "24px 16px" : "32px 48px",
          }}
        >
          {/* 背景装饰 */}
          <div className="absolute inset-0 opacity-10">
            <div className="absolute -top-20 -right-20 h-60 w-60 rounded-full bg-primary blur-3xl" />
            <div className="absolute -bottom-20 -left-20 h-60 w-60 rounded-full bg-blue-500 blur-3xl" />
          </div>

          {/* 内容 */}
          <div className="relative z-10 h-full flex flex-col">
            <div className="mb-4 text-center">
              <div className="text-xs font-medium tracking-widest text-white/50 uppercase">Race Calendar</div>
              <h2 className="mt-1 text-2xl font-bold tracking-tight">
                {year} {monthNames[month]}
              </h2>
              <div className="mt-1 text-xs text-white/40">
                {Object.values(grouped).flat().length} 场赛事
              </div>
            </div>

            {/* 日历网格 */}
            {aspectRatio === "phone" ? (
              // 手机布局：紧凑列表
              <div className="flex-1 space-y-2 overflow-y-auto">
                {Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b)).map(([date, dateEvents]) => {
                  const d = new Date(date)
                  return (
                    <div key={date} className="rounded-lg bg-white/5 p-3">
                      <div className="flex items-center gap-2 text-xs text-white/60">
                        <span className="font-mono font-bold text-white">{d.getDate()}</span>
                        <span>周{weekDays[d.getDay()]}</span>
                      </div>
                      <div className="mt-1 space-y-1">
                        {dateEvents.map((event) => {
                          const mainSession = getMainSession(event)
                          return (
                            <div key={event.id} className="flex items-center gap-2">
                              <div
                                className="h-2 w-2 rounded-full shrink-0"
                                style={{ backgroundColor: SERIES_COLORS[event.series] }}
                              />
                              <span className="text-xs text-white/90 truncate">{event.name}</span>
                              {mainSession && (
                                <span className="text-[10px] text-white/40 font-mono ml-auto shrink-0">
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
            ) : (
              // 桌面布局：月历网格 + 赛事列表
              <div className="flex-1 flex">
                <div className="flex-1 mr-4">
                  <div className="grid grid-cols-7 gap-1.5">
                    {weekDays.map((d) => (
                      <div key={d} className="py-1.5 text-center text-xs text-white/40 font-medium">
                        {d}
                      </div>
                    ))}
                    {Array.from({ length: firstDayOfWeek }).map((_, i) => (
                      <div key={`empty-${i}`} />
                    ))}
                    {Array.from({ length: daysInMonth }).map((_, i) => {
                      const day = i + 1
                      const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`
                      const dayEvents = grouped[dateStr] || []
                      return (
                        <div
                          key={day}
                          className={cn(
                            "aspect-square rounded-md p-1.5 text-xs",
                            dayEvents.length > 0 ? "bg-white/5" : ""
                          )}
                        >
                          <div className={cn("font-mono font-bold", dayEvents.length > 0 ? "text-white/80" : "text-white/30")}>
                            {day}
                          </div>
                          <div className="mt-0.5 space-y-0.5">
                            {dayEvents.slice(0, 3).map((event) => (
                              <div
                                key={event.id}
                                className="h-1.5 rounded-full"
                                style={{ backgroundColor: SERIES_COLORS[event.series] }}
                                title={event.name}
                              />
                            ))}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
                {/* 右侧赛事列表 */}
                <div className="w-48 border-l border-white/10 pl-4">
                  <div className="text-xs font-medium text-white/50 mb-3">本月赛事</div>
                  <div className="space-y-2 max-h-full overflow-y-auto">
                    {Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b)).slice(0, 10).map(([date, dateEvents]) => {
                      const d = new Date(date)
                      return (
                        <div key={date}>
                          <div className="text-[10px] text-white/40 font-mono">
                            {d.getDate()}日 周{weekDays[d.getDay()]}
                          </div>
                          <div className="mt-0.5 space-y-0.5">
                            {dateEvents.map((event) => (
                              <div key={event.id} className="flex items-center gap-1.5">
                                <div
                                  className="h-1.5 w-1.5 rounded-full"
                                  style={{ backgroundColor: SERIES_COLORS[event.series] }}
                                />
                                <span className="text-xs text-white/80 truncate">{event.name}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )
                    })}
                    {Object.keys(grouped).length === 0 && (
                      <div className="text-xs text-white/30">暂无赛事</div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* 底部品牌 */}
            <div className="mt-auto pt-3 text-center">
              <div className="text-[10px] text-white/20">racecalendar-visualize.vercel.app</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function getMainSession(event: RaceEvent): RaceSession | undefined {
  return event.sessions.find((s) => s.isMain) || event.sessions[event.sessions.length - 1]
}

function formatTime(utc: string): string {
  const d = new Date(utc)
  const beijing = new Date(d.getTime() + 8 * 60 * 60 * 1000)
  return `${String(beijing.getHours()).padStart(2, "0")}:${String(beijing.getMinutes()).padStart(2, "0")}`
}
