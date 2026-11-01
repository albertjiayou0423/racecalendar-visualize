"use client"

import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react"
import Link from "next/link"
import { ArrowLeft, ArrowRight, CalendarDays, ChevronDown, Flag, LoaderCircle, MapPinned, Play, RefreshCw, Sparkles, TicketCheck } from "lucide-react"
import type { RaceEvent, RaceSession, ScheduleResponse, Series } from "@/lib/types"
import { EventCard } from "@/components/event-card"
import { CircuitImage } from "@/components/circuit-image"
import { isTimeUnconfirmed } from "@/lib/session-time"
import { BEIJING_TZ, SERIES_META, formatDateTime } from "@/lib/format"
import { mergeScheduleWithClientCache, parseClientScheduleCache, scheduleFromClientCache } from "@/lib/client-schedule-cache"
import { cn } from "@/lib/utils"
import "./pending-motion-lab.css"

const SERIES: Series[] = ["F1", "FE", "WRC"]
const CACHE_KEYS = ["schedule-cache-v2", "schedule-cache"]

type ResultDriver = { position: string; points: string; driver: { code?: string; givenName: string; familyName: string }; constructor: { name: string } }
type LastRace = { raceName: string; season: string; round: string; results: ResultDriver[] }
type ApiResult = { position?: string; points?: string; Driver?: { code?: string; givenName?: string; familyName?: string }; Constructor?: { name?: string } }

function readCachedSchedule(): ScheduleResponse | null {
  try {
    const raw = CACHE_KEYS.map(key => localStorage.getItem(key)).find(Boolean)
    const cache = parseClientScheduleCache(raw ?? null)
    return cache ? scheduleFromClientCache(cache, true) : null
  } catch { return null }
}

function sortedSessions(event: RaceEvent) {
  return event.sessions.slice().sort((a, b) => Date.parse(a.utc) - Date.parse(b.utc))
}

function compareEvents(a: RaceEvent, b: RaceEvent, now: number) {
  const position = (event: RaceEvent) => {
    const times = event.sessions.map(session => Date.parse(session.utc)).filter(Number.isFinite)
    const next = times.filter(time => time >= now).sort((x, y) => x - y)[0]
    const previous = times.filter(time => time < now).sort((x, y) => y - x)[0]
    return { next, previous }
  }
  const first = position(a)
  const second = position(b)
  if (first.next !== undefined && second.next === undefined) return -1
  if (first.next === undefined && second.next !== undefined) return 1
  if (first.next !== undefined && second.next !== undefined) return first.next - second.next
  return (second.previous ?? 0) - (first.previous ?? 0)
}

function ProposalHeading({ number, title, location, trigger }: { number: string; title: string; location: string; trigger: string }) {
  return <div className="pending-proposal-heading"><span className="pending-proposal-number">{number}</span><div><h2>{title}</h2><p>{location} <i /> 触发：{trigger}</p></div><span className="pending-new-tag">提案</span></div>
}

function EntryPass({ event, now }: { event: RaceEvent; now: number }) {
  const [replay, setReplay] = useState(0)
  const sessions = sortedSessions(event)
  const session = sessions.find(item => Date.parse(item.utc) >= now) ?? sessions[sessions.length - 1]
  return <div className="pending-pass-preview">
    <div key={replay} className="pending-pass-card">
      <div className="pending-pass-top"><TicketCheck className="size-4" /><span>WEEKEND PASS</span><b>{event.series} / {String(event.round).padStart(2, "0")}</b></div>
      <div className="pending-pass-main"><div><span className="pending-pass-kicker">{event.country}</span><h3>{event.name}</h3><p>{event.locality} · {event.circuit}</p></div>{event.circuitImageUrl && <CircuitImage src={event.circuitImageUrl} alt={`${event.circuit} 赛道图`} maxHeight={86} />}</div>
      <div className="pending-pass-footer"><span>{session ? session.name : "赛程待公布"}</span><strong>{session && !isTimeUnconfirmed(event, session) ? formatDateTime(session.utc, BEIJING_TZ) : "时间待确认"}</strong></div>
    </div>
    <button className="pending-demo-button" type="button" onClick={() => setReplay(value => value + 1)}><Play className="size-3.5" /> 重播通行证入场</button>
  </div>
}

