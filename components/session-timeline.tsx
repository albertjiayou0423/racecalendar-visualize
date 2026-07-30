"use client"

import { useRef, useEffect } from "react"
import { Clock } from "lucide-react"
import type { RaceEvent, RaceSession } from "@/lib/types"
import { BEIJING_TZ, countdown, formatDateTime, formatDate, formatTime } from "@/lib/format"
import { cn } from "@/lib/utils"
import { WeatherStrip } from "@/components/weather-strip"

interface SessionTimelineProps {
  event: RaceEvent
  now: number
}

/** 每个赛段的假定持续时长（毫秒），用于进度计算 */
const SESSION_DURATION_MS: Record<string, number> = {
  race: 2 * 60 * 60 * 1000,
  sprint: 1 * 60 * 60 * 1000,
  quali: 1 * 60 * 60 * 1000,
  practice: 1 * 60 * 60 * 1000,
  default: 1.5 * 60 * 60 * 1000,
}

function getSessionType(name: string): "practice" | "quali" | "sprint" | "race" {
  const lower = name.toLowerCase()
  if (lower.includes("race") || lower.includes("正赛") || lower.includes("决赛")) return "race"
  if (lower.includes("sprint") || lower.includes("冲刺")) return "sprint"
  if (lower.includes("qual") || lower.includes("排位")) return "quali"
  return "practice"
}

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
  const stripRef = useRef<HTMLDivElement>(null)

  const sessions = event.sessions
  const hasSessions = sessions.length > 0

  // 所有计算在 early return 之前完成，确保 hooks 顺序一致
  const firstSessionStart = hasSessions
    ? Math.min(...sessions.map((s) => new Date(s.utc).getTime()))
    : 0
  const lastSessionEnd = hasSessions
    ? Math.max(...sessions.map((s) => new Date(s.utc).getTime() + getSessionDuration(s)))
    : 0
  const totalDuration = lastSessionEnd - firstSessionStart

  const currentSessionIndex = hasSessions
    ? sessions.findIndex((s) => {
        const start = new Date(s.utc).getTime()
        const end = start + getSessionDuration(s)
        return now >= start && now <= end
      })
    : -1

  const nextSessionIndex = hasSessions
    ? sessions.findIndex((s) => new Date(s.utc).getTime() > now)
    : -1

  let progress = 0
  if (hasSessions) {
    if (currentSessionIndex >= 0) {
      const s = sessions[currentSessionIndex]
      const start = new Date(s.utc).getTime()
      const dur = getSessionDuration(s)
      const sessionProgress = Math.max(0, Math.min(1, (now - start) / dur))
      const sessionStartPct = (start - firstSessionStart) / totalDuration
      const sessionEndPct = (start + dur - firstSessionStart) / totalDuration
      progress = (sessionStartPct + (sessionEndPct - sessionStartPct) * sessionProgress) * 100
    } else if (nextSessionIndex === 0) {
      progress = 0
    } else if (nextSessionIndex < 0) {
      progress = 100
    } else {
      const prevEnd = new Date(sessions[nextSessionIndex - 1].utc).getTime() + getSessionDuration(sessions[nextSessionIndex - 1])
      progress = ((prevEnd - firstSessionStart) / totalDuration) * 100
    }
    progress = Math.max(0, Math.min(100, progress))
  }

  const isBefore = hasSessions && now < firstSessionStart
  const isAfter = hasSessions && now > lastSessionEnd

  const centerIdx = currentSessionIndex >= 0
    ? currentSessionIndex
    : nextSessionIndex >= 0
      ? nextSessionIndex
      : hasSessions
        ? sessions.length - 1
        : 0

  const sessionSegments = hasSessions
    ? sessions.map((s, i) => {
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
    : []

  // 自动滚动赛段条，居中显示当前/下一个赛段
  useEffect(() => {
    if (!hasSessions) return
    const container = stripRef.current
    if (!container) return
    const target = container.children[centerIdx] as HTMLElement
    if (target) {
      container.scrollTo({
        left: target.offsetLeft - container.offsetWidth / 2 + target.offsetWidth / 2,
        behavior: "smooth",
      })
    }
  }, [hasSessions, centerIdx])

  if (!hasSessions) return null

  return (
    <section className="mt-4 rounded-xl border border-border bg-card p-5">
      {/* 标题 + 进度百分比 */}
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">赛程时间线</h2>
        {!isBefore && !isAfter && (
          <span className="text-[10px] font-mono text-muted-foreground tabular-nums" aria-live="polite">
            {Math.round(progress)}%
          </span>
        )}
      </div>

      {/* 进度条 — 干净无拥挤标签 */}
      <div className="mt-3">
        <div className="relative">
          {/* 轨道 */}
          <div className="relative h-3 rounded-full bg-muted overflow-hidden">
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
                  opacity: seg.isPast ? 0.25 : seg.isLive ? 1 : 0.45,
                }}
              />
            ))}
            {/* 已完成进度覆盖渐变 */}
            <div
              className="absolute h-full rounded-full transition-all duration-1000 ease-linear"
              style={{
                left: 0,
                width: `${progress}%`,
                background: "linear-gradient(90deg, rgba(255,255,255,0.22), rgba(255,255,255,0.06))",
                boxShadow: "inset 0 0 8px rgba(255,255,255,0.12)",
              }}
            />
          </div>

          {/* 平滑移动的位置指示器 */}
          {!isBefore && !isAfter && (
            <div
              className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 z-10 transition-all duration-1000 ease-linear"
              style={{ left: `${progress}%` }}
            >
              <div className="relative">
                <div className="absolute inset-0 animate-ping rounded-full bg-red-500/40" />
                <div className="relative h-3.5 w-3.5 rounded-full bg-red-500 ring-2 ring-background shadow-lg shadow-red-500/50" />
              </div>
            </div>
          )}
        </div>

        {/* 起止日期 */}
        <div className="mt-1.5 flex justify-between text-[10px] text-muted-foreground">
          <span>{formatDate(sessions[0].utc, BEIJING_TZ)}</span>
          <span>{formatDate(sessions[sessions.length - 1].utc, BEIJING_TZ)}</span>
        </div>
      </div>

      {/* 横向滑动赛段条 — 自动居中当前赛段 */}
      <div className="mt-4">
        <div className="mb-2 text-[10px] font-medium text-muted-foreground">赛段进度</div>
        <div className="relative">
          {/* 左侧渐隐 */}
          <div className="pointer-events-none absolute left-0 top-0 bottom-2 z-10 w-6 rounded-l bg-gradient-to-r from-card to-transparent" />
          {/* 右侧渐隐 */}
          <div className="pointer-events-none absolute right-0 top-0 bottom-2 z-10 w-6 rounded-r bg-gradient-to-l from-card to-transparent" />

          <div
            ref={stripRef}
            className="flex gap-2 overflow-x-auto pb-2"
            style={{ scrollbarWidth: "thin" }}
          >
            {sessions.map((s, i) => {
              const sessionStart = new Date(s.utc).getTime()
              const sessionEnd = sessionStart + getSessionDuration(s)
              const sessionLive = now >= sessionStart && now <= sessionEnd
              const sessionPast = now > sessionEnd
              const sessionCountdown = !sessionPast && !sessionLive ? countdown(s.utc, now) : null
              const type = getSessionType(s.name)
              const colors = SESSION_COLORS[type]
              const isCurrent = i === centerIdx

              return (
                <div
                  key={i}
                  className={cn(
                    "flex-shrink-0 w-[136px] rounded-lg border p-2.5 transition-all duration-300",
                    sessionLive
                      ? "border-red-500/50 bg-red-500/[0.07] shadow-md shadow-red-500/10"
                      : sessionPast
                        ? "border-border/30 bg-muted/10 opacity-45"
                        : isCurrent
                          ? "border-amber-500/40 bg-amber-500/[0.05] ring-1 ring-amber-500/20"
                          : "border-border/50 bg-secondary/10"
                  )}
                >
                  {/* 色条 + 名称 */}
                  <div className="flex items-center gap-1.5">
                    <div
                      className="h-3 w-1 rounded-full shrink-0"
                      style={{ backgroundColor: colors.base, opacity: sessionPast ? 0.4 : 1 }}
                    />
                    <span
                      className="text-[11px] font-medium truncate"
                      title={s.name}
                    >
                      {s.name}
                    </span>
                  </div>

                  {/* 状态 */}
                  <div className="mt-1.5 min-h-[14px]">
                    {sessionLive ? (
                      <span className="flex items-center gap-1 text-[10px] font-medium text-red-500">
                        <span className="relative flex h-1.5 w-1.5">
                          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
                          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-red-500" />
                        </span>
                        LIVE
                      </span>
                    ) : sessionPast ? (
                      <span className="text-[10px] text-muted-foreground">已结束</span>
                    ) : sessionCountdown && sessionCountdown.days === 0 && sessionCountdown.hours === 0 && sessionCountdown.minutes < 60 ? (
                      <span className="text-[10px] font-medium text-amber-500">
                        {sessionCountdown.minutes}分{sessionCountdown.seconds}秒后
                      </span>
                    ) : sessionCountdown && sessionCountdown.days > 0 ? (
                      <span className="text-[10px] text-muted-foreground">{sessionCountdown.days}天后</span>
                    ) : sessionCountdown ? (
                      <span className="text-[10px] text-muted-foreground">{sessionCountdown.hours}时后</span>
                    ) : (
                      <span className="text-[10px] text-muted-foreground">未开始</span>
                    )}
                  </div>

                  {/* 时间 */}
                  <div className="mt-1 font-mono text-[10px] tabular-nums text-muted-foreground">
                    {formatTime(s.utc, BEIJING_TZ)}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
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

      {/* 详细赛段列表 */}
      <div className="mt-4 space-y-1.5">
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
                "relative rounded-lg border transition-all",
                s.isMain
                  ? "border-primary/40 bg-primary/[0.07]"
                  : sessionPast
                  ? "border-border/40 bg-muted/20"
                  : "border-border/60 bg-secondary/20",
                sessionLive && "border-red-500/50 bg-red-500/[0.07]",
                "hover:bg-secondary/30"
              )}
            >
              <div
                className={cn(
                  "absolute left-0 top-2 bottom-2 w-1 rounded-full transition-opacity",
                  sessionPast && "opacity-40"
                )}
                style={{ backgroundColor: colors.base }}
              />
              <div className="px-3 py-2.5 pl-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 min-w-0">
                    {s.isMain && (
                      <span className="shrink-0 rounded bg-primary/20 px-1.5 py-0.5 text-[10px] font-bold text-primary">
                        正赛
                      </span>
                    )}
                    {sessionLive && (
                      <span className="shrink-0 flex items-center gap-1 rounded bg-red-500/15 px-1.5 py-0.5 text-[10px] font-medium text-red-500">
                        <span className="relative flex h-1.5 w-1.5">
                          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
                          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-red-500" />
                        </span>
                        LIVE
                      </span>
                    )}
                    <span className={cn(
                      "text-sm font-medium truncate",
                      sessionPast ? "text-muted-foreground" : "text-foreground"
                    )}>
                      {s.name}
                    </span>
                    {s.tentative && (
                      <span className="shrink-0 text-[10px] text-amber-500">（估计）</span>
                    )}
                  </div>
                  <span className={cn(
                    "shrink-0 text-[11px]",
                    sessionLive ? "text-red-500 font-medium" : "text-muted-foreground"
                  )}>
                    {sessionLive
                      ? "进行中"
                      : sessionPast
                      ? "已结束"
                      : sessionCountdown && sessionCountdown.days === 0 && sessionCountdown.hours === 0 && sessionCountdown.minutes < 60
                      ? "即将开始"
                      : "未开始"}
                  </span>
                </div>
                <div className="mt-1.5 flex items-center gap-4 text-[11px] text-muted-foreground">
                  <span className="font-mono tabular-nums">
                    {formatDateTime(s.utc, BEIJING_TZ)}
                    <span className="ml-1 text-[10px]">北京</span>
                  </span>
                  {event.tz !== BEIJING_TZ && (
                    <span className="font-mono tabular-nums opacity-70">
                      {formatDateTime(s.utc, event.tz)}
                      <span className="ml-1 text-[10px]">当地</span>
                    </span>
                  )}
                </div>
                {sessionCountdown && !sessionPast && !sessionLive && sessionCountdown.days === 0 && sessionCountdown.hours === 0 && sessionCountdown.minutes < 60 && (
                  <div className="mt-2 flex items-center gap-1 rounded bg-amber-500/10 px-2 py-1 text-[11px] text-amber-600">
                    <Clock className="size-3" />
                    {sessionCountdown.minutes}分 {sessionCountdown.seconds}秒后开始
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}
