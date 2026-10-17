"use client"

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react"
import Link from "next/link"
import dynamic from "next/dynamic"
import useSWR from "swr"
import { ArrowUpRight, ArrowLeft, ArrowRight, ChevronDown, ChevronLeft, ChevronRight, Maximize2, Search, RefreshCw, Check, Info } from "lucide-react"
import type { RaceEvent, RaceSession, ScheduleResponse, Series } from "@/lib/types"
import { formatDateTime, formatTime, BEIJING_TZ } from "@/lib/format"
import { SERIES_THEME_COLORS } from "@/lib/series-theme"
import { countdownDisplay } from "@/lib/countdown-display"
import { scheduleFromClientCache } from "@/lib/client-schedule-cache"
import { countdownCandidate, countdownKey } from "@/lib/countdown-entry"
import { FeedbackButton } from "@/components/feedback-button"
import { saveHomePreference } from "./home-preference"
import { beijingDay, confirmed, fetchNewHomeSchedule, nextConfirmed, readNewHomeCache, upcomingSession } from "./schedule"

const ImmersiveCountdown = dynamic(() => import("@/components/immersive-countdown").then(module => module.ImmersiveCountdown), { ssr: false })
const WrcCountdownSequence = dynamic(() => import("@/components/wrc-countdown-sequence").then(module => module.WrcCountdownSequence), { ssr: false })
const dayLabel = new Intl.DateTimeFormat("zh-CN", { timeZone: BEIJING_TZ, month: "long", day: "numeric" })
const weekday = new Intl.DateTimeFormat("zh-CN", { timeZone: BEIJING_TZ, weekday: "short" })
type Selection = { event: RaceEvent; session: RaceSession; entrance?: boolean }
type Filter = "ALL" | Series

function useHomeClock(serverTime: number) {
  const [now, setNow] = useState(serverTime)
  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | undefined
    const resume = () => {
      clearInterval(timer)
      if (!document.hidden) { setNow(Date.now()); timer = setInterval(() => setNow(Date.now()), 1000) }
    }
    resume()
    document.addEventListener("visibilitychange", resume)
    return () => { clearInterval(timer); document.removeEventListener("visibilitychange", resume) }
  }, [])
  return now
}

function validDate(utc: string) { return Number.isFinite(Date.parse(utc)) }

