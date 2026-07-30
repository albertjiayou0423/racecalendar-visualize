"use client"

import { Clock, Play, ChevronRight } from "lucide-react"
import type { RaceEvent, RaceSession } from "@/lib/types"
import { BEIJING_TZ, countdown, formatDateTime, formatDate } from "@/lib/format"
import { cn } from "@/lib/utils"
import { WeatherStrip } from "@/components/weather-strip"

interface SessionTimelineProps {
  event: RaceEvent
  now: number
}

/** 每个赛段的假定持续时长（毫秒），用于进度计算 */
const SESSION_DURATION_MS: Record<string, number> = {
  race: 2 * 60 * 60 * 1000,       // 正赛 2h
  sprint: 1 * 60 * 60 * 1000,    // 冲刺赛 1h
  quali: 1 * 60 * 60 * 1000,      // 排位赛 1h
  practice: 1 * 60 * 60 * 1000,  // 练习赛 1h
  default: 1.5 * 60 * 60 * 1000,
}

/** 根据 session 名称推断类型 */
function getSessionType(name: string): "practice" | "quali" | "sprint" | "race" {
  const lower = name.toLowerCase()
  if (lower.includes("race") || lower.includes("正赛") || lower.includes("决赛")) return "race"
  if (lower.includes("sprint") || lower.includes("冲刺")) return "sprint"
  if (lower.includes("qual") || lower.includes("排位")) return "quali"
  return "practice"
}

/** 赛段类型 → 配色 */
const SESSION_COLORS: Record<string, { base: string; live: string; dim: string; label: string }> = {
  practice: { base: "#3b82f6", live: "#60a5fa", dim: "#1e3a5f", label: "练习" },
  quali: { base: "#a855f7", live: "#c084fc", dim: "#3b0764", label: "排位" },
  sprint: { base: "#f97316", live: "#fb923c", dim: "#431407", label: "冲刺" },
  race: { base: "#ef4444", live: "#f87171", dim: "#450a0a", label: "正赛" },
}

function getSessionDuration(session: RaceSession): number {
  const type = getSessionType(session.name)
  return SESSION_DURATION_MS[type] ?? SESSION_DURATION_MS.default
}

