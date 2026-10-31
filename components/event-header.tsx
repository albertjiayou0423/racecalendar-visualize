"use client"


import { RoundArrival } from "./ritual-motion"
import { downloadFile } from "@/lib/download"
import { isTimeUnconfirmed } from "@/lib/session-time"

import { Bell, Calendar, Clock, MapPin } from "lucide-react"
import type { RaceEvent } from "@/lib/types"
import { BEIJING_TZ, SERIES_META, countdown, formatDate, formatDateTime, isLive, isPast, mainSession } from "@/lib/format"
import { cn } from "@/lib/utils"

interface EventHeaderProps {
  event: RaceEvent
  now: number
  onSetNotification: () => void
}

export function EventHeader({ event, now, onSetNotification }: EventHeaderProps) {
  const meta = SERIES_META[event.series]
  const main = mainSession(event)
  const live = isLive(event, now)
  const past = isPast(event, now)
  const status = live ? "进行中" : past ? "已结束" : "即将开始"
  const estimated = !!main && isTimeUnconfirmed(event, main)
  const mainCountdown = main && !estimated ? countdown(main.utc, now) : null

  const downloadCalendar = () => {
    if (!main || estimated) return
    if (!Number.isFinite(Date.parse(main.utc))) return
    const params = new URLSearchParams({ id: event.id, series: event.series, round: String(event.round),
      name: event.name, circuit: event.circuit, locality: event.locality, country: event.country, utc: main.utc })
    downloadFile(`/api/calendar?${params}`, `${event.id}.ics`)
  }

  return (
    <section className="relative overflow-hidden rounded-2xl border border-border bg-card p-5">
      <div className="absolute inset-x-0 top-0 h-1" style={{ backgroundColor: live ? "#ef4444" : meta.color }} />

      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className="rounded-full px-2 py-0.5 text-xs font-bold"
              style={{ backgroundColor: live ? "#ef4444" : meta.color, color: "#fff" }}
            >
              {live ? "LIVE" : meta.label}
            </span>
            <span className="rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground">
              第 <RoundArrival key={event.id} round={event.round} /> 站
            </span>
          </div>
          <h1 className="mt-3 text-xl font-bold">{event.name}</h1>
          <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
            <MapPin className="size-4" />
            {event.circuit} · {event.locality}，{event.country}
          </p>
        </div>
        <span
          className={cn(
            "shrink-0 rounded-full px-3 py-1 text-xs font-medium",
            live
              ? "bg-red-500/15 text-red-500"
              : past
              ? "bg-muted text-muted-foreground"
              : "bg-primary/15 text-primary"
          )}
        >
          {status}
        </span>
      </div>

      {main && (
        <div className="mt-5 rounded-lg bg-secondary/50 p-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Clock className="size-4" />
            <span>{estimated ? "比赛日期 · 当地" : "正赛时间"}</span>
            {estimated && <span className="text-amber-600">（时间待确认）</span>}
          </div>
          <div className="mt-2 flex flex-wrap items-baseline gap-4">
            {estimated ? (
              <div>
                <div className="text-xs text-muted-foreground">赛事日期</div>
                <div className="text-lg font-bold font-mono tabular-nums">{formatDate(main.utc, event.tz)}</div>
              </div>
            ) : (
              <>
                <div>
                  <div className="text-xs text-muted-foreground">北京时间</div>
                  <div className="text-lg font-bold font-mono tabular-nums">{formatDateTime(main.utc, BEIJING_TZ)}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">当地时间</div>
                  <div className="text-lg font-bold font-mono tabular-nums">{formatDateTime(main.utc, event.tz)}</div>
                </div>
              </>
            )}
          </div>
          {!past && mainCountdown && (
            <div className="mt-3 flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1.5">
              {live ? (
                <>
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500" />
                  </span>
                  <span className="text-sm font-medium text-red-500">赛事进行中</span>
                </>
              ) : (
                <>
                  <Clock className="size-4 text-primary" />
                  <span className="text-sm font-semibold tabular-nums">
                    {mainCountdown.days > 0 ? `${mainCountdown.days}天 ` : ""}
                    {mainCountdown.hours}时 {mainCountdown.minutes}分 {mainCountdown.seconds}秒
                  </span>
                </>
              )}
            </div>
          )}
        </div>
      )}

      <div className="mt-5 flex gap-3">
        <button
          data-guide="reminder" onClick={onSetNotification}
          disabled={estimated}
          title={estimated ? "赛段时间待确认后可设置提醒" : undefined}
          className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Bell className="size-4" />
          设置正赛提醒
        </button>
        <button
          data-guide="calendar" onClick={downloadCalendar}
          className={cn(
            "flex items-center justify-center gap-2 rounded-lg border border-border px-4 py-2.5 text-sm font-medium transition-colors",
            main && !estimated ? "hover:bg-secondary" : "opacity-50 cursor-not-allowed"
          )}
          disabled={!main || estimated}
        >
          <Calendar className="size-4" />
          加入日历
        </button>
      </div>
    </section>
  )
}
