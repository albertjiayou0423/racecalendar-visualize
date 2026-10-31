"use client"

import { WinnerReveal } from "@/components/ritual-motion"
import { MotionLoader } from "@/components/interface-motion"
import { browserTimeoutSignal } from "@/lib/browser-abort"

import useSWR from "swr"
import { useState } from "react"
import type { RaceEvent } from "@/lib/types"
import type { DailyForecast } from "@/app/api/weather/route"
import { mapFePredictionDrivers, mapWrcPredictionDrivers, predictionRosterUrl, type PredictionDriver } from "@/lib/prediction-roster"
import { isConfirmed, eventSession } from "../model"
import type { LiveTimingData } from "@/lib/live-timing"
import { SimpleTable, DataState } from "./data-ui"

async function getJson(url: string) {
  const response = await fetch(url, { signal: browserTimeoutSignal(15000) })
  const data = await response.json()
  if (!response.ok) throw new Error(data.note || data.error || "暂时无法加载，请重试")
  return data
}
export function SimpleWeather({ event, now }: { event: RaceEvent; now: number }) {
  const session = eventSession(event, now)
  const date = session && isConfirmed(event, session) ? new Intl.DateTimeFormat("en-CA", { timeZone: event.tz }).format(new Date(session.utc)) : ""
  const distance = date ? (Date.parse(`${date}T00:00:00Z`) - now) / 86400000 : Infinity
  const params = new URLSearchParams({ city: event.locality, country: event.country, date })
  if (event.lat !== undefined && event.lon !== undefined) { params.set("lat", String(event.lat)); params.set("lon", String(event.lon)) }
  const enabled = !!date && distance >= -7 && distance <= 14
  const { data, error, isLoading, mutate } = useSWR<{ daily: DailyForecast[] }>(enabled ? `/api/weather?${params}` : null, getJson, { revalidateOnFocus: false, shouldRetryOnError: false })
  const day = data?.daily?.find(day => day.date === date)
  if (!enabled) return <p className="s-note">{!date ? "场次时间待确认，暂不提供天气。" : "天气预报支持赛前 14 天内查询。"}</p>
  if (isLoading) return <p className="s-note" role="status"><MotionLoader kind="weather" size={14} /> 正在查询赛道天气…</p>
  if (error) return <p className="s-note" role="alert">天气暂不可用。<button type="button" className="s-link" onClick={() => mutate()}>重试</button></p>
  if (!day) return <p className="s-note">该比赛日期暂无天气预报。</p>
  return <div className="s-weather"><div><strong>{day.tempMin}–{day.tempMax}°</strong><span>{event.locality} · {date} 当地日期</span></div><div><strong>{day.precipitationProbability}%</strong><span>降水概率 · {day.precipitationSum} mm</span></div></div>
}

