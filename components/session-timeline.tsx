"use client"
import { useMemo, useState, useId } from "react"
import { Clock } from "lucide-react"
import type { RaceEvent } from "@/lib/types"
import { BEIJING_TZ, countdown, formatDateTime, formatDate, formatTime } from "@/lib/format"
import { timelineDays } from "@/lib/timeline"
import { cn } from "@/lib/utils"
import { WeatherStrip } from "@/components/weather-strip"

export function SessionTimeline({ event, now }: { event: RaceEvent; now: number }) {
  const days = useMemo(() => timelineDays(event), [event.sessions, event.series, event.tentative])
  const [selected, setSelected] = useState<string | null>(null)
  const panelId = useId()
  const confirmed = days.filter(day => day.key !== 'pending').flatMap(day => day.sessions)
  const next = confirmed.find(session => Date.parse(session.utc) > now)
  const nextDay = days.find(day => next && day.sessions.includes(next))
  const day = days.find(day => day.key === selected) ?? nextDay ?? days[0]
  if (!day) return null
  const pending = day.key === 'pending'
  const first = Date.parse(day.sessions[0].utc)
  const last = Date.parse(day.sessions.at(-1)!.utc)
  const c = next ? countdown(next.utc, now) : null
  const following = days[days.indexOf(day) + 1]
  return <section className="mt-4 rounded-xl border border-border bg-card p-4 sm:p-5" aria-label="赛程时间线">
    <div className="flex items-center justify-between"><h2 className="text-sm font-semibold">赛程时间线</h2><span className="text-xs text-muted-foreground">北京时间</span></div>
    {next && c && <div className="mt-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-border/50 pb-3">
      <p className="flex items-center gap-1.5 text-xs text-primary"><Clock className="size-3.5" />下一赛段</p>
      <p className="break-words text-xs font-medium">{next.name}</p>
      <p className="text-xs text-muted-foreground">{formatDateTime(next.utc, BEIJING_TZ)}</p>
      <p className="font-mono text-xs tabular-nums">{c.days > 0 ? `${c.days}天 ${c.hours}小时` : `${c.hours}时 ${c.minutes}分 ${c.seconds}秒`}后开始</p>
      {day !== nextDay && <button type="button" onClick={() => setSelected(nextDay!.key)} className="mt-2 min-h-8 text-xs text-primary">查看当天安排</button>}
    </div>}
    <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label="选择比赛日">{days.map(item => <button key={item.key} type="button" aria-pressed={item === day} aria-controls={panelId} onClick={() => setSelected(item.key)} className={cn('min-h-10 rounded-full border px-3 py-2 text-xs transition-colors motion-reduce:transition-none', item === day ? 'border-primary/30 bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:bg-secondary')}>
      {item.key === 'pending' ? '时间待确认' : formatDate(item.sessions[0].utc, BEIJING_TZ)}<span className="ml-2 opacity-70">{item.sessions.length}场</span>
    </button>)}</div>
    <div id={panelId} className="mt-4">
      {pending ? <p className="text-xs text-muted-foreground">估计或缺失的赛段时间待确认，以官方行程为准。</p> : <div className="hidden sm:block">
        <p className="mb-2 text-[11px] text-muted-foreground">当天开赛分布</p>
        <div className="relative mx-2 h-5"><div className="absolute inset-x-0 top-2 h-2 rounded-full bg-muted" />{day.sessions.map((session, index) => <span key={index} title={`${session.name} · ${formatTime(session.utc, BEIJING_TZ)}`} className={cn('absolute top-1.5 h-3 w-1.5 -translate-x-1/2 rounded-full', session === next ? 'bg-primary ring-4 ring-primary/10' : 'bg-blue-500/70')} style={{ left: `${last === first ? 50 : (Date.parse(session.utc) - first) / (last - first) * 100}%` }} />)}</div>
        <div className="flex justify-between font-mono text-[11px] text-muted-foreground"><span>{formatTime(day.sessions[0].utc, BEIJING_TZ)}</span><span>{formatTime(day.sessions.at(-1)!.utc, BEIJING_TZ)}</span></div>
      </div>}
      <ol className="mt-4 sm:flex sm:gap-3 sm:overflow-x-auto sm:pb-2 sm:snap-x sm:snap-proximity" style={{ scrollbarWidth: "thin" }}>{day.sessions.map((session, index) => <li key={`${session.name}-${index}`} className={cn('grid grid-cols-[4rem_1fr] gap-3 border-b border-border/50 py-3 last:border-b-0 sm:flex sm:w-48 sm:shrink-0 sm:snap-start sm:flex-col-reverse sm:justify-between sm:gap-4 sm:rounded-xl sm:border sm:border-border/70 sm:p-3 sm:last:border-b', session === next && 'rounded-lg border-primary/30 bg-primary/5 px-2 sm:shadow-sm', !pending && Date.parse(session.utc) <= now && 'text-muted-foreground')}>
        <span className="pt-0.5 font-mono text-sm tabular-nums">{pending ? '待定' : formatTime(session.utc, BEIJING_TZ)}</span>
        <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><span className="break-words text-sm font-medium">{session.name}</span>{session.isMain && <span className="text-[10px] text-primary">主赛段</span>}</div>
          <p className="mt-1 text-xs text-muted-foreground">{pending ? '时间待确认' : session === next ? '下一赛段' : Date.parse(session.utc) <= now ? '已开始' : '未开始'}{!pending && session.tentative && ' · 时间待确认'}</p>
          {!pending && event.tz !== BEIJING_TZ && <p className="mt-1 text-[11px] text-muted-foreground sm:text-[10px]">{formatDateTime(session.utc, event.tz)} · 当地</p>}
        </div>
      </li>)}</ol>
      {!pending && following && following.key !== 'pending' && <p className="mt-3 text-xs text-muted-foreground">当天赛段结束后休赛，下一比赛日为 {formatDate(following.sessions[0].utc, BEIJING_TZ)}。</p>}
      {!pending && <div className="mt-4 border-t border-border/50 pt-3"><p className="mb-2 text-xs text-muted-foreground">当天赛段天气</p><WeatherStrip city={event.locality} country={event.country} lat={event.lat} lon={event.lon} sessions={day.sessions} /></div>}
    </div>
  </section>
}
