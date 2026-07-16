"use client"

import { Clock } from "lucide-react"
import type { RaceEvent } from "@/lib/types"
import { BEIJING_TZ, countdown, formatDateTime } from "@/lib/format"
import { cn } from "@/lib/utils"

interface SessionTimelineProps {
  event: RaceEvent
  now: number
}

export function SessionTimeline({ event, now }: SessionTimelineProps) {
  return (
    <section className="mt-4 rounded-xl border border-border bg-card p-5">
      <h2 className="text-sm font-semibold">赛程时间线</h2>
      <div className="mt-3 space-y-2">
        {event.sessions.map((s, i) => {
          const sessionStart = new Date(s.utc).getTime()
          const sessionEnd = sessionStart + 2 * 60 * 60 * 1000
          const sessionLive = now >= sessionStart && now <= sessionEnd
          const sessionPast = now > sessionEnd
          const sessionCountdown = !sessionPast && !sessionLive ? countdown(s.utc, now) : null

          return (
            <div
              key={i}
              className={cn(
                "rounded-lg border p-3 transition-colors",
                s.isMain
                  ? "border-primary/30 bg-primary/5"
                  : sessionPast
                  ? "border-border/50 bg-muted/30"
                  : "border-border bg-secondary/30",
                sessionLive && "border-red-500/30 bg-red-500/5"
              )}
            >
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
                <span className={cn("text-xs text-muted-foreground", sessionLive && "text-red-500")}>
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