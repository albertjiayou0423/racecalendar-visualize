"use client"

import { useState } from "react"
import { ChevronDown, MapPin, Radio, Trophy, TriangleAlert } from "lucide-react"
import type { RaceEvent } from "@/lib/types"
import {
  BEIJING_TZ,
  SERIES_META,
  countdown,
  firstSession,
  formatDate,
  formatDateTime,
  formatTime,
  mainSession,
  offsetLabel,
} from "@/lib/format"
import { countryCodeToFlag } from "@/lib/tz"
import { cn } from "@/lib/utils"

function CountdownPill({ utc, now }: { utc: string; now: number }) {
  const c = countdown(utc, now)
  if (c.past) {
    return (
      <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
        已结束
      </span>
    )
  }
  const soon = c.days === 0
  return (
    <span
      className={cn(
        "rounded-full px-2.5 py-1 text-xs font-semibold tabular-nums",
        soon ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground",
      )}
    >
      {c.days > 0 ? `${c.days}天 ` : ""}
      {c.hours}时 {c.minutes}分{c.days === 0 ? ` ${c.seconds}秒` : ""}后
    </span>
  )
}

export function EventCard({ event, now }: { event: RaceEvent; now: number }) {
  const [open, setOpen] = useState(false)
  const meta = SERIES_META[event.series]
  const main = mainSession(event)
  const first = firstSession(event)
  const flag = countryCodeToFlag(event.countryCode)
  const localOffset = main ? offsetLabel(main.utc, event.tz) : ""

  return (
    <article className="overflow-hidden rounded-xl border border-border bg-card transition-colors hover:border-muted-foreground/30">
      <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:gap-5">
        {/* 系列 + 轮次 */}
        <div className="flex items-center gap-3 sm:w-28 sm:shrink-0">
          <span
            className="inline-flex h-11 w-11 items-center justify-center rounded-lg text-sm font-bold"
            style={{ backgroundColor: meta.color, color: meta.textColor }}
          >
            {meta.label}
          </span>
          <span className="text-xs text-muted-foreground">第 {event.round} 站</span>
        </div>

        {/* 名称与地点 */}
        <div className="min-w-0 flex-1">
          <h3 className="flex items-center gap-2 text-balance text-base font-semibold leading-tight">
            {flag ? <span aria-hidden>{flag}</span> : null}
            <span className="truncate">{event.name}</span>
          </h3>
          <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
            <MapPin className="size-3.5 shrink-0" aria-hidden />
            <span className="truncate">
              {event.circuit} · {event.locality}，{event.country}
            </span>
          </p>
        </div>

        {/* 主赛事北京时间 + 倒计时 */}
        <div className="flex items-center justify-between gap-3 sm:w-56 sm:shrink-0 sm:flex-col sm:items-end">
          {main ? (
            <div className="text-right">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Trophy className="size-3.5" aria-hidden />
                <span>主赛事 · 北京时间</span>
              </div>
              <div className="font-mono text-sm font-semibold tabular-nums">
                {formatDateTime(main.utc, BEIJING_TZ)}
              </div>
            </div>
          ) : (
            <span className="text-sm text-muted-foreground">赛程待定</span>
          )}
          {main ? <CountdownPill utc={main.utc} now={now} /> : null}
        </div>
      </div>

      {/* 转播条 + 展开按钮 */}
      <div className="flex items-center justify-between gap-3 border-t border-border bg-secondary/30 px-4 py-2.5">
        {event.broadcaster ? (
          <div className="flex min-w-0 items-center gap-2 text-xs">
            <Radio className="size-3.5 shrink-0 text-primary" aria-hidden />
            <span className="font-medium">{event.broadcaster.name}</span>
            {event.broadcaster.note ? (
              <span className="truncate text-muted-foreground">{event.broadcaster.note}</span>
            ) : null}
          </div>
        ) : (
          <span className="text-xs text-muted-foreground">转播信息待确认</span>
        )}
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          aria-expanded={open}
        >
          {open ? "收起" : "详细时间"}
          <ChevronDown className={cn("size-4 transition-transform", open && "rotate-180")} aria-hidden />
        </button>
      </div>

      {/* 详细场次时间表 */}
      {open ? (
        <div className="border-t border-border">
          <div className="grid grid-cols-[1fr_auto_auto] items-center gap-x-4 px-4 py-2 text-[11px] uppercase tracking-wide text-muted-foreground">
            <span>场次</span>
            <span className="text-right">当地时间 · {localOffset}</span>
            <span className="text-right">北京时间 · UTC+8</span>
          </div>
          <ul>
            {event.sessions.map((s, i) => (
              <li
                key={`${s.name}-${i}`}
                className={cn(
                  "grid grid-cols-[1fr_auto_auto] items-center gap-x-4 border-t border-border/60 px-4 py-2.5 text-sm",
                  s.isMain && "bg-primary/10",
                )}
              >
                <span className="flex items-center gap-1.5">
                  {s.isMain ? <Trophy className="size-3.5 text-primary" aria-hidden /> : null}
                  <span className={cn(s.isMain && "font-semibold")}>{s.name}</span>
                  {s.tentative ? (
                    <TriangleAlert className="size-3 text-muted-foreground" aria-label="时间待确认" />
                  ) : null}
                </span>
                <span className="text-right font-mono tabular-nums">
                  <span className="block text-xs text-muted-foreground">
                    {formatDate(s.utc, event.tz)}
                  </span>
                  {s.tentative ? "约 " : ""}
                  {formatTime(s.utc, event.tz)}
                </span>
                <span className="text-right font-mono font-medium tabular-nums text-foreground">
                  <span className="block text-xs text-muted-foreground">
                    {formatDate(s.utc, BEIJING_TZ)}
                  </span>
                  {s.tentative ? "约 " : ""}
                  {formatTime(s.utc, BEIJING_TZ)}
                </span>
              </li>
            ))}
          </ul>
          <p className="px-4 py-2 text-[11px] text-muted-foreground">
            首个场次：{first ? formatDateTime(first.utc, BEIJING_TZ) : "—"}（北京时间）
          </p>
        </div>
      ) : null}
    </article>
  )
}