async function getDrivers(url: string): Promise<PredictionDriver[]> {
  const data = await getJson(url)
  if (data.ok !== true) throw new Error(data.note || "预测候选暂不可用")
  const drivers = Array.isArray(data.standings) ? mapWrcPredictionDrivers(data.standings) : url.startsWith("/api/fe-drivers") && Array.isArray(data.drivers) ? mapFePredictionDrivers(data.drivers) : data.drivers
  if (!Array.isArray(drivers) || !drivers.length) throw new Error("当前赛季暂无预测候选")
  return drivers
}
export function SimplePrediction({ event }: { event: RaceEvent }) {
  const roster = useSWR(predictionRosterUrl(event.series, event.id), getDrivers, { shouldRetryOnError: false, revalidateOnFocus: false })
  const votes = useSWR<{ total: number; myVote?: string }>(`/api/predictions?eventId=${encodeURIComponent(event.id)}`, getJson, { shouldRetryOnError: false, revalidateOnFocus: false })
  const [selection, setSelection] = useState("")
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState("")
  async function save() {
    if (!selection || saving) return
    setSaving(true); setMessage("")
    try {
      const response = await fetch("/api/predictions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ eventId: event.id, driverCode: selection }), signal: browserTimeoutSignal(15000) })
      if (!response.ok) { const data = await response.json(); throw new Error(data.error || "预测未保存，请重试") }
      await votes.mutate(); setMessage("预测已保存")
    } catch (error) { setMessage(error instanceof Error ? error.message : "预测未保存，请重试") }
    finally { setSaving(false) }
  }
  if (roster.isLoading || votes.isLoading) return <p className="s-note" role="status">加载预测候选…</p>
  if (roster.error || votes.error) return <p className="s-note" role="alert">{roster.error?.message || "预测暂不可用"}<button type="button" className="s-link" onClick={() => { roster.mutate(); votes.mutate() }}>重试</button></p>
  return <div className="s-prediction"><label htmlFor={`simple-prediction-${event.id}`}>你看好谁夺冠？<span>{votes.data?.total ?? 0} 人参与</span></label><div className="s-inline"><select id={`simple-prediction-${event.id}`} value={selection || votes.data?.myVote || ""} disabled={saving} onChange={event => { setSelection(event.target.value); setMessage("") }}><option value="">选择车手</option>{roster.data?.map(driver => <option key={driver.code} value={driver.code}>{driver.name} · {driver.team}</option>)}</select><button type="button" className="s-button" onClick={save} disabled={!selection || saving}>{saving ? "保存中…" : votes.data?.myVote ? "更改预测" : "保存预测"}</button></div><p className="s-note" role="status">{message || (votes.data?.myVote ? "已有预测，可选择其他车手后更改。" : "预测保存在当前浏览器的匿名会话中。")}</p></div>
}

type ResultRace = { raceName: string; Results: { position: string; Driver: { givenName: string; familyName: string }; Constructor: { name: string } }[] }
export function SimpleLastResult() {
  const [revealed, setRevealed] = useState(false)
  const { data, error, isLoading, mutate } = useSWR(revealed ? "/api/f1-last-result" : null, getJson, { revalidateOnFocus: false, shouldRetryOnError: false })
  const race = data?.MRData?.RaceTable?.Races?.[0] as ResultRace | undefined
  return <section className="s-last-result"><div className="s-between"><span>上一站回顾 · F1</span><button type="button" className="s-link" aria-expanded={revealed} onClick={() => setRevealed(value => !value)}>{revealed ? "隐藏赛果" : "显示赛果"}</button></div>{revealed && <div>{isLoading ? <p className="s-note">加载赛果…</p> : error ? <p className="s-note">赛果暂不可用。<button type="button" className="s-link" onClick={() => mutate()}>重试</button></p> : !race ? <p className="s-note">暂无上一站赛果</p> : <><p className="s-note">{race.raceName}</p>{race.Results.slice(0, 3).map(result => <div className="s-result-row" key={result.position}><b>{result.position}</b><WinnerReveal>{result.Driver.givenName} {result.Driver.familyName}</WinnerReveal><small>{result.Constructor.name}</small></div>)}</>}</div>}</section>
}

export function SimpleTiming({ event }: { event: RaceEvent }) {
  const url = event.liveTimingUrl || (event.series === "WRC" ? "https://www.wrc.com/en/wrc-plus/live-timing/" : event.series === "FE" ? "https://fiaformulae.com/en/race-centre" : "https://www.formula1.com/en/latest/article/live-timing")
  const { data, error, isLoading, mutate } = useSWR<LiveTimingData>(event.series === "WRC" ? null : `/api/live-timing?series=${event.series}`, getJson, { revalidateOnFocus: false, shouldRetryOnError: false, refreshInterval: data => data?.status === "live" ? 10000 : 0, refreshWhenHidden: false })
  return <div><div className="s-between"><p className="s-note">{data?.sessionName || "官方实时计时"}{data?.currentLap ? ` · 第 ${data.currentLap}${data.totalLaps ? `/${data.totalLaps}` : ""}圈` : ""}{data?.redFlag ? " · 红旗" : data?.safetyCar ? " · 安全车" : data?.virtualSafetyCar ? " · VSC" : ""}</p>{event.series !== "WRC" && <button className="s-link" type="button" onClick={() => mutate()}>刷新</button>}</div><DataState loading={isLoading} loadingKind="live" error={error} retry={() => mutate()}>{data?.drivers?.length ? <SimpleTable caption="实时计时" rows={data.drivers} rowKey={row => row.driverNumber} columns={[{ key: "position", title: "位次", render: row => row.position }, { key: "name", title: "车手", render: row => <div>{row.driverName || row.driverCode}<small>{row.team}</small></div> }, { key: "gap", title: "差距", render: row => row.gap || "—" }, { key: "lap", title: "最近圈速", render: row => row.lastLap || "—" }]} /> : <p className="s-note">暂无可验证的实时数据，请前往官方计时页面。</p>}</DataState><a href={url} className="s-link" target="_blank" rel="noopener noreferrer">打开官方 Live Timing</a>{data?.source && <p className="s-note">来源：{data.source} · {data.lastUpdated}</p>}</div>
}
