"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { Check, ChevronLeft, ChevronRight, Clock3, Copy, MapPin, RotateCcw, Trophy } from "lucide-react"
import type { RaceEvent, RaceSession } from "@/lib/types"
import { BEIJING_TZ, SERIES_META, countdown, formatDateTime, formatTime, offsetLabel } from "@/lib/format"
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

function timeUntil(utc: string, now: number) {
  const left = countdown(utc, now)
  if (left.days > 0) return `${left.days}天 ${left.hours}小时`
  if (left.hours > 0) return `${left.hours}小时 ${left.minutes}分`
  if (left.minutes > 0) return `${left.minutes}分 ${left.seconds}秒`
  return `${left.seconds}秒`
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
  // Null means "follow the nearest weekend"; manual browsing stays put until reset.
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [copyNotice, setCopyNotice] = useState("")
  const selectedExists = selectedId !== null && weekends.some(item => item.event.id === selectedId)
  const activeId = selectedExists ? selectedId : weekends[nearest]?.event.id ?? ""

  useEffect(() => {
    if (selectedId !== null && !weekends.some(item => item.event.id === selectedId)) setSelectedId(null)
  }, [weekends, selectedId])

  useEffect(() => {
    if (!copyNotice) return
    const timeout = window.setTimeout(() => setCopyNotice(""), 2200)
    return () => window.clearTimeout(timeout)
  }, [copyNotice])

  const index = weekends.findIndex(item => item.event.id === activeId)
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
  const today = dateKey(new Date(now).toISOString())
  const liveSession = weekend.event.series === "WRC"
    ? undefined
    : [...weekend.sessions].reverse().find(session => {
      if (isTimeUnconfirmed(weekend.event, session)) return false
      const start = Date.parse(session.utc)
      return start <= now && now <= start + 2 * 60 * 60 * 1000
    })
  const nextSession = weekend.sessions.find(session => {
    if (isTimeUnconfirmed(weekend.event, session)) return dateKey(session.utc) >= today
    return Date.parse(session.utc) > now
  })
  const focusSession = liveSession ?? nextSession
  const focusPending = focusSession ? isTimeUnconfirmed(weekend.event, focusSession) : false

  async function copySchedule() {
    const lines = [
      `${weekend.event.name} · 比赛周末`,
      [weekend.event.locality, weekend.event.country].filter(Boolean).join("，"),
      "",
    ]
    for (const [day, sessions] of dayGroups) {
      lines.push(`【${formatDay(day)}】`)
      for (const session of sessions) {
        const pending = isTimeUnconfirmed(weekend.event, session)
        const main = session.isMain ? "（主赛）" : ""
        const time = pending
          ? `时间待确认${session.clientUploadedAt ? " · 客户端补充" : " · 估计"}`
          : `北京时间 ${formatTime(session.utc, BEIJING_TZ)}${weekend.event.tz ? ` · 当地 ${formatDateTime(session.utc, weekend.event.tz)} ${offsetLabel(session.utc, weekend.event.tz)}` : ""}`
        lines.push(`• ${time} · ${session.name}${main}`)
      }
      lines.push("")
    }
    try {
      await navigator.clipboard.writeText(lines.join("\n").trim())
      setCopyNotice("赛程已复制")
    } catch {
      setCopyNotice("复制失败，请检查剪贴板权限")
    }
  }

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
        {index !== nearest && <button type="button" onClick={() => setSelectedId(null)} aria-label="回到最近比赛周末" title="回到最近比赛周末"><RotateCcw size={14} /></button>}
      </nav>
    </header>

    <div className={"weekend-focus" + (liveSession ? " is-live" : "")} style={{ "--weekend-accent": meta.color } as React.CSSProperties}>
      <span className="weekend-focus-icon" aria-hidden><Clock3 size={16} /></span>
      <div className="weekend-focus-copy">
        <span className="weekend-focus-label">{liveSession ? "正在进行" : nextSession ? "下一场" : "本站赛程"}</span>
        <strong>{focusSession?.name ?? "暂无后续场次"}</strong>
        {focusSession && <span className="weekend-focus-time">
          {focusPending
            ? `时间待确认 · ${focusSession.clientUploadedAt ? "客户端补充待核验" : "估计安排"}`
            : `${formatDateTime(focusSession.utc, BEIJING_TZ)} · 北京时间${liveSession ? "" : ` · 还有 ${timeUntil(focusSession.utc, now)}`}`}
        </span>}
      </div>
      {focusSession?.isMain && <span className="weekend-focus-main"><Trophy size={12} />主赛</span>}
    </div>

    <div className="weekend-days">
      {dayGroups.map(([day, sessions]) => <section className="weekend-day" key={day} aria-label={formatDay(day)}>
        <h3><span className="weekend-day-title">{formatDay(day)}{day === today && <em>今天</em>}</span><span>{sessions.length} 场</span></h3>
        <ol>
          {sessions.map((session, sessionIndex) => {
            const pending = isTimeUnconfirmed(weekend.event, session)
            const started = liveSession === session
            const next = nextSession === session
            const beijing = !pending ? formatTime(session.utc, BEIJING_TZ) : null
            const beijingDateTime = !pending ? formatDateTime(session.utc, BEIJING_TZ) : null
            const localDateTime = !pending ? formatDateTime(session.utc, weekend.event.tz) : null
            return <li key={session.utc + "-" + session.name + "-" + sessionIndex} className={"weekend-session" + (session.isMain ? " is-main" : "") + (started ? " is-live" : "") + (next ? " is-next" : "")} style={{ "--weekend-accent": meta.color } as React.CSSProperties}>
              <div className="weekend-session-time">
                <strong>{pending ? "待确认" : beijing}</strong>
                {!pending && <small>{localDateTime !== beijingDateTime ? `当地 ${localDateTime} · ${offsetLabel(session.utc, weekend.event.tz)}` : `北京时间 · 当地 ${offsetLabel(session.utc, weekend.event.tz)}`}</small>}
              </div>
              <div className="weekend-session-name">
                <span>{session.name}</span>
                {session.isMain && <Trophy size={13} aria-label="主场次" />}
              </div>
              <div className="weekend-session-badges">
                {started && <span className="weekend-live">进行中</span>}
                {!started && next && !pending && <span className="weekend-next-label">下一场</span>}
                {pending && <span className="weekend-estimate">估计</span>}
              </div>
            </li>
          })}
        </ol>
      </section>)}
    </div>
    <footer className="weekend-footer">
      <span>北京时间为主 · 已确认场次附当地日期和时区</span>
      <div className="weekend-actions">
        {copyNotice && <span className="weekend-copy-notice" role="status">{copyNotice}</span>}
        <button type="button" onClick={copySchedule} className="weekend-copy">{copyNotice === "赛程已复制" ? <Check size={13} aria-hidden /> : <Copy size={13} aria-hidden />}{copyNotice === "赛程已复制" ? "已复制" : "复制赛程"}</button>
        <Link href={(variant === "simple" ? "/new/event/" : "/event/") + weekend.event.id}>赛事详情 <ChevronRight size={14} aria-hidden /></Link>
      </div>
    </footer>
  </section>
}
