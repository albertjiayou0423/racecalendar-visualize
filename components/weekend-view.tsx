"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { Check, ChevronLeft, ChevronRight, Clock3, Copy, MapPin, RotateCcw, Trophy } from "lucide-react"
import type { RaceEvent, RaceSession } from "@/lib/types"
import { BEIJING_TZ, SERIES_META, countdown, formatDateTime, formatTime, offsetLabel } from "@/lib/format"
import { isTimeUnconfirmed } from "@/lib/session-time"
import "./weekend-view.css"

type WeekendEvent = { event: RaceEvent; sessions: RaceSession[]; start: number; end: number }
type Weekend = { id: string; events: WeekendEvent[]; start: number; end: number }
type EventSchedule = WeekendEvent & { dayGroups: [string, RaceSession[]][] }
type SessionEntry = { event: RaceEvent; session: RaceSession }

function dateKey(utc: string) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: BEIJING_TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(utc))
}

function dateKeyInZone(utc: string, timeZone: string) {
  try {
    return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(utc))
  } catch {
    return dateKey(utc)
  }
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

function weekendKeyFor(event: RaceEvent, sessions: RaceSession[]) {
  const main = sessions.find(session => session.isMain) ?? sessions[sessions.length - 1]
  // Use the event's local calendar day so a Sunday-night race does not become a
  // different weekend just because its Beijing display time has crossed midnight.
  const [year, month, day] = dateKeyInZone(main.utc, event.tz).split("-").map(Number)
  const weekday = new Date(Date.UTC(year, month - 1, day, 12)).getUTCDay()
  const daysToFriday = weekday === 5
    ? 0
    : weekday === 6
      ? -1
      : weekday === 0
        ? -2
        : 5 - weekday
  const friday = new Date(Date.UTC(year, month - 1, day + daysToFriday, 12))
  return [friday.getUTCFullYear(), String(friday.getUTCMonth() + 1).padStart(2, "0"), String(friday.getUTCDate()).padStart(2, "0")].join("-")
}

function groupSessions(sessions: RaceSession[], timeZone: string): [string, RaceSession[]][] {
  const grouped = new Map<string, RaceSession[]>()
  for (const session of sessions) {
    const key = dateKeyInZone(session.utc, timeZone)
    const day = grouped.get(key) ?? []
    day.push(session)
    grouped.set(key, day)
  }
  return [...grouped.entries()]
}

function buildWeekends(events: RaceEvent[]): Weekend[] {
  const groups = new Map<string, WeekendEvent[]>()
  for (const event of events) {
    const sessions = event.sessions
      .filter(session => Number.isFinite(Date.parse(session.utc)))
      .sort((a, b) => Date.parse(a.utc) - Date.parse(b.utc))
    if (!sessions.length) continue
    const id = weekendKeyFor(event, sessions)
    const start = Date.parse(sessions[0].utc)
    const end = Date.parse(sessions[sessions.length - 1].utc) + 2 * 60 * 60 * 1000
    const group = groups.get(id) ?? []
    group.push({ event, sessions, start, end })
    groups.set(id, group)
  }
  return [...groups.entries()]
    .map(([id, weekendEvents]) => ({
      id,
      events: weekendEvents.sort((a, b) => a.start - b.start),
      start: Math.min(...weekendEvents.map(item => item.start)),
      end: Math.max(...weekendEvents.map(item => item.end)),
    }))
    .sort((a, b) => a.id.localeCompare(b.id))
}

function nearestIndex(weekends: Weekend[], now: number) {
  const live = weekends.findIndex(item => item.start <= now && item.end >= now)
  if (live >= 0) return live
  const next = weekends.findIndex(item => item.start > now)
  return next >= 0 ? next : Math.max(0, weekends.length - 1)
}

function sessionIsLive(entry: SessionEntry, now: number) {
  if (entry.event.series === "WRC" || isTimeUnconfirmed(entry.event, entry.session)) return false
  const start = Date.parse(entry.session.utc)
  return start <= now && now <= start + 2 * 60 * 60 * 1000
}

function isNextSession(entry: SessionEntry, now: number) {
  if (isTimeUnconfirmed(entry.event, entry.session)) {
    const today = dateKeyInZone(new Date(now).toISOString(), entry.event.tz)
    return dateKeyInZone(entry.session.utc, entry.event.tz) >= today
  }
  return Date.parse(entry.session.utc) > now
}

