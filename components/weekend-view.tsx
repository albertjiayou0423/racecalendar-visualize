"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { ChevronLeft, ChevronRight, Clock3, MapPin, Trophy } from "lucide-react"
import type { RaceEvent, RaceSession } from "@/lib/types"
import { BEIJING_TZ, SERIES_META, formatTime } from "@/lib/format"
import { isTimeUnconfirmed } from "@/lib/session-time"
import { cn } from "@/lib/utils"
import "./weekend-view.css"

type Weekend = { event: RaceEvent; sessions: RaceSession[]; start: number; end: number }

function dateKey(utc: string) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: BEIJING_TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(utc))
}

function formatDay(key: string) {
  const [year, month, day] = key.split("-").map(Number)
  return new Intl.DateTimeFormat("zh-CN", { timeZone: BEIJING_TZ, month: "long", day: "numeric", weekday: "long" }).format(new Date(Date.UTC(year, month - 1, day, 12)))
}

function localTime(utc: string, zone: string) {
  try { return formatTime(utc, zone) } catch { return null }
}

function buildWeekends(events: RaceEvent[]): Weekend[] {
  return events.flatMap(event => {
    const sessions = event.sessions
      .filter(session => Number.isFinite(Date.parse(session.utc)))
      .sort((a, b) => Date.parse(a.utc) - Date.parse(b.utc))
    if (!sessions.length) return []
    const starts = sessions.map(session => Date.parse(session.utc))
    return [{ event, sessions, start: starts[0], end: starts[starts.length - 1] + 2 * 60 * 60 * 1000 }]
  }).sort((a, b) => a.start - b.start)
}

function nearestIndex(weekends: Weekend[], now: number) {
  const live = weekends.findIndex(item => item.start <= now && item.end >= now)
  if (live >= 0) return live
  const next = weekends.findIndex(item => item.start > now)
  return next >= 0 ? next : Math.max(0, weekends.length - 1)
}

export function WeekendView({ events, now, variant = "default" }: { events: RaceEvent[]; now: number; variant?: "default" | "simple" }) {
  const weekends = useMemo(() => buildWeekends(events), [events])
  const nearest = nearestIndex(weekends, now)
  const [selectedId, setSelectedId] = useState(() => weekends[nearest]?.event.id ?? "")

  useEffect(() => {
    if (!weekends.some(item => item.event.id === selectedId)) setSelectedId(weekends[nearest]?.event.id ?? "")
  }, [weekends, nearest, selectedId])

  const index = weekends.findIndex(item => item.event.id === selectedId)
  const weekend = weekends[index]
  const dayGroups = useMemo(() => {
    const grouped = new Map<string, RaceSession[]>()
    if (weekend) for (const session of weekend.sessions) {
      const key = dateKey(session.utc)
      const group = grouped.get(key) ?? []
      group.push(session)
      grouped.set(key, group)
    }
    return [...grouped.entries()]
  }, [weekend])

  const move = (direction: -1 | 1) => {
    const next = weekends[index + direction]
    if (next) setSelectedId(next.event.id)
  }

  if (!weekend) return <section className={"weekend-view" + (variant === "simple" ? " simple-weekend" : "")} aria-label="比赛周末视图"><p className="weekend-empty">当前筛选下没有包含有效场次时间的赛事。</p></section>

  const meta = SERIES_META[weekend.event.series]
  const firstDate = dayGroups[0]?.[0]
  const lastDate = dayGroups[dayGroups.length - 1]?.[0]
  const dateRange = firstDate === lastDate ? formatDay(firstDate) : formatDay(firstDate) + " – " + formatDay(lastDate)

  return <section className={"weekend-view" + (variant === "simple" ? " simple-weekend" : "")} aria-label="比赛周末视图">
    <header className="weekend-header">
      <div className="weekend-event-heading">
        <span className="weekend-series" style={{ "--weekend-accent": meta.color } as React.CSSProperties}>{meta.label}</span>
        <div className="weekend-event-copy">
          <p className="weekend-date-range">{dateRange} <span>· 第 {weekend.event.round} 站</span></p>
          <h2>{weekend.event.name}</h2>
          <p className="weekend-location"><MapPin size={14} aria-hidden />{[weekend.event.locality, weekend.event.country].filter(Boolean).join("，")}</p>
        </div>
      </div>
      <nav className="weekend-nav" aria-label="切换比赛周末">
        <span>{index + 1} / {weekends.length}</span>
        <button type="button" onClick={() => move(-1)} disabled={index <= 0} aria-label="上一站"><ChevronLeft size={17} /></button>
        <button type="button" onClick={() => move(1)} disabled={index >= weekends.length - 1} aria-label="下一站"><ChevronRight size={17} /></button>
      </nav>
    </header>

    <div className="weekend-days">
      {dayGroups.map(([day, sessions]) => <section className="weekend-day" key={day} aria-label={formatDay(day)}>
        <h3><span>{formatDay(day)}</span><span>{sessions.length} 场</span></h3>
        <ol>
          {sessions.map((session, sessionIndex) => {
            const pending = isTimeUnconfirmed(weekend.event, session)
            const started = !pending && Date.parse(session.utc) <= now && now <= Date.parse(session.utc) + 2 * 60 * 60 * 1000
            const local = !pending ? localTime(session.utc, weekend.event.tz) : null
            const beijing = !pending ? formatTime(session.utc, BEIJING_TZ) : null
            return <li key={session.utc + "-" + session.name + "-" + sessionIndex} className={"weekend-session" + (session.isMain ? " is-main" : "") + (started ? " is-live" : "")} style={{ "--weekend-accent": meta.color } as React.CSSProperties}>
              <div className="weekend-session-time">
                <strong>{pending ? "待确认" : beijing}</strong>
                {!pending && <small>{local && local !== beijing ? "当地 " + local : "北京时间"}</small>}
              </div>
              <div className="weekend-session-name">
                <span>{session.name}</span>
                {session.isMain && <Trophy size={13} aria-label="主场次" />}
              </div>
              {started && <span className="weekend-live">进行中</span>}
              {pending && <span className="weekend-estimate">估计</span>}
            </li>
          })}
        </ol>
      </section>)}
    </div>
    <footer className="weekend-footer">
      <span><Clock3 size={13} aria-hidden /> 北京时间为主，已确认场次同时显示当地时间</span>
      <Link href={(variant === "simple" ? "/new/event/" : "/event/") + weekend.event.id}>赛事详情 <ChevronRight size={14} aria-hidden /></Link>
    </footer>
  </section>
}
