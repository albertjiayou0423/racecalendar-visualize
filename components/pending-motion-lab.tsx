"use client"

import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react"
import Link from "next/link"
import { ArrowLeft, ArrowRight, ChevronDown, CircleHelp, Clock3, Flag, Heart, LoaderCircle, MapPinned, Play, RefreshCw, Sparkles } from "lucide-react"
import type { RaceEvent, RaceSession, ScheduleResponse, Series } from "@/lib/types"
import { EventCard } from "@/components/event-card"
import { EventHeader } from "@/components/event-header"
import { EventNotificationManager } from "@/components/event-notification-manager"
import { SessionTimeline } from "@/components/session-timeline"
import { ImmersiveCountdown } from "@/components/immersive-countdown"
import { WrcCountdownSequence } from "@/components/wrc-countdown-sequence"
import { CircuitImage } from "@/components/circuit-image"
import { LastRaceResults } from "@/components/last-race-results"
import { isEventFavorite, toggleFavorite } from "@/lib/favorites"
import { isTimeUnconfirmed } from "@/lib/session-time"
import { BEIJING_TZ, SERIES_META, formatDateTime } from "@/lib/format"
import { mergeScheduleWithClientCache, parseClientScheduleCache, scheduleFromClientCache } from "@/lib/client-schedule-cache"
import { cn } from "@/lib/utils"
import "./pending-motion-lab.css"

const SERIES: Series[] = ["F1", "FE", "WRC"]
const CACHE_KEYS = ["schedule-cache-v2", "schedule-cache"]

function cachedSchedule(): ScheduleResponse | null {
  try {
    const raw = CACHE_KEYS.map(key => localStorage.getItem(key)).find(Boolean)
    const cache = parseClientScheduleCache(raw ?? null)
    return cache ? scheduleFromClientCache(cache, true) : null
  } catch {
    return null
  }
}

function sortedSessions(event: RaceEvent): RaceSession[] {
  return event.sessions.slice().sort((a, b) => Date.parse(a.utc) - Date.parse(b.utc))
}

function preferredSessionIndex(event: RaceEvent, now: number) {
  const sessions = sortedSessions(event)
  const upcomingIndex = sessions.findIndex(session => Date.parse(session.utc) >= now)
  return upcomingIndex >= 0 ? upcomingIndex : Math.max(sessions.length - 1, 0)
}

function compareEventSchedule(a: RaceEvent, b: RaceEvent, now: number) {
  const schedulePosition = (event: RaceEvent) => {
    const times = event.sessions.map(session => Date.parse(session.utc)).filter(Number.isFinite)
    const upcoming = times.filter(time => time >= now).sort((first, second) => first - second)[0]
    const latestPast = times.filter(time => time < now).sort((first, second) => second - first)[0]
    return { upcoming, latestPast }
  }
  const first = schedulePosition(a)
  const second = schedulePosition(b)
  if (first.upcoming !== undefined && second.upcoming === undefined) return -1
  if (first.upcoming === undefined && second.upcoming !== undefined) return 1
  if (first.upcoming !== undefined && second.upcoming !== undefined) return first.upcoming - second.upcoming
  return (second.latestPast ?? 0) - (first.latestPast ?? 0)
}

function SectionTitle({ index, title, description }: { index: string; title: string; description: string }) {
  return (
    <div className="pending-section-title">
      <span className="pending-section-index">{index}</span>
      <div>
        <h2>{title}</h2>
        <p>{description}</p>
      </div>
    </div>
  )
}

function FavoriteRitual({ event }: { event: RaceEvent }) {
  const [favorite, setFavorite] = useState(false)
  const [pulse, setPulse] = useState(0)
  useEffect(() => setFavorite(isEventFavorite(event.id)), [event.id])
  const toggle = () => {
    const next = toggleFavorite(event.id)
    setFavorite(next)
    setPulse(value => value + 1)
  }
  return (
    <div className="pending-favorite-row">
      <div className="pending-favorite-copy">
        <span className="pending-mini-label">你的赛历</span>
        <strong>{event.name}</strong>
        <small>{event.series} · 第 {event.round} 站</small>
      </div>
      <button type="button" className={cn("pending-favorite-button", favorite && "is-favorite")} onClick={toggle} aria-pressed={favorite}>
        <Heart key={pulse} className={cn("size-4", pulse > 0 && "pending-heart-hit")} fill={favorite ? "currentColor" : "none"} />
        {favorite ? "已收藏" : "收藏赛事"}
      </button>
    </div>
  )
}

