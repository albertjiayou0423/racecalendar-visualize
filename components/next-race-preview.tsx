"use client"

import { useState, useEffect } from "react"
import { Clock, MapPin, Calendar, Trophy } from "lucide-react"
import type { RaceEvent } from "@/lib/types"
import { firstSession, formatDateTime, formatTime, SERIES_META } from "@/lib/format"
import { BEIJING_TZ } from "@/lib/format"

interface NextRacePreviewProps {
  event: RaceEvent
}

export function NextRacePreview({ event }: NextRacePreviewProps) {
  const first = firstSession(event)
  const meta = SERIES_META[event.series]

  return (
    <section
      className="relative overflow-hidden rounded-2xl border border-border bg-card p-5 sm:p-6"
      aria-label="下一站预览"
    >
      <div
        className="absolute inset-x-0 top-0 h-1"
        style={{ backgroundColor: meta.color }}
        aria-hidden
      />
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <span
          className="rounded px-2 py-0.5 font-bold"
          style={{ backgroundColor: meta.color, color: meta.textColor }}
        >
          {meta.label}
        </span>
        <span>{meta.full}</span>
        <span>·</span>
        <span>第 {event.round} 轮</span>
        <span>·</span>
        <span>下一站</span>
      </div>

      <h2 className="mt-3 text-pretty text-xl font-bold leading-tight sm:text-2xl">
        {event.name}
      </h2>

      <div className="mt-2 flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <MapPin className="size-4" />
          <span>{event.circuit}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Calendar className="size-4" />
          <span>
            {event.locality}，{event.country}
          </span>
        </div>
      </div>

      {first ? (
        <div className="mt-4 rounded-xl bg-muted/30 p-4">
          <div className="text-xs text-muted-foreground">距开赛</div>
          <div className="mt-1 font-mono text-2xl font-bold tabular-nums">
            <Countdown targetTime={first.utc} />
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            {formatDateTime(first.utc, BEIJING_TZ)} 北京时间
          </div>
        </div>
      ) : null}

      <div className="mt-4">
        <div className="text-xs font-medium text-muted-foreground mb-2">赛程安排</div>
        <div className="space-y-1.5">
          {event.sessions.slice(0, 6).map((session, idx) => {
            const sessionPast = new Date(session.utc).getTime() < Date.now()
            return (
              <div
                key={idx}
                className={`flex items-center justify-between rounded-lg px-3 py-2 text-sm ${
                  sessionPast ? "opacity-50" : ""
                }`}
              >
                <div className="flex items-center gap-2">
                  {session.isMain ? (
                    <Trophy className="size-3.5 text-primary" />
                  ) : (
                    <Clock className="size-3.5 text-muted-foreground" />
                  )}
                  <span className="font-medium">{session.name}</span>
                </div>
                <div className="font-mono text-xs tabular-nums text-muted-foreground">
                  {formatTime(session.utc, BEIJING_TZ)}
                </div>
              </div>
            )
          })}
          {event.sessions.length > 6 && (
            <div className="text-center text-xs text-muted-foreground pt-1">
              还有 {event.sessions.length - 6} 场...
            </div>
          )}
        </div>
      </div>
    </section>
  )
}

function Countdown({ targetTime }: { targetTime: string }) {
  const [now, setNow] = useState(Date.now())

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [])

  const diff = Math.max(0, new Date(targetTime).getTime() - now)
  const days = Math.floor(diff / (1000 * 60 * 60 * 24))
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
  const seconds = Math.floor((diff % (1000 * 60)) / 1000)

  return (
    <span>
      {days > 0 && `${days}天 `}
      {String(hours).padStart(2, "0")}:{String(minutes).padStart(2, "0")}:
      {String(seconds).padStart(2, "0")}
    </span>
  )
}
