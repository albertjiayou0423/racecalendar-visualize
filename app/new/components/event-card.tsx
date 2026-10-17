"use client"

import { useState } from "react"
import dynamic from "next/dynamic"
import Link from "next/link"
import { ArrowUpRight, ChevronDown, Heart, Maximize2, Download, Info, ExternalLink } from "lucide-react"
import type { RaceEvent } from "@/lib/types"
import { BEIJING_TZ, formatDateTime, formatTime } from "@/lib/format"
import { sessionsByTime, eventSession, isConfirmed, validTime, eventEnd, type StartSelection } from "../model"
import { SeriesBadge, IconButton } from "./primitives"
import { SimpleWeather, SimplePrediction, SimpleTiming } from "./event-extras"

const CircuitImage = dynamic(() => import("@/components/circuit-image").then(module => module.CircuitImage), { ssr: false })

function calendarUrl(event: RaceEvent, utc: string, sessionName: string) {
  return `/api/calendar?${new URLSearchParams({ id: event.id, series: event.series, utc, round: String(event.round), name: event.name + " · " + sessionName, circuit: event.circuit, locality: event.locality, country: event.country })}`
}
export function SimpleEventCard({ event, now, favorite, onFavorite, onStart, defaultOpen = false }: { event: RaceEvent; now: number; favorite: boolean; onFavorite: () => void; onStart: (selection: StartSelection) => void; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen)
  const [panel, setPanel] = useState<"sessions" | "weather" | "prediction" | "circuit" | "timing">("sessions")
  const next = eventSession(event, now)
  const reliable = next && isConfirmed(event, next)
  const past = eventEnd(event) < now
  const sessions = sessionsByTime(event)
  return <article className="s-card" data-event-card tabIndex={-1}>
    <div className="s-card-top"><SeriesBadge series={event.series} /><span className="s-muted">第 {event.round} 站</span>{event.clientData && <details className="s-client-source"><summary aria-label="客户端补充来源"><Info size={13} aria-hidden="true" /></summary><div><p>客户端网络补缺，待独立核验</p><p>{event.clientData.sessions.join("、")}</p><p>{event.clientData.uploadedAt}</p><p className="s-break">{event.clientData.sourceUrl}</p></div></details>}<span className="s-card-spacer" /><IconButton label={`${favorite ? "取消收藏" : "收藏"}${event.name}`} aria-pressed={favorite} onClick={onFavorite}><Heart size={15} fill={favorite ? "currentColor" : "none"} aria-hidden="true" /></IconButton></div>
    <div className="s-card-main"><div><h3><Link href={`/new/event/${event.id}`}>{event.name}</Link></h3><p>{event.circuit || event.locality} · {event.country}</p></div><div className="s-card-time">{reliable ? <><strong>{formatTime(next.utc, BEIJING_TZ)}</strong><span>{formatDateTime(next.utc, BEIJING_TZ).split(" ").slice(0, 2).join(" ")}</span></> : <strong className="s-pending-time">{next?.clientUploadedAt ? "时间待核验" : "时间待确认"}</strong>}</div></div>
    <div className="s-card-bottom"><span className="s-upcoming-label">{past ? "已结束" : next?.name || "场次待公布"}</span><span className="s-broadcast-label">{(event.broadcasters ?? (event.broadcaster ? [event.broadcaster] : [])).map(item => item.name).join(" / ") || "转播待确认"}</span><Link href={`/new/event/${event.id}`} className="s-link">详情<ArrowUpRight size={13} aria-hidden="true" /></Link><button type="button" className="s-link" aria-expanded={open} aria-controls={`simple-card-${event.id}`} onClick={() => setOpen(value => !value)}>{open ? "收起" : "展开"}<ChevronDown size={13} className={open ? "s-turned" : ""} aria-hidden="true" /></button></div>
    {open && <div className="s-card-detail" id={`simple-card-${event.id}`}><div className="s-detail-tabs" role="group" aria-label={`${event.name}展开内容`}>{([{ key: "sessions", label: "场次" }, { key: "weather", label: "天气" }, { key: "prediction", label: "预测" }, { key: "timing", label: "计时" }, ...(event.series === "F1" ? [{ key: "circuit", label: "赛道" }] : [])] as { key: typeof panel; label: string }[]).map(tab => <button key={tab.key} type="button" aria-pressed={panel === tab.key} onClick={() => setPanel(tab.key)}>{tab.label}</button>)}</div>
      {panel === "sessions" && <><div className="s-session-head"><span>场次</span><span>北京时间 / 当地时间</span></div>{sessions.length === 0 && <p className="s-note">场次安排尚未公布</p>}{sessions.map((session, index) => { const reliable = isConfirmed(event, session); const started = validTime(session) && Date.parse(session.utc) <= now; return <div className="s-session" key={`${session.name}-${index}`}><span className={session.isMain ? "s-session-main" : ""}>{session.name}</span><div className="s-session-time">{reliable ? <><b>{formatDateTime(session.utc, BEIJING_TZ)}</b><small>当地 {formatDateTime(session.utc, event.tz)}</small></> : <b>{session.clientUploadedAt ? "时间待核验" : "时间待确认"}</b>}</div><div className="s-session-actions">{reliable && !started && <IconButton label={`${session.name}倒计时`} onClick={() => onStart({ event, session })}><Maximize2 size={14} aria-hidden="true" /></IconButton>}{reliable && <a className="s-icon" href={calendarUrl(event, session.utc, session.name)} download={`${event.id}.ics`} aria-label={`${session.name}加入日历`} title="加入日历"><Download size={14} aria-hidden="true" /></a>}</div></div>})}<div className="s-card-official">{event.url && <a href={event.url} target="_blank" rel="noopener noreferrer" className="s-link">赛事官网<ExternalLink size={12} aria-hidden="true" /></a>}{event.liveTimingUrl && <a href={event.liveTimingUrl} target="_blank" rel="noopener noreferrer" className="s-link">官方计时<ExternalLink size={12} aria-hidden="true" /></a>}{(event.broadcasters ?? (event.broadcaster ? [event.broadcaster] : [])).map((item, index) => item.url ? <a key={index} href={item.url} className="s-link" target="_blank" rel="noopener noreferrer">{item.name}<ExternalLink size={12} aria-hidden="true" /></a> : <span key={index} className="s-note">{item.name}{item.note ? ` · ${item.note}` : ""}</span>)}</div></>}
      {panel === "timing" && <SimpleTiming event={event} />}
      {panel === "weather" && <SimpleWeather event={event} now={now} />}
      {panel === "prediction" && (past ? <p className="s-note">本场赛事已结束</p> : <SimplePrediction key={event.id} event={event} />)}
      {panel === "circuit" && (event.circuitImageUrl ? <CircuitImage src={event.circuitImageUrl} alt={`${event.circuit}赛道图`} maxHeight={180} /> : <p className="s-note">暂无赛道图，可在完整赛事详情中了解赛道。</p>)}
    </div>}
  </article>
}
