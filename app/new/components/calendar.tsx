"use client"

import { ChevronLeft, ChevronRight } from "lucide-react"
import type { RaceEvent } from "@/lib/types"
import { calendarDays, dayEvents, dayKey, dayStart, shiftedAnchor, validTime } from "../model"
import { IconButton } from "./primitives"
import { SERIES_THEME_COLORS } from "@/lib/series-theme"

export function SimpleCalendar({ events, view, anchor, selected, now, onAnchor, onSelect }: { events: RaceEvent[]; view: "week" | "month"; anchor: string; selected: string | null; now: number; onAnchor: (anchor: string) => void; onSelect: (key: string | null) => void }) {
  const days = calendarDays(anchor, view)
  const label = new Intl.DateTimeFormat("zh-CN", { timeZone: "Asia/Shanghai", year: "numeric", month: "long" }).format(new Date(dayStart(anchor)))
  return <section className={`s-calendar s-calendar-${view}`} aria-label={view === "week" ? "周赛历" : "月赛历"}><div className="s-calendar-nav"><strong>{view === "month" ? label : `${days[0].slice(5).replace("-", "/")} – ${days[6].slice(5).replace("-", "/")}`}</strong><div className="s-inline"><button type="button" className="s-link" onClick={() => { onAnchor(dayKey(now)); onSelect(dayKey(now)) }}>今天</button><IconButton label={view === "month" ? "上个月" : "上一周"} onClick={() => { onAnchor(shiftedAnchor(anchor, view, -1)); onSelect(null) }}><ChevronLeft size={16} /></IconButton><IconButton label={view === "month" ? "下个月" : "下一周"} onClick={() => { onAnchor(shiftedAnchor(anchor, view, 1)); onSelect(null) }}><ChevronRight size={16} /></IconButton></div></div><div className="s-calendar-grid">{["一", "二", "三", "四", "五", "六", "日"].map(day => <span key={day} className="s-weekday">{day}</span>)}{days.map(day => {
    const matches = dayEvents(events, day)
    const sessions = events.flatMap(event => event.sessions.filter(session => validTime(session) && dayKey(Date.parse(session.utc)) === day).map(session => ({ event, session })))
    return <button type="button" key={day} aria-pressed={selected === day} aria-label={`${day}，${matches.length}场赛事，${sessions.length}个场次`} className={`s-day ${day === dayKey(now) ? "is-today" : ""} ${view === "month" && day.slice(0, 7) !== anchor.slice(0, 7) ? "is-outside" : ""}`} onClick={() => onSelect(selected === day ? null : day)}><b>{Number(day.slice(-2))}</b><span className="s-day-dots">{Array.from(new Set(matches.map(event => event.series))).map(series => <i key={series} style={{ backgroundColor: SERIES_THEME_COLORS[series] }} aria-hidden="true" />)}</span><small>{matches.length ? `${matches.length} 场` : ""}</small>{view === "week" && <span className="s-week-event-names">{matches.slice(0, 2).map(event => <span key={event.id}>{event.name}</span>)}{matches.length > 2 && <span>另有 {matches.length - 2} 场</span>}</span>}</button>
  })}</div></section>
}