export function WeekendView({ events, now, variant = "default" }: { events: RaceEvent[]; now: number; variant?: "default" | "simple" }) {
  const weekends = useMemo(() => buildWeekends(events), [events])
  const nearest = nearestIndex(weekends, now)
  // Null follows the nearest weekend; manual browsing stays put until reset.
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [copyNotice, setCopyNotice] = useState("")
  const selectedExists = selectedId !== null && weekends.some(item => item.id === selectedId)
  const activeId = selectedExists ? selectedId : weekends[nearest]?.id ?? ""

  useEffect(() => {
    if (selectedId !== null && !weekends.some(item => item.id === selectedId)) setSelectedId(null)
  }, [weekends, selectedId])

  useEffect(() => {
    if (!copyNotice) return
    const timeout = window.setTimeout(() => setCopyNotice(""), 2200)
    return () => window.clearTimeout(timeout)
  }, [copyNotice])

  const index = weekends.findIndex(item => item.id === activeId)
  const weekend = weekends[index]
  const eventSchedules = useMemo<EventSchedule[]>(() => weekend?.events.map(item => ({ ...item, dayGroups: groupSessions(item.sessions, item.event.tz) })) ?? [], [weekend])
  const sessionEntries = useMemo<SessionEntry[]>(() => eventSchedules
    .flatMap(({ event, sessions }) => sessions.map(session => ({ event, session })))
    .sort((a, b) => Date.parse(a.session.utc) - Date.parse(b.session.utc)), [eventSchedules])

  const move = (direction: -1 | 1) => {
    const next = weekends[index + direction]
    if (next) setSelectedId(next.id)
  }

  if (!weekend) return <section className={"weekend-view" + (variant === "simple" ? " simple-weekend" : "")} aria-label="比赛周末视图"><p className="weekend-empty">当前筛选下没有包含有效场次时间的赛事。</p></section>

  const allDays = eventSchedules.flatMap(schedule => schedule.dayGroups.map(([day]) => day)).sort()
  const firstDate = allDays[0]
  const lastDate = allDays[allDays.length - 1]
  const dateRange = firstDate === lastDate ? formatDay(firstDate) : `${formatDay(firstDate)} – ${formatDay(lastDate)}`
  const liveEntry = [...sessionEntries].reverse().find(entry => sessionIsLive(entry, now))
  const nextEntry = sessionEntries.find(entry => isNextSession(entry, now))
  const focusEntry = liveEntry ?? nextEntry
  const focusPending = focusEntry ? isTimeUnconfirmed(focusEntry.event, focusEntry.session) : false
  const focusMeta = focusEntry ? SERIES_META[focusEntry.event.series] : SERIES_META[weekend.events[0].event.series]
  const series = [...new Set(weekend.events.map(item => item.event.series))]

  async function copySchedule() {
    const lines = [`${dateRange} · 比赛周末 · ${eventSchedules.length} 项赛事`, ""]
    for (const schedule of eventSchedules) {
      const { event } = schedule
      lines.push(`【${SERIES_META[event.series].label} · ${event.name} · 第 ${event.round} 站】`)
      lines.push([event.locality, event.country].filter(Boolean).join("，"))
      for (const [day, sessions] of schedule.dayGroups) {
        lines.push(`  ${formatDay(day)}`)
        for (const session of sessions) {
          const pending = isTimeUnconfirmed(event, session)
          const main = session.isMain ? "（主赛）" : ""
          const time = pending
            ? `时间待确认${session.clientUploadedAt ? " · 客户端补充待核验" : " · 估计"}`
            : `北京时间 ${formatTime(session.utc, BEIJING_TZ)} · 当地 ${formatDateTime(session.utc, event.tz)} ${offsetLabel(session.utc, event.tz)}`
          lines.push(`  • ${time} · ${session.name}${main}`)
        }
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
        <div className="weekend-series-list" aria-label="本周末赛事系列">
          {series.map(item => <span key={item} className="weekend-series" style={{ "--weekend-accent": SERIES_META[item].color } as React.CSSProperties}>{SERIES_META[item].label}</span>)}
        </div>
        <div className="weekend-event-copy">
          <p className="weekend-date-range">{dateRange} <span>· {eventSchedules.length} 项赛事</span></p>
          <h2>本周末赛事</h2>
          <p className="weekend-location">完整显示本周末各项赛事；日期按各赛事当地时间分组</p>
        </div>
      </div>
      <nav className="weekend-nav" aria-label="切换比赛周末">
        <span>{index + 1} / {weekends.length} 个周末</span>
        <button type="button" onClick={() => move(-1)} disabled={index <= 0} aria-label="上一个比赛周末"><ChevronLeft size={17} /></button>
        <button type="button" onClick={() => move(1)} disabled={index >= weekends.length - 1} aria-label="下一个比赛周末"><ChevronRight size={17} /></button>
        {index !== nearest && <button type="button" onClick={() => setSelectedId(null)} aria-label="回到最近比赛周末" title="回到最近比赛周末"><RotateCcw size={14} /></button>}
      </nav>
    </header>

    <div className={"weekend-focus" + (liveEntry ? " is-live" : "")} style={{ "--weekend-accent": focusMeta.color } as React.CSSProperties}>
      <span className="weekend-focus-icon" aria-hidden><Clock3 size={16} /></span>
      <div className="weekend-focus-copy">
        <span className="weekend-focus-label">{liveEntry ? "正在进行" : nextEntry ? "下一场" : "本周末赛程"}</span>
        <strong>{focusEntry ? `${SERIES_META[focusEntry.event.series].label} · ${focusEntry.event.name} · ${focusEntry.session.name}` : "暂无后续场次"}</strong>
        {focusEntry && <span className="weekend-focus-time">
          {focusPending
            ? `时间待确认 · ${focusEntry.session.clientUploadedAt ? "客户端补充待核验" : "估计安排"}`
            : `${formatDateTime(focusEntry.session.utc, BEIJING_TZ)} · 北京时间${liveEntry ? "" : ` · 还有 ${timeUntil(focusEntry.session.utc, now)}`}`}
        </span>}
      </div>
      {focusEntry?.session.isMain && <span className="weekend-focus-main"><Trophy size={12} />主赛</span>}
    </div>

    <div className="weekend-races">
      {eventSchedules.map(schedule => {
        const { event } = schedule
        const meta = SERIES_META[event.series]
        const eventToday = dateKeyInZone(new Date(now).toISOString(), event.tz)
        return <article className="weekend-race" key={event.id} style={{ "--weekend-accent": meta.color } as React.CSSProperties} aria-label={`${meta.label} ${event.name}`}>
          <header className="weekend-race-header">
            <span className="weekend-series">{meta.label}</span>
            <div className="weekend-race-copy">
              <p className="weekend-race-round">第 {event.round} 站</p>
              <h3>{event.name}</h3>
              <p className="weekend-location"><MapPin size={13} aria-hidden />{[event.locality, event.country].filter(Boolean).join("，")}</p>
            </div>
            <Link className="weekend-race-detail" href={(variant === "simple" ? "/new/event/" : "/event/") + event.id}>赛事详情 <ChevronRight size={14} aria-hidden /></Link>
          </header>
          <div className="weekend-days">
            {schedule.dayGroups.map(([day, sessions]) => <section className="weekend-day" key={day} aria-label={`${event.name} ${formatDay(day)}`}>
              <h4><span className="weekend-day-title">{formatDay(day)}{day === eventToday && <em>今天</em>}</span><span>{sessions.length} 场</span></h4>
              <ol>
                {sessions.map((session, sessionIndex) => {
                  const pending = isTimeUnconfirmed(event, session)
                  const started = liveEntry?.event.id === event.id && liveEntry.session === session
                  const next = nextEntry?.event.id === event.id && nextEntry.session === session
                  const beijing = !pending ? formatTime(session.utc, BEIJING_TZ) : null
                  const beijingDateTime = !pending ? formatDateTime(session.utc, BEIJING_TZ) : null
                  const localDateTime = !pending ? formatDateTime(session.utc, event.tz) : null
                  return <li key={session.utc + "-" + session.name + "-" + sessionIndex} className={"weekend-session" + (session.isMain ? " is-main" : "") + (started ? " is-live" : "") + (next ? " is-next" : "")} style={{ "--weekend-accent": meta.color } as React.CSSProperties}>
                    <div className="weekend-session-time">
                      <strong>{pending ? "待确认" : beijing}</strong>
                      {!pending && <small>{localDateTime !== beijingDateTime ? `当地 ${localDateTime} · ${offsetLabel(session.utc, event.tz)}` : `北京时间 · 当地 ${offsetLabel(session.utc, event.tz)}`}</small>}
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
        </article>
      })}
    </div>

    <footer className="weekend-footer">
      <span>时间以北京时间为主 · 日期按赛事当地时间分组</span>
      <div className="weekend-actions">
        {copyNotice && <span className="weekend-copy-notice" role="status">{copyNotice}</span>}
        <button type="button" onClick={copySchedule} className="weekend-copy">{copyNotice === "赛程已复制" ? <Check size={13} aria-hidden /> : <Copy size={13} aria-hidden />}{copyNotice === "赛程已复制" ? "已复制" : "复制赛程"}</button>
      </div>
    </footer>
  </section>
}