export function NewHome({ serverTime }: { serverTime: number }) {
  const now = useHomeClock(serverTime)
  const [fallback, setFallback] = useState<ScheduleResponse>()
  const [filter, setFilter] = useState<Filter>("ALL")
  const [query, setQuery] = useState("")
  const [selectedDay, setSelectedDay] = useState<string | null>(null)
  const [week, setWeek] = useState(0)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [immersive, setImmersive] = useState<Selection | null>(null)
  const autoSeen = useRef(new Set<string>())
  const [notice, setNotice] = useState(true)
  useEffect(() => {
    saveHomePreference("new")
    const cache = readNewHomeCache()
    if (cache) setFallback(scheduleFromClientCache(cache))
  }, [])
  const { data, error, isLoading, isValidating, mutate } = useSWR("/api/schedule", fetchNewHomeSchedule, { fallbackData: fallback, revalidateOnFocus: false, refreshInterval: 0 })
  const events = data?.events
  useEffect(() => {
    if (!events || immersive || document.hidden || document.querySelector('[aria-modal="true"]')) return
    const candidate = countdownCandidate(events, now)
    if (!candidate) return
    const key = countdownKey(candidate.event, candidate.session.utc)
    if (autoSeen.current.has(key)) return
    try { if (sessionStorage.getItem(key)) return } catch { /* In-memory guard remains. */ }
    autoSeen.current.add(key)
    try { sessionStorage.setItem(key, "1") } catch { /* Storage is optional. */ }
    setImmersive({ ...candidate, entrance: true })
  }, [events, immersive, now])
  const filtered = useMemo(() => (events ?? []).filter(event => (filter === "ALL" || event.series === filter) && `${event.name} ${event.country} ${event.locality} ${event.circuit}`.toLowerCase().includes(query.trim().toLowerCase())), [events, filter, query])
  const hero = useMemo(() => nextConfirmed(filtered, now), [filtered, now])
  const agenda = useMemo(() => filtered.map(event => ({ event, next: upcomingSession(event, now) }))
    .filter(({ event, next }) => next || event.sessions.length === 0 || event.sessions.some(session => !validDate(session.utc)))
    .filter(({ event }) => !selectedDay || event.sessions.some(session => validDate(session.utc) && beijingDay(Date.parse(session.utc)) === selectedDay))
    .sort((a, b) => (a.next ? Date.parse(a.next.utc) : Infinity) - (b.next ? Date.parse(b.next.utc) : Infinity)), [filtered, now, selectedDay])
  const today = beijingDay(now)
  const days = useMemo(() => Array.from({ length: 7 }, (_, index) => {
    const time = Date.parse(`${today}T00:00:00+08:00`) + (week * 7 + index) * 86400000
    const key = beijingDay(time)
    return { time, key, count: filtered.filter(event => event.sessions.some(session => validDate(session.utc) && beijingDay(Date.parse(session.utc)) === key)).length }
  }), [today, week, filtered])
  const accent = hero ? SERIES_THEME_COLORS[hero.event.series] : "#c5ed85"
  const countdown = countdownDisplay(hero ? Date.parse(hero.session.utc) - now : 0)
  const degraded = data?.sources.some(source => !source.ok || source.cached)
  const offline = !!(data && "offline" in data && data.offline)

  return <main className="new-home" style={{ "--new-accent": accent } as CSSProperties}>
    <div className="nh-shell">
      <header className="nh-header">
        <Link href="/new" className="nh-brand" aria-label="赛道时刻新版首页"><span className="nh-mark" aria-hidden="true"><i /><i /><i /></span>赛道时刻<span className="nh-beta">新版</span></Link>
        <nav aria-label="首页导航" className="nh-nav"><Link href="/standings">积分榜</Link><Link href="/results">赛果</Link><a href="/?home=classic" onClick={() => saveHomePreference("classic")} className="nh-classic"><ArrowLeft size={14} aria-hidden="true" />旧版首页</a></nav>
      </header>
      {notice && <div className="nh-welcome"><span>欢迎来到新版。更少干扰，专心等下一场。</span><button type="button" aria-label="收起新版欢迎提示" onClick={() => setNotice(false)}><Check size={15} aria-hidden="true" />知道了</button></div>}
      <div className="nh-topline"><span>{dayLabel.format(now)} · 北京时间</span><span className="nh-status"><i className={!data || degraded || offline ? "is-stale" : ""} aria-hidden="true" />{!data ? error ? "连接暂不可用" : "正在连接赛历" : offline ? "离线 · 本机赛历" : degraded ? "部分数据使用缓存 / 暂不可用" : "赛历已连接"}</span></div>

      {isLoading && !data ? <section className="nh-hero nh-loading" aria-label="赛历加载中" role="status"><span className="nh-eyebrow">下一场</span><div className="nh-skeleton" /><p>正在找到下一次出发…</p></section> : error && !data ? <section className="nh-hero nh-empty" role="alert"><h1>赛历暂时没连上。</h1><p>请稍后再试，或返回旧版首页。</p><button className="nh-primary" onClick={() => mutate()}><RefreshCw size={16} />重试连接</button></section> : hero ? <section className="nh-hero" aria-label="下一场赛事">
        <div className="nh-hero-copy">
          <div className="nh-eyebrow"><span className="nh-series">{hero.event.series}</span><span>下一场 / 第 {hero.event.round} 站</span></div>
          <h1>{hero.event.name}</h1>
          <p className="nh-session">{hero.session.name}<span> / {hero.event.country}</span></p>
          <p className="nh-start-time">{formatDateTime(hero.session.utc, BEIJING_TZ)}<span>北京时间</span></p>
          <div className="nh-hero-actions"><Link href={`/event/${hero.event.id}`} className="nh-primary">赛事详情<ArrowUpRight size={18} aria-hidden="true" /></Link><button type="button" className="nh-text-button" onClick={() => setImmersive(hero)}><Maximize2 size={16} aria-hidden="true" />沉浸倒计时</button></div>
        </div>
        <div className="nh-timer-panel"><p className="nh-eyebrow">距离出发</p><div className="nh-days"><strong>{countdown.days > 0 ? String(countdown.days).padStart(2, "0") : String(countdown.hours).padStart(2, "0")}</strong><span>{countdown.days > 0 ? "天" : "小时"}</span></div><div className="nh-timer-line" aria-label={`距开始 ${countdown.days} 天 ${countdown.hours} 小时 ${countdown.minutes} 分 ${countdown.seconds} 秒`}><span>{countdown.days > 0 ? String(countdown.hours).padStart(2, "0") : String(countdown.minutes).padStart(2, "0")}</span><b>:</b><span>{countdown.days > 0 ? String(countdown.minutes).padStart(2, "0") : String(countdown.seconds).padStart(2, "0")}</span><small>{countdown.days > 0 ? "时 / 分" : "分 / 秒"}</small></div><div className="nh-track" aria-hidden="true"><i /></div></div>
      </section> : <section className="nh-hero nh-empty"><span className="nh-eyebrow">暂歇片刻</span><h1>{query ? "还没找到这场。" : "下一次出发，待定。"}</h1><p>当前条件下暂无已确认的未来场次。你仍可在下方查看待定赛事。</p></section>}

      <section className="nh-agenda" aria-labelledby="nh-agenda-title">
        <div className="nh-agenda-heading"><div><p className="nh-eyebrow">把比赛放进生活</p><h2 id="nh-agenda-title">接下来，看什么？</h2></div><button type="button" className="nh-refresh" disabled={isValidating} onClick={() => mutate()} aria-label="刷新赛历"><RefreshCw size={16} className={isValidating ? "nh-spinning" : ""} aria-hidden="true" />{isValidating ? "更新中" : "刷新"}</button></div>
        <div className="nh-tools"><div className="nh-filters" role="group" aria-label="筛选赛事系列">{(["ALL", "F1", "WRC", "FE"] as const).map(value => <button type="button" key={value} aria-pressed={filter === value} className={filter === value ? "is-active" : ""} onClick={() => { setFilter(value); setExpanded(null) }}>{value === "ALL" ? "全部赛事" : value}</button>)}</div><label className="nh-search"><Search size={16} aria-hidden="true" /><input aria-label="搜索新版赛事" placeholder="赛事、城市、赛道" value={query} onChange={event => setQuery(event.target.value)} />{query && <button type="button" aria-label="清除搜索" onClick={() => setQuery("")}>清除</button>}</label></div>
        <div className="nh-date-navigation"><button type="button" className={!selectedDay ? "nh-all-dates is-active" : "nh-all-dates"} aria-pressed={!selectedDay} onClick={() => setSelectedDay(null)}>全部日期</button><span>{week === 0 ? "未来七天" : `${dayLabel.format(days[0].time)}起`}</span><div><button type="button" aria-label="前一周" disabled={week === 0} onClick={() => setWeek(value => Math.max(0, value - 1))}><ChevronLeft size={18} /></button><button type="button" aria-label="后一周" onClick={() => setWeek(value => Math.min(104, value + 1))} disabled={week === 104}><ChevronRight size={18} /></button></div></div>
        <div className="nh-date-strip" aria-label="选择赛程日期">{days.map(day => <button type="button" key={day.key} aria-pressed={selectedDay === day.key} aria-label={`${dayLabel.format(day.time)}，${day.count} 场赛事`} className={selectedDay === day.key ? "is-active" : ""} onClick={() => setSelectedDay(value => value === day.key ? null : day.key)}><span>{day.key === today ? "今天" : weekday.format(day.time)}</span><strong>{Number(day.key.slice(-2))}</strong><small>{day.count ? `${day.count} 场` : "—"}</small></button>)}</div>
        <div className="nh-list-meta"><span>{selectedDay ? `${selectedDay.slice(5).replace("-", "月")}日` : "未来赛程"}</span><span>{data ? `${agenda.length} 场赛事 · 时间均为北京时间` : error ? "等待重新连接" : "赛历加载中"}</span></div>
        {data && agenda.length === 0 && <div className="nh-list-empty"><p>{selectedDay ? "这一天暂时没有比赛，留点时间给生活。" : "没有找到匹配的未来赛事。"}</p><button type="button" className="nh-text-button" onClick={() => { setSelectedDay(null); setQuery(""); setFilter("ALL") }}>查看全部赛程<ArrowRight size={15} /></button></div>}
        {agenda.map(({ event, next }) => <AgendaRow key={event.id} event={event} next={next} selectedDay={selectedDay} expanded={expanded === event.id} onToggle={() => setExpanded(value => value === event.id ? null : event.id)} onCountdown={session => setImmersive({ event, session })} />)}
      </section>
      <footer className="nh-footer"><div><span className="nh-brand">赛道时刻</span><p>同一份热爱，下一次出发。</p></div><div className="nh-footer-links"><Link href="/wallpaper">日历壁纸</Link><Link href="/circuits">赛道</Link><Link href="/about">关于</Link><a href="/?home=classic" onClick={() => saveHomePreference("classic")}>返回旧版 <ArrowUpRight size={13} aria-hidden="true" /></a><FeedbackButton /></div></footer>
      {data && <details className="nh-data-details"><summary><Info size={13} aria-hidden="true" />数据与时间说明</summary><p>页面依据赛程时间展示倒计时，不代表现场实时发车状态。待确认或客户端待核验的场次不会触发倒计时。</p>{data.sources.map(source => <p key={source.series}>{source.series} · {source.label}{source.cached ? " · 本机缓存" : !source.ok ? " · 暂不可用" : ""}{source.note ? ` · ${source.note}` : ""}</p>)}</details>}
    </div>
    {immersive && (immersive.event.series === "WRC" ? <WrcCountdownSequence entrance={immersive.entrance} event={immersive.event} session={immersive.session} onClose={() => setImmersive(null)} /> : <ImmersiveCountdown entrance={immersive.entrance} targetTime={immersive.session.utc} series={immersive.event.series} title={`${immersive.event.name} · ${immersive.session.name}`} timeZone={immersive.event.tz} isRace={!!immersive.session.isMain} onClose={() => setImmersive(null)} />)}
  </main>
}