function WeekendChapter({ event, now }: { event: RaceEvent; now: number }) {
  const sessions = useMemo(() => sortedSessions(event), [event])
  const nextIndex = sessions.findIndex(session => Date.parse(session.utc) >= now)
  const [active, setActive] = useState(0)
  useEffect(() => setActive(nextIndex >= 0 ? nextIndex : Math.max(sessions.length - 1, 0)), [event.id])
  const session = sessions[active]
  if (!session) return <div className="pending-preview-empty">这场赛事暂时没有公布场次。</div>
  const upcoming = Date.parse(session.utc) >= now
  return <div className="pending-chapter-preview">
    <div className="pending-chapter-top"><span>赛周章节</span><span>{active + 1} / {sessions.length}</span></div>
    <div className="pending-chapter-rail">{sessions.map((item, index) => <button key={`${item.name}-${index}`} type="button" aria-label={`显示场次 ${index + 1}：${item.name}`} aria-current={index === active ? "step" : undefined} className={cn(index < active && "is-done", index === active && "is-active")} onClick={() => setActive(index)}><i /></button>)}</div>
    <div key={`${event.id}-${active}`} className="pending-chapter-focus"><span>{upcoming ? "下一章即将开始" : "最近完成的章节"}</span><strong>{session.name}</strong><time>{isTimeUnconfirmed(event, session) ? "时间待确认" : formatDateTime(session.utc, BEIJING_TZ)}</time></div>
    <div className="pending-chapter-controls"><button className="pending-demo-button" type="button" onClick={() => setActive(index => (index + sessions.length - 1) % sessions.length)}>上一场</button><button className="pending-demo-button" type="button" onClick={() => setActive(index => (index + 1) % sessions.length)}>推进到下一场 <ArrowRight className="size-3.5" /></button></div>
  </div>
}

function WrcRoadbook({ events, now }: { events: RaceEvent[]; now: number }) {
  const event = useMemo(() => events.filter(item => item.series === "WRC" && item.sessions.length > 1).slice().sort((a, b) => compareEvents(a, b, now))[0], [events, now])
  const sessions = useMemo(() => event ? sortedSessions(event) : [], [event])
  const [stage, setStage] = useState(0)
  const [turn, setTurn] = useState(0)
  useEffect(() => setStage(0), [event?.id])
  const current = sessions[stage]
  const next = sessions[(stage + 1) % Math.max(sessions.length, 1)]
  if (!event || !current || !next) return <div className="pending-preview-empty">当前 WRC 赛历没有可预览的多赛段赛事。</div>
  return <div className="pending-roadbook-preview">
    <div className="pending-roadbook-meta"><span>{event.name}</span><span>{stage + 1} / {sessions.length}</span></div>
    <div key={`${event.id}-${stage}-${turn}`} className="pending-roadbook-page"><span>ROADBOOK · {current.name.match(/SSS?\s*\d+/i)?.[0] ?? "STAGE"}</span><strong>{current.name}</strong><time>{isTimeUnconfirmed(event, current) ? "时间待确认" : `${formatDateTime(current.utc, event.tz)} · 当地时间`}</time><div><MapPinned className="size-4" /> {event.locality} · {event.country}</div></div>
    <button className="pending-demo-button" type="button" onClick={() => { setStage(index => (index + 1) % sessions.length); setTurn(value => value + 1) }}>翻到下一页 <ArrowRight className="size-3.5" /></button>
    <p className="pending-preview-note">预览使用真实 WRC 赛段和当地时间；按钮只切换画面。</p>
    <span className="pending-roadbook-next">下一段　{next.name}</span>
  </div>
}

function SeasonHandoff({ events, now }: { events: RaceEvent[]; now: number }) {
  const years = useMemo(() => [...new Set(events.flatMap(event => event.sessions.map(session => new Date(session.utc).getUTCFullYear())))].filter(Number.isFinite).sort((a, b) => a - b), [events])
  const currentYear = new Date(now).getFullYear()
  const year = years.includes(currentYear) ? currentYear : years[0]
  const nextYear = years.find(item => item > year) ?? year + 1
  const [showNext, setShowNext] = useState(false)
  const selectedYear = showNext ? nextYear : year
  const yearEvents = events.filter(event => event.sessions.some(session => new Date(session.utc).getUTCFullYear() === selectedYear))
  const chronological = yearEvents.slice().sort((a, b) => {
    const firstA = Math.min(...a.sessions.map(session => Date.parse(session.utc)).filter(Number.isFinite))
    const firstB = Math.min(...b.sessions.map(session => Date.parse(session.utc)).filter(Number.isFinite))
    return firstA - firstB
  })
  const featured = showNext ? chronological[0] : chronological[chronological.length - 1]
  const featuredSession = featured ? sortedSessions(featured)[0] : undefined
  return <div className="pending-season-preview">
    <div className="pending-season-label"><CalendarDays className="size-4" /> {selectedYear} 赛季 <span>{yearEvents.length} 场赛事</span></div>
    <div key={selectedYear} className="pending-season-arrival"><span>{showNext ? "NEXT SEASON · OPENER" : "CURRENT SEASON · FINALE"}</span><strong>{featured?.name ?? "赛程尚未公布"}</strong><p>{featured && featuredSession ? `${featured.country} · ${formatDateTime(featuredSession.utc, BEIJING_TZ)}` : `${selectedYear} 年赛事正在等待官方公布`}</p></div>
    <button className="pending-demo-button" type="button" onClick={() => setShowNext(value => !value)}>{showNext ? `返回 ${year} 赛季收官` : `预览 ${nextYear} 首站交接`} <ArrowRight className="size-3.5" /></button>
  </div>
}