function TrackReveal({ event }: { event: RaceEvent }) {
  const [play, setPlay] = useState(0)
  if (event.series !== "F1" || !event.circuitImageUrl) {
    return (
      <div className="pending-no-track">
        <MapPinned className="size-5" />
        <span>{event.series} · {event.name} 暂无可展示的赛道图，保留真实赛程数据。</span>
      </div>
    )
  }
  return (
    <div className="pending-track-stage">
      <div className="pending-track-topline"><span>{event.circuit}</span><span>{event.locality} · {event.country}</span></div>
      <div key={play} className="pending-track-reveal">
        <CircuitImage src={event.circuitImageUrl} alt={`${event.circuit} 实际赛道平面图`} maxHeight={250} />
        <span className="pending-track-sweep" aria-hidden="true" />
      </div>
      <button type="button" className="pending-text-button" onClick={() => setPlay(value => value + 1)}>
        <Play className="size-3.5" /> 重播赛道点亮
      </button>
    </div>
  )
}

function WrcHandoff({ events, now }: { events: RaceEvent[]; now: number }) {
  const event = useMemo(() => events.filter(item => item.series === "WRC" && item.sessions.length > 1)
    .sort((a, b) => compareEventSchedule(a, b, now))[0], [events, now])
  const sessions = useMemo(() => event ? sortedSessions(event) : [], [event])
  const [activeIndex, setActiveIndex] = useState(0)
  const [handoff, setHandoff] = useState(0)
  useEffect(() => { setActiveIndex(0) }, [event?.id])
  const active = sessions[activeIndex]
  const next = sessions[(activeIndex + 1) % Math.max(sessions.length, 1)]
  if (!event || !active || !next || sessions.length < 2) {
    return <div className="pending-empty-state">当前赛历暂无可用于切换演示的 WRC 多赛段赛事。</div>
  }
  const showTime = !isTimeUnconfirmed(event, active)
  return (
    <div className="pending-handoff-stage" data-handoff={handoff}>
      <div className="pending-handoff-meta">
        <span>{event.name}</span>
        <span>{event.locality} · {event.country}</span>
      </div>
      <div key={`${event.id}-${activeIndex}-${handoff}`} className="pending-stage-swap">
        <span className="pending-stage-kicker">时间顺序 {activeIndex + 1} / {sessions.length}</span>
        <div className="pending-stage-title-row"><h3>{active.name}</h3><span className="pending-stage-signal"><i /><i /><i /></span></div>
        <div className="pending-stage-time">
          {showTime ? formatDateTime(active.utc, event.tz) : "当地时间待确认"}
          {showTime && <small>当地时间 · {event.tz}</small>}
        </div>
        <div className="pending-stage-next"><span>下一段</span><strong>{next.name}</strong><time>{isTimeUnconfirmed(event, next) ? "时间待确认" : formatDateTime(next.utc, event.tz)}</time></div>
      </div>
      <button type="button" className="pending-handoff-button" onClick={() => {
        setActiveIndex(index => (index + 1) % sessions.length)
        setHandoff(value => value + 1)
      }}>
        演示交接到下一赛段 <ArrowRight className="size-4" />
      </button>
      <p className="pending-caption">赛段名称和已确认时间取自当前 WRC 赛历。此按钮用于预览交接动效，不会改写数据或触发实际倒计时。</p>
    </div>
  )
}

