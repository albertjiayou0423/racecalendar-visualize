"use client"

import { useMemo } from "react"
import { Clock, Play, CheckCircle2 } from "lucide-react"
import type { RaceEvent, RaceSession } from "@/lib/types"
import { BEIJING_TZ, countdown, formatTime } from "@/lib/format"
import { cn } from "@/lib/utils"

interface MultiSessionCountdownProps {
  event: RaceEvent
  now: number
}

type SessionState = "upcoming" | "live" | "past"

function getSessionState(session: RaceSession, now: number): SessionState {
  const start = new Date(session.utc).getTime()
  const end = start + 2 * 60 * 60 * 1000
  if (now < start) return "upcoming"
  if (now >= start && now <= end) return "live"
  return "past"
}

/**
 * 多场次联动倒计时：
 * - 顶部横向时间轴（移动端可横向滚动），自动聚焦当前/下一场
 * - 下方场次列表：移动端 1 列，桌面端 2 列
 * - 每场显示倒计时（≤30 分钟显示分秒）或状态标签
 */
export function MultiSessionCountdown({ event, now }: MultiSessionCountdownProps) {
  const sessions = useMemo(() => {
    return event.sessions.map((s, i) => {
      const state = getSessionState(s, now)
      const c = state === "upcoming" ? countdown(s.utc, now) : null
      const isUrgent = c && c.days === 0 && c.hours === 0 && c.minutes < 30
      return { session: s, index: i, state, countdown: c, isUrgent }
    })
  }, [event.sessions, now])

  const focusIndex = useMemo(() => {
    const liveIdx = sessions.findIndex((s) => s.state === "live")
    if (liveIdx >= 0) return liveIdx
    const nextIdx = sessions.findIndex((s) => s.state === "upcoming")
    return nextIdx >= 0 ? nextIdx : -1
  }, [sessions])

  if (event.sessions.length <= 1) return null

  return (
    <section className="rounded-2xl border border-border bg-card p-4 sm:p-5">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold sm:text-base">赛程时间轴</h2>
        <span className="text-[11px] text-muted-foreground">
          共 {event.sessions.length} 场
        </span>
      </div>

      {/* 横向时间轴：移动端可横向滚动 */}
      <div className="mt-3 overflow-x-auto pb-2 [scrollbar-width:thin]">
        <div className="flex min-w-max items-center gap-1.5">
          {sessions.map((s, i) => (
            <div key={i} className="flex items-center">
              <div
                className={cn(
                  "flex flex-col items-center gap-1 rounded-lg px-2 py-1.5 transition-colors",
                  i === focusIndex && "bg-secondary/60",
                )}
              >
                <span className="relative flex size-2.5 items-center justify-center">
                  {s.state === "live" && (
                    <span className="absolute size-2.5 animate-ping rounded-full bg-red-400 opacity-75" />
                  )}
                  <span
                    className={cn(
                      "relative size-2.5 rounded-full transition-colors",
                      s.state === "live" && "bg-red-500",
                      s.state === "past" && "bg-muted-foreground/40",
                      s.state === "upcoming" && i === focusIndex && "bg-primary",
                      s.state === "upcoming" && i !== focusIndex && "border border-border bg-transparent",
                    )}
                  />
                </span>
                <span
                  className={cn(
                    "whitespace-nowrap text-[10px] tabular-nums",
                    i === focusIndex ? "font-semibold text-foreground" : "text-muted-foreground",
                  )}
                >
                  {formatTime(s.session.utc, BEIJING_TZ)}
                </span>
              </div>
              {i < sessions.length - 1 && (
                <div
                  className={cn(
                    "h-0.5 w-5 sm:w-8",
                    s.state === "past" ? "bg-muted-foreground/40" : "bg-border",
                  )}
                />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* 场次列表：移动端 1 列，桌面端 2 列 */}
      <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
        {sessions.map((s) => (
          <SessionRow
            key={s.index}
            session={s.session}
            state={s.state}
            c={s.countdown}
            isUrgent={!!s.isUrgent}
            isFocus={s.index === focusIndex}
          />
        ))}
      </div>
    </section>
  )
}

function SessionRow({
  session,
  state,
  c,
  isUrgent,
  isFocus,
}: {
  session: RaceSession
  state: SessionState
  c: ReturnType<typeof countdown> | null
  isUrgent: boolean
  isFocus: boolean
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-2 rounded-lg border p-2.5 transition-colors",
        state === "live" && "border-red-500/40 bg-red-500/5",
        state === "past" && "border-border/50 bg-muted/20 opacity-70",
        state === "upcoming" && isFocus && "border-primary/30 bg-primary/5",
        state === "upcoming" && !isFocus && "border-border bg-secondary/20",
      )}
    >
      <div className="flex min-w-0 flex-1 items-center gap-2">
        {state === "live" ? (
          <Play className="size-3.5 shrink-0 fill-red-500 text-red-500" />
        ) : state === "past" ? (
          <CheckCircle2 className="size-3.5 shrink-0 text-muted-foreground" />
        ) : (
          <Clock className={cn("size-3.5 shrink-0", isUrgent ? "text-red-500" : "text-muted-foreground")} />
        )}
        <div className="min-w-0">
          <div className={cn("truncate text-xs font-medium", state === "past" && "text-muted-foreground")}>
            {session.name}
            {session.isMain && <span className="ml-1 text-[10px] text-primary">正赛</span>}
          </div>
          <div className="text-[10px] tabular-nums text-muted-foreground">
            {formatTime(session.utc, BEIJING_TZ)}
          </div>
        </div>
      </div>
      <div className="shrink-0 text-right">
        {state === "live" ? (
          <span className="text-[10px] font-bold text-red-500">进行中</span>
        ) : state === "past" ? (
          <span className="text-[10px] text-muted-foreground">已结束</span>
        ) : c && isUrgent ? (
          <span className="text-[10px] font-semibold tabular-nums text-red-500">
            {c.minutes}分{c.seconds}秒
          </span>
        ) : c ? (
          <span className="text-[10px] tabular-nums text-muted-foreground">
            {c.days > 0 ? `${c.days}天` : `${c.hours}时${c.minutes}分`}
          </span>
        ) : null}
      </div>
    </div>
  )
}