function PodiumReveal() {
  const [race, setRace] = useState<LastRace | null>(null)
  const [loading, setLoading] = useState(true)
  const [revealed, setRevealed] = useState(false)
  const [replay, setReplay] = useState(0)
  useEffect(() => {
    const controller = new AbortController()
    void fetch("/api/f1-last-result", { signal: controller.signal }).then(response => {
      if (!response.ok) throw new Error("赛果暂不可用")
      return response.json()
    }).then(json => {
      const source = json?.MRData?.RaceTable?.Races?.[0]
      if (!source || !Array.isArray(source.Results)) throw new Error("赛果格式无效")
      const results = source.Results.slice(0, 3).map((item: ApiResult) => ({
        position: item.position ?? "",
        points: item.points ?? "0",
        driver: { code: item.Driver?.code, givenName: item.Driver?.givenName ?? "", familyName: item.Driver?.familyName ?? "" },
        constructor: { name: item.Constructor?.name ?? "" },
      })).filter((item: ResultDriver) => item.driver.givenName && item.driver.familyName)
      setRace({ raceName: source.raceName, season: source.season, round: source.round, results })
    }).catch(() => {}).finally(() => setLoading(false))
    return () => controller.abort()
  }, [])
  if (loading) return <div className="pending-preview-empty"><LoaderCircle className="size-4 animate-spin" /> 正在读取上一站官方赛果…</div>
  if (!race || !race.results.length) return <div className="pending-preview-empty">当前无法读取上一站赛果；不显示虚构名次。</div>
  return <div className="pending-podium-preview">
    <div className="pending-podium-top"><span><Flag className="size-4" /> {race.raceName}</span><small>{race.season} · 第 {race.round} 轮</small></div>
    {!revealed ? <div className="pending-spoiler-lock"><span>方格旗落下后，领奖台依次揭晓</span><button type="button" className="pending-demo-button" onClick={() => { setRevealed(true); setReplay(value => value + 1) }}>预览领奖台揭晓 <ArrowRight className="size-3.5" /></button></div> : <div key={replay} className="pending-podium-steps">{[race.results[1], race.results[0], race.results[2]].map((driver, index) => driver && <div key={driver.position} className={`pending-podium-step podium-${index}`}><span>P{index === 1 ? 1 : index === 0 ? 2 : 3}</span><strong>{driver.driver.code || `${driver.driver.givenName[0]}${driver.driver.familyName[0]}`}</strong><small>{driver.constructor.name}</small><b>+{driver.points}</b></div>)}</div>}
    <p className="pending-preview-note">真实官方赛果；揭晓前保留剧透保护。按钮只改变本页预览状态。</p>
    {revealed && <button className="pending-demo-button" type="button" onClick={() => { setRevealed(false); setReplay(value => value + 1) }}>重新隐藏结果</button>}
  </div>
}