export function SessionTimeline({ event, now }: SessionTimelineProps) {
  if (event.sessions.length === 0) return null

  const sessions = event.sessions
  const firstSessionStart = new Date(sessions[0].utc).getTime()
  const lastSessionEnd = new Date(sessions[sessions.length - 1].utc).getTime() + getSessionDuration(sessions[sessions.length - 1])
  const totalDuration = lastSessionEnd - firstSessionStart

  // 找到当前正在进行的 session
  const currentSessionIndex = sessions.findIndex((s) => {
    const start = new Date(s.utc).getTime()
    const end = start + getSessionDuration(s)
    return now >= start && now <= end
  })

  // 找到下一个未开始的 session
  const nextSessionIndex = sessions.findIndex((s) => {
    const start = new Date(s.utc).getTime()
    return now < start
  })

  // 精确进度：基于 session 区间
  let progress = 0
  if (currentSessionIndex >= 0) {
    const s = sessions[currentSessionIndex]
    const start = new Date(s.utc).getTime()
    const dur = getSessionDuration(s)
    const sessionProgress = Math.max(0, Math.min(1, (now - start) / dur))
    // 当前 session 起点在整个时间线中的位置 + session 内部进度
    const sessionStartPct = (start - firstSessionStart) / totalDuration
    const sessionEndPct = (start + dur - firstSessionStart) / totalDuration
    progress = (sessionStartPct + (sessionEndPct - sessionStartPct) * sessionProgress) * 100
  } else if (nextSessionIndex === 0) {
    progress = 0
  } else if (nextSessionIndex < 0) {
    progress = 100
  } else {
    // 在两个 session 之间，取前一个的结束位置
    const prevEnd = new Date(sessions[nextSessionIndex - 1].utc).getTime() + getSessionDuration(sessions[nextSessionIndex - 1])
    progress = ((prevEnd - firstSessionStart) / totalDuration) * 100
  }
  progress = Math.max(0, Math.min(100, progress))

  const isBefore = now < firstSessionStart
  const isAfter = now > lastSessionEnd

  // 为进度条计算每个 session 段的起止百分比
  const sessionSegments = sessions.map((s, i) => {
    const start = new Date(s.utc).getTime()
    const dur = getSessionDuration(s)
    const end = start + dur
    const leftPct = ((start - firstSessionStart) / totalDuration) * 100
    const widthPct = (dur / totalDuration) * 100
    const type = getSessionType(s.name)
    const colors = SESSION_COLORS[type]
    const isLive = now >= start && now <= end
    const isPast = now > end
    return { session: s, index: i, leftPct, widthPct, type, colors, isLive, isPast }
  })

  return (
    <section className="mt-4 rounded-xl border border-border bg-card p-5">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">赛程时间线</h2>
        {!isBefore && !isAfter && (
          <span className="text-[10px] font-mono text-muted-foreground tabular-nums">
            {Math.round(progress)}%
          </span>
        )}
      </div>

      {/* 分段彩色进度条 */}
      <div className="mt-3 relative">
        <div className="relative h-2.5 rounded-full bg-muted overflow-hidden">
          {/* 分段背景色 */}
          {sessionSegments.map((seg) => (
            <div
              key={seg.index}
              className="absolute h-full transition-all duration-500"
              style={{
                left: `${seg.leftPct}%`,
                width: `${seg.widthPct}%`,
                backgroundColor: seg.isPast
                  ? seg.colors.dim
                  : seg.isLive
                    ? seg.colors.live
                    : seg.colors.base,
                opacity: seg.isPast ? 0.4 : seg.isLive ? 1 : 0.6,
              }}
            />
          ))}
          {/* 已完成进度的覆盖渐变 */}
          <div
            className="absolute h-full rounded-full transition-all duration-500"
            style={{
              left: 0,
              width: `${progress}%`,
              background: "linear-gradient(90deg, rgba(255,255,255,0.15), rgba(255,255,255,0.05))",
            }}
          />
        </div>

        {/* 当前位置标记 */}
        {currentSessionIndex >= 0 && !isAfter && (
          <div
            className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 z-10"
            style={{ left: `${progress}%` }}
          >
            <div className="relative">
              <div className="absolute inset-0 animate-ping rounded-full bg-red-500/40" />
              <div className="relative flex h-4 w-4 items-center justify-center rounded-full bg-red-500 shadow-lg shadow-red-500/50 ring-2 ring-background">
                <Play className="size-2 text-white" fill="currentColor" />
              </div>
            </div>
          </div>
        )}

        {/* 下一赛段标记 */}
        {nextSessionIndex >= 0 && !isAfter && (
          <div
            className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 group"
            style={{ left: `${sessionSegments[nextSessionIndex].leftPct}%` }}
          >
            <div className="relative">
              <ChevronRight className="size-3.5 -rotate-90 text-amber-500" />
              {/* Tooltip */}
              <div className="absolute bottom-full left-1/2 mb-2 -translate-x-1/2 hidden group-hover:block whitespace-nowrap rounded-md border border-border bg-popover px-2 py-1 text-[10px] shadow-lg">
                <span className="font-medium text-foreground">{sessions[nextSessionIndex].name}</span>
                <span className="ml-1 text-muted-foreground">
                  · {formatDate(sessions[nextSessionIndex].utc, BEIJING_TZ)}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* 刻度文字 */}
        <div className="mt-2 relative h-4">
          {sessionSegments.map((seg) => {
            // 只显示部分关键刻度，避免过密
            const showLabel = sessions.length <= 6 || seg.session.isMain || seg.index === 0 || seg.index === sessions.length - 1
            if (!showLabel) return null
            return (
              <div
                key={seg.index}
                className="absolute -translate-x-1/2 text-[9px] tabular-nums transition-colors"
                style={{
                  left: `${seg.leftPct + seg.widthPct / 2}%`,
                  color: seg.isLive ? seg.colors.live : seg.isPast ? "var(--muted-foreground)" : "var(--muted-foreground)",
                  fontWeight: seg.isLive ? 700 : 400,
                  opacity: seg.isPast ? 0.5 : 1,
                }}
              >
                {seg.session.isMain ? "正赛" : seg.colors.label}
              </div>
            )
          })}
        </div>

        {/* 起止日期 */}
        <div className="mt-0.5 flex justify-between text-[10px] text-muted-foreground">
          <span>{formatDate(sessions[0].utc, BEIJING_TZ)}</span>
          <span>{formatDate(sessions[sessions.length - 1].utc, BEIJING_TZ)}</span>
        </div>

        {/* 天气时段条 */}
        <div className="mt-3 border-t border-border/50 pt-3">
          <div className="mb-1.5 text-[10px] font-medium text-muted-foreground">赛段天气</div>
          <WeatherStrip
            city={event.locality}
            country={event.country}
            lat={event.lat}
            lon={event.lon}
            sessions={sessions.map((s) => ({ utc: s.utc, name: s.name }))}
          />
        </div>
      </div>

      {/* 赛段列表 */}
      <div className="mt-4 space-y-2">
        {sessions.map((s, i) => {
          const sessionStart = new Date(s.utc).getTime()
          const sessionEnd = sessionStart + getSessionDuration(s)
          const sessionLive = now >= sessionStart && now <= sessionEnd
          const sessionPast = now > sessionEnd
          const sessionCountdown = !sessionPast && !sessionLive ? countdown(s.utc, now) : null
          const type = getSessionType(s.name)
          const colors = SESSION_COLORS[type]

          return (
            <div
              key={i}
              className={cn(
                "relative rounded-lg border p-3 transition-all",
                s.isMain
                  ? "border-primary/30 bg-primary/5"
                  : sessionPast
                  ? "border-border/50 bg-muted/30"
                  : "border-border bg-secondary/30",
                sessionLive && "border-red-500/40 bg-red-500/5"
              )}
            >
              {/* 左侧色条 */}
              <div
                className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-8 rounded-full"
                style={{ backgroundColor: sessionPast ? colors.dim : colors.base }}
              />
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {s.isMain && <span className="text-xs font-bold text-primary">正赛</span>}
                  {sessionLive && (
                    <span className="flex items-center gap-1 rounded bg-red-500/15 px-1.5 py-0.5 text-[10px] font-medium text-red-500">
                      <span className="relative flex h-1.5 w-1.5">
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
                        <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-red-500" />
                      </span>
                      LIVE
                    </span>
                  )}
                  <span className={cn("text-sm font-medium", sessionPast && "text-muted-foreground")}>
                    {s.name}
                  </span>
                  {s.tentative && (
                    <span className="text-[10px] text-amber-600">（估计）</span>
                  )}
                </div>
                <span className={cn("text-xs text-muted-foreground", sessionLive && "text-red-500 font-medium")}>
                  {sessionLive
                    ? "进行中"
                    : sessionPast
                    ? "已结束"
                    : sessionCountdown && sessionCountdown.days === 0 && sessionCountdown.hours === 0 && sessionCountdown.minutes < 60
                    ? "即将开始"
                    : "未开始"}
                </span>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-muted-foreground">北京</span>
                  <span className="ml-1 font-mono tabular-nums">{formatDateTime(s.utc, BEIJING_TZ)}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">当地</span>
                  <span className="ml-1 font-mono tabular-nums">{formatDateTime(s.utc, event.tz)}</span>
                </div>
              </div>
              {sessionCountdown && !sessionPast && !sessionLive && sessionCountdown.days === 0 && sessionCountdown.hours === 0 && sessionCountdown.minutes < 60 && (
                <div className="mt-2 flex items-center gap-1 rounded bg-amber-500/10 px-2 py-1 text-xs text-amber-600">
                  <Clock className="size-3" />
                  {sessionCountdown.minutes}分 {sessionCountdown.seconds}秒后开始
                </div>
              )}
            </div>
          )
        })}
      </div>
    </section>
  )
}