function AgendaRow({ event, next, selectedDay, expanded, onToggle, onCountdown }: { event: RaceEvent; next?: RaceSession; selectedDay: string | null; expanded: boolean; onToggle: () => void; onCountdown: (session: RaceSession) => void }) {
  const sessions = event.sessions.filter(session => !selectedDay || validDate(session.utc) && beijingDay(Date.parse(session.utc)) === selectedDay).toSorted((a, b) => (Date.parse(a.utc) || Infinity) - (Date.parse(b.utc) || Infinity))
  const headline = selectedDay ? sessions[0] : next
  const reliable = headline && confirmed(event, headline)
  return <article className={`nh-event ${expanded ? "is-expanded" : ""}`} style={{ "--row-accent": SERIES_THEME_COLORS[event.series] } as CSSProperties}>
    <button type="button" className="nh-event-summary" onClick={onToggle} aria-expanded={expanded} aria-controls={`new-event-${event.id}`}>
      <span className="nh-event-series">{event.series}<small>R{String(event.round).padStart(2, "0")}</small></span><span className="nh-event-name"><strong>{event.name}</strong><small>{headline?.name ?? "赛程待公布"} · {event.country}</small></span><span className="nh-event-when">{reliable ? <><strong>{formatTime(headline.utc, BEIJING_TZ)}</strong><small>{dayLabel.format(Date.parse(headline.utc))}</small></> : <small>{headline?.clientUploadedAt ? "时间待核验" : "时间待确认"}</small>}</span><ChevronDown size={18} className="nh-event-chevron" aria-hidden="true" />
    </button>
    <div id={`new-event-${event.id}`} className="nh-event-expansion" hidden={!expanded}>
      <div className="nh-event-location"><span>{event.circuit || event.locality}</span><Link href={`/event/${event.id}`}>完整赛事详情<ArrowUpRight size={14} aria-hidden="true" /></Link></div>
      {sessions.length === 0 && <p className="nh-pending">场次安排尚未公布。</p>}
      {sessions.map((session, index) => <div className="nh-session-row" key={`${session.utc}-${index}`}><span>{session.name}</span><span>{confirmed(event, session) ? formatDateTime(session.utc, BEIJING_TZ) : session.clientUploadedAt ? "时间待核验" : "时间待确认"}</span>{confirmed(event, session) && <button type="button" onClick={() => onCountdown(session)} aria-label={`${event.name} ${session.name} 倒计时`}><Maximize2 size={14} aria-hidden="true" />倒计时</button>}</div>)}
      {event.clientData && <p className="nh-pending">部分场次来自客户端补缺，未经独立核验的时间不会触发倒计时。</p>}
    </div>
  </article>
}