export function PendingMotionLab() {
  const [data, setData] = useState<ScheduleResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [now, setNow] = useState(Date.now())
  const [series, setSeries] = useState<Series>("F1")
  const [eventId, setEventId] = useState("")
  const [passReplay, setPassReplay] = useState(0)
  const load = useCallback(async () => {
    setLoading(true); setError(false)
    try {
      const response = await fetch("/api/schedule", { cache: "no-store" })
      if (!response.ok) throw new Error("赛程暂不可用")
      const fresh = await response.json() as ScheduleResponse
      if (!Array.isArray(fresh.events) || !Array.isArray(fresh.sources)) throw new Error("赛程格式无效")
      let previous = null
      try { previous = parseClientScheduleCache(CACHE_KEYS.map(key => localStorage.getItem(key)).find(Boolean) ?? null) } catch { /* 浏览器缓存可选。 */ }
      const merged = mergeScheduleWithClientCache(fresh, previous)
      setData(merged.response)
      try { localStorage.setItem("schedule-cache-v2", JSON.stringify(merged.cache)) } catch { /* 浏览器缓存可选。 */ }
    } catch {
      const cached = readCachedSchedule()
      if (cached) setData(cached)
      else setError(true)
    } finally { setLoading(false) }
  }, [])
  useEffect(() => { void load() }, [load])
  useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 1000); return () => window.clearInterval(timer) }, [])

  const events = data?.events ?? []
  const seriesEvents = useMemo(() => events.filter(event => event.series === series).slice().sort((a, b) => compareEvents(a, b, now)), [events, series, now])
  const event = seriesEvents.find(item => item.id === eventId) ?? seriesEvents[0] ?? null
  useEffect(() => {
    if (seriesEvents.length && !seriesEvents.some(item => item.id === eventId)) setEventId(seriesEvents[0].id)
  }, [series, data?.events, eventId, seriesEvents])
  const trackEvent = event?.series === "F1" && event.circuitImageUrl ? event : events.filter(item => item.series === "F1" && item.circuitImageUrl).slice().sort((a, b) => compareEvents(a, b, now))[0]

  return <main className="pending-page"><div className="pending-shell">
    <header className="pending-header"><Link href="/" className="pending-back"><ArrowLeft className="size-4" /> 返回赛历</Link><span className="pending-live-label"><i /> MOTION PROPOSALS · NOT SHIPPED</span></header>
    <section className="pending-hero">
      <div className="pending-hero-rule" />
      <p className="pending-overline">RACE RITUALS / IDEA BOARD</p>
      <h1>还没发生的<br /><span>开赛仪式。</span></h1>
      <p className="pending-hero-copy">这里列出正在构思的新动效。每个预览都绑定当前真实赛程或赛果；你可以先看方向，再决定哪些值得进入正式页面。</p>
      <div className="pending-hero-stats"><span><strong>{data?.events.length ?? "—"}</strong> 场真实赛事</span><span><strong>05</strong> 个动效提案</span><span>{data ? `赛历更新于 ${new Date(data.fetchedAt).toLocaleString("zh-CN", { hour12: false })}` : "正在读取当前赛历"}</span></div>
    </section>

    <section className="pending-controls" aria-label="选择预览赛事">
      <div className="pending-series-tabs" role="tablist" aria-label="赛事系列">{SERIES.map(item => <button key={item} type="button" role="tab" aria-selected={series === item} onClick={() => { setSeries(item); setEventId("") }} className={cn(series === item && "is-active")} style={{ "--series-accent": SERIES_META[item].color } as CSSProperties}>{item}</button>)}</div>
      <label className="pending-select-wrap"><span>当前真实赛事</span><select value={event?.id ?? ""} onChange={e => { setEventId(e.target.value); setPassReplay(value => value + 1) }} disabled={!seriesEvents.length}><option value="" disabled>选择赛事</option>{seriesEvents.map(item => <option key={item.id} value={item.id}>{item.name} · 第 {item.round} 站</option>)}</select><ChevronDown className="size-4" /></label>
      <button type="button" className="pending-refresh" onClick={() => void load()} disabled={loading} aria-label="重新读取赛程"><RefreshCw className={cn("size-4", loading && "animate-spin")} /></button>
    </section>

    {loading && !data ? <div className="pending-status"><LoaderCircle className="size-5 animate-spin" /> 正在读取真实赛程数据…</div> : error && !data ? <div className="pending-status"><span>暂时读不到赛程数据。</span><button onClick={() => void load()}>重新加载</button></div> : !event ? <div className="pending-status">当前没有可预览的 {series} 赛事。</div> : <>
      <div className="pending-data-line"><span className="pending-data-dot" /> 使用真实赛事：<strong>{event.name}</strong><span>· 第 {event.round} 站 · {event.country}</span><span className="pending-data-sources">{data?.sources.map(source => `${source.series} ${source.ok ? "已连接" : "缓存"}`).join("　")}</span></div>

      <section className="pending-proposal"><ProposalHeading number="01" title="赛事通行证入场" location="首页卡片 → 赛事详情" trigger="打开赛事详情" />
        <div className="pending-proposal-body"><div className="pending-proposal-preview"><EntryPass key={`${event.id}-${passReplay}`} event={event} now={now} /></div><div className="pending-proposal-explain"><span className="pending-proposal-label">动效方向</span><h3>从赛历，进入赛周。</h3><p>卡片不直接跳页，而是短暂展开成一张赛事通行证：赛事名、地点、赛道和下一场次依次出现，再自然过渡到详情。</p><dl><div><dt>使用数据</dt><dd>赛事地点、赛道图、最近场次</dd></div><div><dt>适合位置</dt><dd>EventCard 点击后</dd></div></dl><button className="pending-demo-button" type="button" onClick={() => setPassReplay(value => value + 1)}><Play className="size-3.5" /> 重播这一提案</button></div></div>
        {event && <div className="pending-real-component"><span>真实组件上下文</span><EventCard event={event} now={now} /></div>}
      </section>

      <section className="pending-proposal"><ProposalHeading number="02" title="赛周章节推进" location="赛事详情 · 赛程时间线" trigger="进入新场次或手动查看" />
        <div className="pending-proposal-body"><div className="pending-proposal-preview"><WeekendChapter key={event.id} event={event} now={now} /></div><div className="pending-proposal-explain"><span className="pending-proposal-label">动效方向</span><h3>把一整个周末，变成几章。</h3><p>已完成场次收束成轨迹，当前或最近场次成为焦点，下一场从右侧推进。适合赛事期间回来查看，不需要反复读完整张时间线。</p><dl><div><dt>使用数据</dt><dd>{event.sessions.length} 场实际赛程与 UTC 时间</dd></div><div><dt>适合位置</dt><dd>赛事详情的时间线顶部</dd></div></dl></div></div>
      </section>

      <section className="pending-proposal"><ProposalHeading number="03" title="WRC 路书翻页" location="赛事详情 · WRC 赛段之间" trigger="上一赛段结束，接近下一赛段" />
        <div className="pending-proposal-body"><div className="pending-proposal-preview"><WrcRoadbook events={events} now={now} /></div><div className="pending-proposal-explain"><span className="pending-proposal-label">动效方向</span><h3>不切卡片，翻过下一页。</h3><p>用路书页的翻转和下一段预告，表达赛段之间的接力。每个赛段保留自己的名称、当地时间和地点；不模拟真实赛车状态。</p><dl><div><dt>使用数据</dt><dd>真实 WRC 多赛段行程与当地时区</dd></div><div><dt>适合位置</dt><dd>WRC 详情页的赛段列表</dd></div></dl></div></div>
      </section>

      <section className="pending-proposal"><ProposalHeading number="04" title="赛季交接信号" location="首页 · 年度赛历分界" trigger="进入新赛季或切换年份" />
        <div className="pending-proposal-body"><div className="pending-proposal-preview"><SeasonHandoff events={events} now={now} /></div><div className="pending-proposal-explain"><span className="pending-proposal-label">动效方向</span><h3>让下一年，像新一轮发车。</h3><p>当前赛季的最后几站逐渐退场，下一赛季第一场从主题色扫线后进入。交接明确但保持克制，不盖住正在看的赛事。</p><dl><div><dt>使用数据</dt><dd>当前年与后续年份的真实赛历</dd></div><div><dt>适合位置</dt><dd>首页年度分隔处</dd></div></dl></div></div>
      </section>

      <section className="pending-proposal"><ProposalHeading number="05" title="方格旗后的领奖台" location="上一站赛果 · 首页或赛果页" trigger="确认查看结果" />
        <div className="pending-proposal-body"><div className="pending-proposal-preview"><PodiumReveal /></div><div className="pending-proposal-explain"><span className="pending-proposal-label">动效方向</span><h3>先落旗，再揭晓名字。</h3><p>短促的方格旗横扫后，P2、P1、P3 依次站上领奖台。保留剧透确认；只使用真实成绩，接口失败时明确显示不可用。</p><dl><div><dt>使用数据</dt><dd>上一站官方名次、车手、车队和积分</dd></div><div><dt>适合位置</dt><dd>赛果卡片的揭晓动作</dd></div></dl></div></div>
      </section>

      <footer className="pending-footer"><Sparkles className="size-4" /><span>这些是待讨论的设计方向，当前仅在此页预览，不影响正式赛历。</span><Link href="/about">查看项目 <ArrowRight className="size-3.5" /></Link></footer>
    </>}
  </div></main>
}