export function PendingMotionLab() {
  const [data, setData] = useState<ScheduleResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [now, setNow] = useState(Date.now())
  const [series, setSeries] = useState<Series>("F1")
  const [eventId, setEventId] = useState("")
  const [sessionIndex, setSessionIndex] = useState(0)
  const [cardReplay, setCardReplay] = useState(0)
  const [countdownOpen, setCountdownOpen] = useState(false)
  const [fullscreen, setFullscreen] = useState(false)
  const [notificationOpen, setNotificationOpen] = useState(false)

  const loadSchedule = useCallback(async () => {
    setLoading(true)
    setLoadError(false)
    try {
      const response = await fetch("/api/schedule", { cache: "no-store" })
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      const fresh = await response.json() as ScheduleResponse
      if (!Array.isArray(fresh.events) || !Array.isArray(fresh.sources)) throw new Error("invalid schedule")
      let previous = null
      try { previous = parseClientScheduleCache(CACHE_KEYS.map(key => localStorage.getItem(key)).find(Boolean) ?? null) } catch { /* Cache is optional. */ }
      const merged = mergeScheduleWithClientCache(fresh, previous)
      setData(merged.response)
      try { localStorage.setItem("schedule-cache-v2", JSON.stringify(merged.cache)) } catch { /* Cache is optional. */ }
    } catch {
      const fallback = cachedSchedule()
      if (fallback) setData(fallback)
      else setLoadError(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void loadSchedule() }, [loadSchedule])
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [])

  const seriesEvents = useMemo(() => (data?.events ?? []).filter(event => event.series === series)
    .slice().sort((a, b) => compareEventSchedule(a, b, now)), [data?.events, series, now])
  const event = seriesEvents.find(item => item.id === eventId) ?? seriesEvents[0] ?? null
  const sessions = useMemo(() => event ? sortedSessions(event) : [], [event])
  const session = sessions[sessionIndex] ?? sessions[0] ?? null
  const trackEvent = useMemo(() => {
    if (event?.series === "F1" && event.circuitImageUrl) return event
    return (data?.events ?? []).filter(item => item.series === "F1" && item.circuitImageUrl)
      .slice().sort((a, b) => compareEventSchedule(a, b, now))[0] ?? event
  }, [data?.events, event, now])

  useEffect(() => {
    const candidates = (data?.events ?? []).filter(item => item.series === series)
      .slice().sort((a, b) => compareEventSchedule(a, b, now))
    if (!candidates.some(item => item.id === eventId)) setEventId(candidates[0]?.id ?? "")
  }, [series, data?.events, eventId, now])
  useEffect(() => {
    setSessionIndex(event ? preferredSessionIndex(event, now) : 0)
    setCountdownOpen(false)
    setFullscreen(false)
  }, [event?.id])

  const closeCountdown = () => { setCountdownOpen(false); setFullscreen(false) }

  return (
    <main className="pending-page">
      <div className="pending-shell">
        <header className="pending-header">
          <Link href="/" className="pending-back"><ArrowLeft className="size-4" /> 返回赛历</Link>
          <span className="pending-live-label"><i /> REAL SCHEDULE · REAL COMPONENTS</span>
        </header>

        <section className="pending-hero">
          <div className="pending-hero-rule" />
          <p className="pending-overline">RACE RITUALS / MOTION LAB</p>
          <h1>让每个开赛时刻<br /><span>都有抵达感。</span></h1>
          <p className="pending-hero-copy">用当前赛事日历、真实赛段和项目里的实际组件，逐个体验正在探索的仪式感动效。</p>
          <div className="pending-hero-stats"><span><strong>{data?.events.length ?? "—"}</strong> 场赛事</span><span><strong>F1 · FE · WRC</strong></span><span>{data ? `更新于 ${new Date(data.fetchedAt).toLocaleString("zh-CN", { hour12: false })}` : "正在读取当前赛历"}</span></div>
        </section>

        <section className="pending-controls" aria-label="选择真实赛事">
          <div className="pending-series-tabs" role="tablist" aria-label="赛事系列">
            {SERIES.map(item => <button key={item} type="button" role="tab" aria-selected={series === item} onClick={() => setSeries(item)} className={cn(series === item && "is-active")} style={{ "--series-accent": SERIES_META[item].color } as CSSProperties}>{item}</button>)}
          </div>
          <label className="pending-select-wrap"><span>赛事</span><select value={event?.id ?? ""} onChange={e => { setEventId(e.target.value); setCountdownOpen(false) }} disabled={!seriesEvents.length}>
            {seriesEvents.map(item => <option key={item.id} value={item.id}>{item.name} · 第 {item.round} 站</option>)}
          </select><ChevronDown className="size-4" /></label>
          <label className="pending-select-wrap"><span>场次</span><select value={session ? String(sessionIndex) : ""} onChange={e => { setSessionIndex(Number(e.target.value)); setCountdownOpen(false) }} disabled={!sessions.length}>
            {sessions.map((item, index) => <option key={`${item.name}-${index}`} value={index}>{item.name}{isTimeUnconfirmed(event!, item) ? " · 时间待确认" : ` · ${formatDateTime(item.utc, BEIJING_TZ)}`}</option>)}
          </select><ChevronDown className="size-4" /></label>
          <button type="button" className="pending-refresh" onClick={() => void loadSchedule()} disabled={loading} aria-label="重新读取赛程"><RefreshCw className={cn("size-4", loading && "animate-spin")} /></button>
        </section>

        {loading && !data ? <div className="pending-status"><LoaderCircle className="size-5 animate-spin" /> 正在读取真实赛程数据…</div> : loadError && !data ? (
          <div className="pending-status pending-error"><CircleHelp className="size-5" /><div><strong>暂时读不到赛程数据</strong><p>请重试；如果你在本地打开，项目 API 可能需要线上环境变量或已有赛程缓存。</p><button onClick={() => void loadSchedule()}>重新加载</button></div></div>
        ) : !event ? <div className="pending-status">当前赛程没有 {series} 数据。</div> : (
          <>
            <div className="pending-source-row">
              {data?.sources.map(source => <span key={source.series} className={cn("pending-source", source.ok ? "is-ok" : "is-stale")}><i />{source.series} · {source.cached ? "本机缓存" : source.ok ? "已连接" : "回退数据"}</span>)}
              {data?.sources.some(source => source.cached) && <span className="pending-cache-note">数据来自最近一次成功缓存</span>}
            </div>

            <section className="pending-section">
              <SectionTitle index="01" title="赛周开幕" description="真实首页 EventCard，保留站次、赛事名、所在地、赛程和详情交互。" />
              <div className="pending-action-line"><span><Sparkles className="size-4" /> 卡片入场动效</span><button className="pending-text-button" onClick={() => setCardReplay(value => value + 1)}><Play className="size-3.5" /> 重播开幕</button></div>
              <div key={cardReplay} className={cn("pending-card-arrival", cardReplay > 0 && "is-replaying")}><EventCard event={event} now={now} /></div>
            </section>

            <section className="pending-section">
              <SectionTitle index="02" title="赛道点亮" description="使用赛历返回的真实 F1 赛道图；斜向扫光只作为动效图层。" />
              {trackEvent ? <TrackReveal event={trackEvent} /> : <div className="pending-empty-state">赛程数据里暂无可用赛道图片。</div>}
            </section>

            <section className="pending-section">
              <SectionTitle index="03" title="赛程推进与赛季抵达" description="实际赛事标题、轮次和 session 驱动时间线；站次数字沿用已有到达动效。" />
              <EventHeader event={event} now={now} onSetNotification={() => setNotificationOpen(true)} />
              <SessionTimeline event={event} now={now} />
              <div className="pending-favorite-wrap"><FavoriteRitual event={event} /></div>
              {notificationOpen && <EventNotificationManager event={event} onClose={() => setNotificationOpen(false)} />}
            </section>

            <section className="pending-section pending-countdown-section">
              <SectionTitle index="04" title="开赛仪式" description="使用真实场次 UTC、赛事系列与主题色；重播控件只临时改变预览计时。" />
              {session ? <>
                <div className="pending-countdown-context"><div><span>{event.name}</span><strong>{session.name}</strong></div><div className="pending-countdown-actual"><Clock3 className="size-4" /><span>{isTimeUnconfirmed(event, session) ? "具体时间待确认" : `${formatDateTime(session.utc, BEIJING_TZ)} · 北京时间`}</span></div></div>
                {isTimeUnconfirmed(event, session) && <p className="pending-warning">此场次时间尚未确认。组件会显示实际数据状态，不生成估计倒计时。</p>}
                <div className="pending-countdown-actions"><button type="button" className="pending-primary-button" onClick={() => { setCountdownOpen(true); setFullscreen(false) }} disabled={isTimeUnconfirmed(event, session)}><Play className="size-4" /> 体验嵌入式倒计时</button><button type="button" className="pending-secondary-button" onClick={() => { setCountdownOpen(true); setFullscreen(true) }} disabled={isTimeUnconfirmed(event, session)}>全屏体验 <ArrowRight className="size-4" /></button></div>
                {countdownOpen && (event.series === "WRC" ? <WrcCountdownSequence key={`${event.id}-${session.utc}-${fullscreen}`} event={event} session={session} preview={!fullscreen} entrance onClose={closeCountdown} /> : <ImmersiveCountdown key={`${event.id}-${session.utc}-${fullscreen}`} targetTime={session.utc} timeZone={event.tz} series={event.series} isRace={!!session.isMain} title={`${event.name} · ${session.name}`} preview={!fullscreen} entrance onClose={closeCountdown} />)}
              </> : <div className="pending-empty-state">该赛事尚未公布场次。</div>}
              <p className="pending-caption">正式赛程时间始终保持原值。沉浸组件里的“重播最后 10 秒”只为查看灯光、归零和冲击动画，不会更改日历或触发真实通知。</p>
            </section>

            <section className="pending-section">
              <SectionTitle index="05" title="WRC 赛段交接" description="赛段和当地时间来自当前 WRC 行程；点按可快速查看交接动效。" />
              <WrcHandoff events={data?.events ?? []} now={now} />
            </section>

            <section className="pending-section">
              <SectionTitle index="06" title="终点揭晓" description="复用实际 F1 上一站成绩接口与剧透确认流程，不填充虚构名次。" />
              <LastRaceResults />
            </section>

            <footer className="pending-footer"><Flag className="size-4" /><span>动效预览使用实际赛事资料；所有演示触发都局限于当前页面。</span><Link href="/">返回赛历 <ArrowRight className="size-3.5" /></Link></footer>
          </>
        )}
      </div>
    </main>
  )
}
