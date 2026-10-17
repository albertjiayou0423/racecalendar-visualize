"use client"

import { useState } from "react"
import useSWR from "swr"
import { apiJson, useSimpleSchedule, useSimpleClock, useSimpleFavorites } from "../data"
import { isConfirmed, sessionsByTime, type StartSelection } from "../model"
import { SimpleEventCard } from "./event-card"
import { DataState, SimplePageHeader, SimpleSection, SimpleTable } from "./data-ui"
import { SimpleNextSession } from "./next-session"
import { nextStart } from "../model"
import { SimpleReminder, SimpleFooter } from "./footer"
import { SimpleSourceStatus } from "./source-status"
import { SimpleImmersionHost } from "./immersion-host"
import { EventShareArtwork, SvgExporter } from "./artwork"
import type { RaceEvent } from "@/lib/types"
import { formatDateTime, BEIJING_TZ } from "@/lib/format"

export function SimpleSessionTimeline({ event, now, onStart }: { event: RaceEvent; now: number; onStart: (selection: StartSelection) => void }) {
  const sessions = sessionsByTime(event)
  return <section className="s-timeline" aria-label="赛程时间线"><div className="s-timeline-rail" aria-hidden="true">{sessions.map((session, index) => <span key={index} className={Date.parse(session.utc) < now ? "is-past" : ""} />)}</div><div className="s-timeline-scroll">{sessions.map((session, index) => { const confirmed = isConfirmed(event, session); return <button type="button" key={index} disabled={!confirmed} onClick={() => onStart({ event, session })} aria-label={`${session.name}${confirmed ? "倒计时" : "时间待确认"}`}><strong>{session.name}</strong><small>{confirmed ? formatDateTime(session.utc, BEIJING_TZ) : session.clientUploadedAt ? "时间待核验" : "时间待确认"}</small></button> })}</div></section>
}
type Prediction = { position: number; driver: string; team: string; confidence: number; reason: string }
export function SimpleAiPrediction({ event }: { event: RaceEvent }) {
  const [requested, setRequested] = useState(false)
  const { data, error, isLoading, mutate } = useSWR<{ predictions?: Prediction[]; rawAnalysis?: string }>(requested ? `new-ai:${event.id}` : null, () => apiJson("/api/predictions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ eventId: event.id, series: event.series, eventName: event.name, circuit: event.circuit }), signal: AbortSignal.timeout(60000) }), { revalidateOnFocus: false, revalidateOnReconnect: false, shouldRetryOnError: false })
  return <SimpleSection title="AI 赛事预测" description="仅供观赛参考。点击生成会使用预测服务额度，不会自动运行。">{!requested && <button type="button" className="s-button" onClick={() => setRequested(true)}>生成预测</button>}<DataState loading={isLoading} error={error} retry={() => mutate()}>{data?.predictions?.length ? <SimpleTable caption="AI 预测" rows={data.predictions} rowKey={row => `${row.position}-${row.driver}`} columns={[{ key: "position", title: "预测名次", render: row => row.position }, { key: "driver", title: "车手", render: row => <div>{row.driver}<small>{row.team}</small></div> }, { key: "confidence", title: "置信度", render: row => `${row.confidence}%` }, { key: "reason", title: "依据", render: row => row.reason }]} /> : data && <p className="s-note">{data.rawAnalysis || "暂无可用预测"}</p>}</DataState></SimpleSection>
}
export function SimpleEventView({ id, serverTime }: { id: string; serverTime: number }) {
  const { data, error, isLoading, mutate } = useSimpleSchedule()
  const now = useSimpleClock(serverTime)
  const favorites = useSimpleFavorites()
  const [start, setStart] = useState<StartSelection | null>(null)
  const event = data?.events.find(event => event.id === id)
  return <main><SimplePageHeader title={event?.name || "赛事详情"} subtitle={event ? `${event.series} · 第 ${event.round} 站 · ${event.country}` : "场次与观赛信息"} /><SimpleSourceStatus data={data} error={!!error} /><DataState loading={isLoading && !data} error={!data && error} empty={!!data && !event} retry={() => mutate()}>{event && <><SimpleNextSession start={nextStart([event], now)} now={now} onStart={setStart} /><SimpleReminder events={[event]} /><SimpleSection title="赛程时间线"><SimpleSessionTimeline event={event} now={now} onStart={setStart} /></SimpleSection><SimpleEventCard event={event} now={now} favorite={favorites.ids.includes(id)} onFavorite={() => favorites.toggle(id)} onStart={setStart} defaultOpen /><SimpleSection title="比赛看点"><dl className="s-info-grid">{event.highlights && Object.entries(event.highlights).map(([key, text]) => <div key={key}><dt>{{ track: "赛道", championship: "积分形势", drivers: "关注车手" }[key] || key}</dt><dd>{text}</dd></div>)}{event.circuitInfo && <><div><dt>赛道长度</dt><dd>{event.circuitInfo.length}</dd></div><div><dt>比赛圈数</dt><dd>{event.circuitInfo.laps}</dd></div></>}{event.lastYearWinner && <div><dt>去年冠军</dt><dd>{event.lastYearWinner.driver} · {event.lastYearWinner.constructor}</dd></div>}{event.lastYearFastestLap && <div><dt>去年最快圈</dt><dd>{event.lastYearFastestLap.driver} · {event.lastYearFastestLap.time}</dd></div>}{event.extraInfo?.map((item, index) => <div key={index}><dt>{item.label}</dt><dd>{item.value}</dd></div>)}</dl>{!event.highlights && !event.circuitInfo && !event.extraInfo?.length && <p className="s-note">更多资料尚未公布，请以赛事官网为准。</p>}</SimpleSection><SimpleAiPrediction event={event} /><details className="s-section s-share-details"><summary>生成赛事分享图</summary><SvgExporter filename={event.id} sharePath={`/new/event/${id}`}><EventShareArtwork event={event} now={now} /></SvgExporter></details></>}</DataState><SimpleFooter /><SimpleImmersionHost selection={start} onClose={() => setStart(null)} /></main>
}
