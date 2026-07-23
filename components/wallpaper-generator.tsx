"use client"

import { useRef, useState, useEffect, useMemo } from "react"
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
  F1: "Formula 1",
  WRC: "WRC",
  FE: "Formula E",
}

const MONTH_NAMES = [
  "一月", "二月", "三月", "四月", "五月", "六月",
  "七月", "八月", "九月", "十月", "十一月", "十二月",
]

const WEEKDAYS = ["日", "一", "二", "三", "四", "五", "六"]

export function WallpaperGenerator({ events, month, year }: WallpaperGeneratorProps) {
  const phoneRef = useRef<HTMLDivElement>(null)
  const desktopRef = useRef<SVGSVGElement>(null)
  const [mode, setMode] = useState<AspectRatio>("desktop")
  const [generating, setGenerating] = useState(false)
  const [generatedUrl, setGeneratedUrl] = useState<string | null>(null)
  const [host, setHost] = useState("")
  const [previewZoom, setPreviewZoom] = useState(0.5)
  const previewWrapRef = useRef<HTMLDivElement>(null)

  const grouped = useMemo(() => eventsByDate(events, month, year), [events, month, year])
  const yearGrouped = useMemo(() => eventsByYear(events, year), [events, year])
  const totalEvents = useMemo(
    () => Object.values(grouped).flat().length,
    [grouped]
  )
  const yearTotalEvents = useMemo(
    () => Object.values(yearGrouped).reduce((acc, m) => acc + Object.values(m).flat().length, 0),
    [yearGrouped]
  )

  useEffect(() => {
    if (typeof window !== "undefined") setHost(window.location.hostname)
  }, [])

  useEffect(() => {
    if (!previewWrapRef.current) return
    const updateZoom = () => {
      const wrap = previewWrapRef.current!
      const w = wrap.clientWidth
      const h = wrap.clientHeight
      if (mode === "phone") {
        const z = Math.min(w / 1080, h / 1920)
        setPreviewZoom(Math.max(0.25, Math.min(1, z || 0.5)))
      } else {
        const z = Math.min(w / 1600, h / 1200)
        setPreviewZoom(Math.max(0.25, Math.min(1, z || 0.5)))
      }
    }
    updateZoom()
    const ro = new ResizeObserver(updateZoom)
    ro.observe(previewWrapRef.current)
    window.addEventListener("resize", updateZoom)
    return () => {
      ro.disconnect()
      window.removeEventListener("resize", updateZoom)
    }
  }, [mode])

  useEffect(() => {
    setGeneratedUrl(null)
  }, [mode, month, year])

  const generate = async () => {
    if (generating) return
    setGenerating(true)
    try {
      if (mode === "phone") {
        if (!phoneRef.current) return
        const dataUrl = await toPng(phoneRef.current, { quality: 1, pixelRatio: 2, cacheBust: true })
        setGeneratedUrl(dataUrl)
      } else {
        if (!desktopRef.current) return
        const svg = desktopRef.current
        const serializer = new XMLSerializer()
        const clone = svg.cloneNode(true) as SVGSVGElement
        clone.setAttribute("xmlns", "http://www.w3.org/2000/svg")
        clone.setAttribute("xmlns:xlink", "http://www.w3.org/1999/xlink")
        clone.setAttribute("width", "1600")
        clone.setAttribute("height", "1200")
        const svgStr = serializer.serializeToString(clone)
        const blob = new Blob(
          ['<?xml version="1.0" encoding="UTF-8"?>\n', svgStr],
          { type: "image/svg+xml;charset=utf-8" }
        )
        const url = URL.createObjectURL(blob)
        const img = new Image()
        img.crossOrigin = "anonymous"
        await new Promise<void>((resolve, reject) => {
          img.onload = () => resolve()
          img.onerror = (e) => reject(new Error("SVG load error: " + String(e)))
          img.src = url
        })
        const scale = 2
        const canvas = document.createElement("canvas")
        canvas.width = 1600 * scale
        canvas.height = 1200 * scale
        const ctx = canvas.getContext("2d")!
        ctx.fillStyle = "#0a0a0f"
        ctx.fillRect(0, 0, canvas.width, canvas.height)
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
        URL.revokeObjectURL(url)
        setGeneratedUrl(canvas.toDataURL("image/png"))
      }
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

  return (
    <div className="space-y-4">
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

      {/* 预览区 */}
      <div className="rounded-xl border border-border bg-black/5 p-3 sm:p-4">
        <div
          ref={previewWrapRef}
          className="relative w-full"
          style={{
            height:
              mode === "phone"
                ? Math.round(1920 * previewZoom + 120)
                : Math.round(1200 * previewZoom + 160),
            overflow: "hidden",
          }}
        >
          {mode === "phone" ? (
            <div
              style={{
                width: 1080,
                height: 1920,
                transform: `scale(${previewZoom})`,
                transformOrigin: "top left",
              }}
            >
              <PhoneWallpaper
                ref={null}
                year={year}
                month={month}
                monthNames={MONTH_NAMES}
                grouped={grouped}
                totalEvents={totalEvents}
                host={host}
              />
            </div>
          ) : (
            <div
              style={{
                width: 1600,
                height: 1200,
                transform: `scale(${previewZoom})`,
                transformOrigin: "top left",
              }}
            >
              <DesktopWallpaper
                ref={null}
                year={year}
                monthNames={MONTH_NAMES}
                yearGrouped={yearGrouped}
                totalEvents={yearTotalEvents}
                host={host}
              />
            </div>
          )}
        </div>
      </div>

      {/* 生成用 DOM —— 屏幕外完整尺寸 */}
      <div
        className="pointer-events-none fixed -z-[9999]"
        style={{ left: "-9999px", top: 0 }}
        aria-hidden="true"
      >
        <PhoneWallpaper
          ref={phoneRef}
          year={year}
          month={month}
          monthNames={MONTH_NAMES}
          grouped={grouped}
          totalEvents={totalEvents}
          host={host}
        />
      </div>
      <div
        className="pointer-events-none fixed -z-[9999]"
        style={{ left: "-9999px", top: 2200 }}
        aria-hidden="true"
      >
        <DesktopWallpaper
          ref={desktopRef}
          year={year}
          monthNames={MONTH_NAMES}
          yearGrouped={yearGrouped}
          totalEvents={yearTotalEvents}
          host={host}
        />
      </div>
    </div>
  )
}

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
  return (
    <div
      ref={ref}
      className="relative overflow-hidden bg-[#0a0a0f] text-white"
      style={{ width: 1080, height: 1920, padding: "80px 60px" }}
    >
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute -top-40 -right-40 h-[500px] w-[500px] rounded-full bg-red-500/20 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 h-[500px] w-[500px] rounded-full bg-blue-500/20 blur-3xl" />
      </div>

      <div className="relative z-10 flex h-full flex-col">
        <div className="text-center">
          <div className="text-lg font-medium tracking-[0.3em] text-white/40 uppercase">
            Race Calendar
          </div>
          <h2 className="mt-4 text-6xl font-bold">
            {year} {monthNames[month]}
          </h2>
          <div className="mt-4 text-xl text-white/40">{totalEvents} 场赛事</div>
        </div>

        <div className="mt-10 flex-1 space-y-4 overflow-hidden">
          {Object.entries(grouped)
            .sort(([a], [b]) => a.localeCompare(b))
            .slice(0, 10)
            .map(([date, dateEvents]) => {
              const d = new Date(date)
              return (
                <div key={date} className="rounded-2xl bg-white/[0.05] p-5 backdrop-blur-sm">
                  <div className="flex items-center gap-4 text-white/60">
                    <span className="text-4xl font-bold text-white/90 font-mono">{d.getDate()}</span>
                    <span className="text-xl">周{WEEKDAYS[d.getDay()]}</span>
                  </div>
                  <div className="mt-4 space-y-2">
                    {dateEvents.map((event) => {
                      const s = getMainSession(event)
                      return (
                        <div key={event.id} className="flex items-center gap-3">
                          <div
                            className="h-4 w-4 shrink-0 rounded-full"
                            style={{ backgroundColor: SERIES_COLORS[event.series] }}
                          />
                          <span className="text-xl text-white/90 flex-1 truncate">{event.name}</span>
                          {s && <span className="text-base text-white/40 font-mono">{formatTime(s.utc)}</span>}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          {Object.keys(grouped).length === 0 && (
            <div className="py-16 text-center text-2xl text-white/30">该月暂无赛事</div>
          )}
        </div>

        <div className="mt-8 text-center text-base text-white/20">
          {host || "racecalendar-visualize.vercel.app"}
        </div>
      </div>
    </div>
  )
}

const DesktopWallpaper = ({
  ref,
  year,
  monthNames,
  yearGrouped,
  totalEvents,
  host,
}: {
  ref: React.RefObject<SVGSVGElement | null>
  year: number
  monthNames: string[]
  yearGrouped: Record<number, Record<string, RaceEvent[]>>
  totalEvents: number
  host: string
}) => {
  const W = 1600
  const H = 1200
  const PAD_X = 60
  const PAD_TOP = 50
  const PAD_BOTTOM = 50
  const GAP = 24

  const HEADER_H = 150
  const FOOTER_H = 90

  const gridX0 = PAD_X
  const gridY0 = PAD_TOP + HEADER_H + GAP
  const gridW = W - PAD_X * 2
  const gridH = H - PAD_TOP - HEADER_H - GAP - FOOTER_H - GAP - PAD_BOTTOM
  const cardW = (gridW - GAP * 3) / 4
  const cardH = (gridH - GAP * 2) / 3

  const cardPos = (m: number) => {
    const col = m % 4
    const row = Math.floor(m / 4)
    return {
      x: gridX0 + col * (cardW + GAP),
      y: gridY0 + row * (cardH + GAP),
    }
  }

  return (
    <svg
      ref={ref}
      xmlns="http://www.w3.org/2000/svg"
      viewBox={`0 0 ${W} ${H}`}
      width={W}
      height={H}
      style={{ display: "block", background: "#0a0a0f" }}
    >
      <defs>
        <linearGradient id="bg-grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#0a0a0f" />
          <stop offset="50%" stopColor="#0f0f1a" />
          <stop offset="100%" stopColor="#0a0a0f" />
        </linearGradient>
        <radialGradient id="glow-red" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#ef4444" stopOpacity="0.25" />
          <stop offset="100%" stopColor="#ef4444" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="glow-blue" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.25" />
          <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="glow-purple" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#a855f7" stopOpacity="0.22" />
          <stop offset="100%" stopColor="#a855f7" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* 背景 */}
      <rect width={W} height={H} fill="url(#bg-grad)" />
      <circle cx={W - 100} cy={100} r={320} fill="url(#glow-red)" />
      <circle cx={100} cy={300} r={320} fill="url(#glow-blue)" />
      <circle cx={W * 0.75} cy={H - 50} r={320} fill="url(#glow-purple)" />

      {/* 头部 */}
      <g>
        <text
          x={PAD_X}
          y={PAD_TOP + 24}
          fill="rgba(255,255,255,0.3)"
          fontSize="18"
          fontWeight="700"
          letterSpacing="6"
          style={{ fontFamily: "ui-sans-serif, system-ui, -apple-system" }}
        >
          RACE CALENDAR · FULL YEAR
        </text>
        <text
          x={PAD_X}
          y={PAD_TOP + 80}
          fill="white"
          fontSize="46"
          fontWeight="700"
          style={{ fontFamily: "ui-sans-serif, system-ui, -apple-system" }}
        >
          {year} 赛季全年赛历
        </text>
        <text
          x={PAD_X}
          y={PAD_TOP + 118}
          fill="rgba(255,255,255,0.25)"
          fontSize="16"
          style={{ fontFamily: "ui-sans-serif, system-ui, -apple-system" }}
        >
          全年 {totalEvents} 场比赛 · F1 / WRC / FE
        </text>

        <text
          x={W - PAD_X}
          y={PAD_TOP + 55}
          fill="white"
          fontSize="56"
          fontWeight="700"
          textAnchor="end"
          style={{ fontFamily: "ui-sans-serif, system-ui, -apple-system" }}
        >
          {totalEvents}
        </text>
        <text
          x={W - PAD_X}
          y={PAD_TOP + 88}
          fill="rgba(255,255,255,0.35)"
          fontSize="14"
          textAnchor="end"
          style={{ fontFamily: "ui-sans-serif, system-ui, -apple-system" }}
        >
          SCHEDULED EVENTS
        </text>

        <line
          x1={PAD_X}
          y1={PAD_TOP + HEADER_H - GAP / 2}
          x2={W - PAD_X}
          y2={PAD_TOP + HEADER_H - GAP / 2}
          stroke="rgba(255,255,255,0.1)"
          strokeWidth="1"
        />
      </g>

      {/* 12 个月份卡片 —— 一行四个共三行 */}
      {Array.from({ length: 12 }).map((_, m) => {
        const grouped = yearGrouped[m] || {}
        const monthEvents = Object.values(grouped).flat()
        const daysInMonth = new Date(year, m + 1, 0).getDate()
        const firstDay = new Date(year, m, 1).getDay()
        const pos = cardPos(m)

        return (
          <MonthCard
            key={m}
            x={pos.x}
            y={pos.y}
            w={cardW}
            h={cardH}
            year={year}
            monthName={monthNames[m]}
            monthIndex={m}
            daysInMonth={daysInMonth}
            firstDay={firstDay}
            grouped={grouped}
            monthEvents={monthEvents}
          />
        )
      })}

      {/* 底部图例 */}
      <g>
        <line
          x1={PAD_X}
          y1={H - PAD_BOTTOM - FOOTER_H + GAP / 2}
          x2={W - PAD_X}
          y2={H - PAD_BOTTOM - FOOTER_H + GAP / 2}
          stroke="rgba(255,255,255,0.1)"
          strokeWidth="1"
        />

        {Object.entries(SERIES_COLORS).map(([series, color], idx) => {
          const xStart = PAD_X + idx * 180
          const y = H - PAD_BOTTOM - FOOTER_H + 35
          return (
            <g key={series}>
              <rect x={xStart} y={y - 12} width="16" height="16" rx="3" fill={color} />
              <text
                x={xStart + 26}
                y={y + 2}
                fill="rgba(255,255,255,0.45)"
                fontSize="14"
                fontWeight="500"
                style={{ fontFamily: "ui-sans-serif, system-ui, -apple-system" }}
              >
                {SERIES_LABELS[series]}
              </text>
            </g>
          )
        })}

        <text
          x={W - PAD_X}
          y={H - PAD_BOTTOM - FOOTER_H + 40}
          fill="rgba(255,255,255,0.2)"
          fontSize="13"
          textAnchor="end"
          fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
        >
          {host || "racecalendar-visualize.vercel.app"}
        </text>
      </g>
    </svg>
  )
}

const MonthCard = ({
  x,
  y,
  w,
  h,
  year,
  monthName,
  monthIndex,
  daysInMonth,
  firstDay,
  grouped,
  monthEvents,
}: {
  x: number
  y: number
  w: number
  h: number
  year: number
  monthName: string
  monthIndex: number
  daysInMonth: number
  firstDay: number
  grouped: Record<string, RaceEvent[]>
  monthEvents: RaceEvent[]
}) => {
  const padX = 20
  const padY = 18
  const innerX = x + padX
  const innerY = y + padY
  const innerW = w - padX * 2
  const innerH = h - padY * 2

  const headerH = 38
  const weekDayH = 26
  const gridTop = innerY + headerH + weekDayH
  const gridBottom = y + h - padY - 8
  const gridH = Math.max(30, gridBottom - gridTop)

  const colW = innerW / 7
  const cellH = gridH / 6

  const eventListTop = y + h - padY - 78
  const eventListAvailable = Math.max(0, eventListTop - (gridTop + gridH))

  return (
    <g>
      <rect
        x={x}
        y={y}
        width={w}
        height={h}
        rx="14"
        fill="rgba(255,255,255,0.03)"
        stroke="rgba(255,255,255,0.06)"
        strokeWidth="1"
      />

      {/* 月份标题 */}
      <text
        x={innerX}
        y={innerY + 22}
        fill="rgba(255,255,255,0.95)"
        fontSize="20"
        fontWeight="700"
        style={{ fontFamily: "ui-sans-serif, system-ui, -apple-system" }}
      >
        {monthName}
      </text>
      <text
        x={x + w - padX}
        y={innerY + 22}
        fill="rgba(255,255,255,0.3)"
        fontSize="13"
        textAnchor="end"
        fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
      >
        {monthEvents.length} 场
      </text>

      {/* 星期表头 */}
      {WEEKDAYS.map((d, i) => (
        <text
          key={d}
          x={innerX + colW * i + colW / 2}
          y={innerY + headerH + 15}
          fill="rgba(255,255,255,0.35)"
          fontSize="11"
          fontWeight="600"
          textAnchor="middle"
          style={{ fontFamily: "ui-sans-serif, system-ui, -apple-system" }}
        >
          {d}
        </text>
      ))}

      {/* 日期格子 */}
      {Array.from({ length: daysInMonth }).map((_, i) => {
        const day = i + 1
        const dateStr = `${year}-${String(monthIndex + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`
        const dayEvents = grouped[dateStr] || []
        const f1 = dayEvents.some((e) => e.series === "F1")
        const wrc = dayEvents.some((e) => e.series === "WRC")
        const fe = dayEvents.some((e) => e.series === "FE")

        const cellRow = Math.floor((firstDay + i) / 7)
        const cellCol = (firstDay + i) % 7
        const cx = innerX + colW * cellCol
        const cy = gridTop + cellH * cellRow

        const hasEvent = dayEvents.length > 0

        return (
          <g key={day}>
            {hasEvent && (
              <rect
                x={cx + 1}
                y={cy + 1}
                width={colW - 2}
                height={cellH - 2}
                rx="4"
                fill="rgba(255,255,255,0.08)"
              />
            )}
            <text
              x={cx + colW / 2}
              y={cy + cellH / 2 + 4}
              fill={hasEvent ? "rgba(255,255,255,0.95)" : "rgba(255,255,255,0.25)"}
              fontSize="12"
              fontWeight={hasEvent ? 700 : 400}
              textAnchor="middle"
              fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
            >
              {day}
            </text>
            {hasEvent && (
              <g transform={`translate(${cx + colW / 2}, ${cy + cellH - 4})`}>
                {f1 && <circle cx={-3} cy={0} r={1.6} fill="#ef4444" />}
                {wrc && <circle cx={0} cy={0} r={1.6} fill="#3b82f6" />}
                {fe && <circle cx={3} cy={0} r={1.6} fill="#10b981" />}
              </g>
            )}
          </g>
        )
      })}

      {/* 赛事列表（最多 2 条） */}
      {monthEvents.length > 0 && (
        <g>
          <line
            x1={innerX}
            y1={gridTop + gridH + 4}
            x2={x + w - padX}
            y2={gridTop + gridH + 4}
            stroke="rgba(255,255,255,0.06)"
            strokeWidth="1"
          />
          {monthEvents.slice(0, 2).map((event, idx) => {
            const yPos = gridTop + gridH + 4 + 16 * (idx + 1)
            const displayName =
              event.name.length > 14 ? event.name.slice(0, 13) + "…" : event.name
            return (
              <g key={event.id} transform={`translate(${innerX}, ${yPos - 11})`}>
                <rect
                  x={0}
                  y={-5}
                  width={3}
                  height={12}
                  rx={1.5}
                  fill={SERIES_COLORS[event.series]}
                />
                <text
                  x={10}
                  y={4}
                  fill="rgba(255,255,255,0.75)"
                  fontSize="12"
                  style={{ fontFamily: "ui-sans-serif, system-ui, -apple-system" }}
                >
                  {displayName}
                </text>
              </g>
            )
          })}
          {monthEvents.length > 2 && (
            <text
              x={x + w / 2}
              y={gridTop + gridH + 4 + 16 * 3 - 6}
              fill="rgba(255,255,255,0.25)"
              fontSize="10"
              textAnchor="middle"
              style={{ fontFamily: "ui-sans-serif, system-ui, -apple-system" }}
            >
              +{monthEvents.length - 2} 更多
            </text>
          )}
        </g>
      )}
    </g>
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
