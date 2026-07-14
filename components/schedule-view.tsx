"use client"

import { useEffect, useMemo, useState } from "react"
import useSWR from "swr"
import { CalendarDays, Clock, LoaderCircle, Radio, TriangleAlert, Trophy } from "lucide-react"
import type { RaceEvent, ScheduleResponse, Series } from "@/lib/types"
import {
  BEIJING_TZ,
  SERIES_META,
  countdown,
  formatDateTime,
  formatTime,
  isPast,
  mainSession,
} from "@/lib/format"
import { countryCodeToFlag } from "@/lib/tz"
import { EventCard } from "@/components/event-card"
import { cn } from "@/lib/utils"

const fetcher = (url: string) => fetch(url).then((r) => r.json() as Promise<ScheduleResponse>)

type SeriesFilter = "ALL" | Series
type TimeFilter = "upcoming" | "all" | "past"

const SERIES_TABS: { key: SeriesFilter; label: string }[] = [
  { key: "ALL", label: "全部" },
  { key: "F1", label: "F1" },
  { key: "WRC", label: "WRC" },
  { key: "FE", label: "FE" },
]

const TIME_TABS: { key: TimeFilter; label: string }[] = [
  { key: "upcoming", label: "即将开始" },
  { key: "all", label: "全部" },
  { key: "past", label: "已结束" },
]

/** 每 30 秒刷新的当前时间戳 */
function useNow() {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30000)
    return () => clearInterval(id)
  }, [])
  return now
}

function BeijingClock({ now }: { now: number }) {
  const iso = new Date(now).toISOString()
  return (
    <div className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2">
      <Clock className="size-4 text-primary" aria-hidden />
      <div className="leading-tight">
        <div className="text-[10px] uppercase tracking-wide text-muted-foreground">北京时间</div>
        <div className="font-mono text-sm font-semibold tabular-nums">{formatDateTime(iso, BEIJING_TZ)}</div>
      </div>
    </div>
  )
}

function NextUp({ event, now }: { event: RaceEvent; now: number }) {
  const meta = SERIES_META[event.series]
  const main = mainSession(event)
  if (!main) return null
  const c = countdown(main.utc, now)
  const flag = countryCodeToFlag(event.countryCode)

  return (
    <section
      className="relative overflow-hidden rounded-2xl border border-border bg-card p-5 sm:p-6"
      aria-label="下一场赛事"
    >
      <div
        className="absolute inset-x-0 top-0 h-1"
        style={{ backgroundColor: meta.color }}
        aria-hidden
      />
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <span
          className="rounded px-2 py-0.5 font-bold"
          style={{ backgroundColor: meta.color, color: meta.textColor }}
        >
          {meta.label}
        </span>
        <span>{meta.full}</span>
        <span>·</span>
        <span>下一场赛事</span>
      </div>

      <h2 className="mt-3 flex items-center gap-2 text-pretty text-2xl font-bold leading-tight sm:text-3xl">
        {flag ? <span aria-hidden>{flag}</span> : null}
        {event.name}
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        {event.circuit} · {event.locality}，{event.country}
      </p>

      <div className="mt-5 grid gap-4 sm:grid-cols-[auto_1fr] sm:items-end">
        <div>
          <div className="text-xs text-muted-foreground">距主赛事发车</div>
          <div className="mt-1 flex items-baseline gap-1 font-mono font-bold tabular-nums">
            {c.past ? (
              <span className="text-2xl text-primary">进行中 / 已结束</span>
            ) : (
              <>
                <TimeBlock value={c.days} unit="天" />
                <TimeBlock value={c.hours} unit="时" />
                <TimeBlock value={c.minutes} unit="分" />
              </>
            )}
          </div>
        </div>
        <div className="flex flex-col gap-1.5 text-sm sm:items-end">
          <div className="flex items-center gap-1.5">
            <Trophy className="size-4 text-primary" aria-hidden />
            <span className="font-medium">主赛事</span>
            <span className="font-mono tabular-nums">{formatDateTime(main.utc, BEIJING_TZ)}</span>
            <span className="text-muted-foreground">北京</span>
          </div>
          {event.broadcaster ? (
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Radio className="size-4 text-primary" aria-hidden />
              <span>直播：{event.broadcaster.name}</span>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  )
}

function TimeBlock({ value, unit }: { value: number; unit: string }) {
  return (
    <span className="flex items-baseline">
      <span className="text-3xl sm:text-4xl">{String(value).padStart(2, "0")}</span>
      <span className="ml-0.5 mr-2 text-sm text-muted-foreground">{unit}</span>
    </span>
  )
}

function SourceBar({ data }: { data: ScheduleResponse }) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11px] text-muted-foreground">
      <span className="font-medium text-foreground">数据来源：</span>
      {data.sources.map((s) => (
        <span key={s.series} className="flex items-center gap-1.5">
          <span
            className={cn("size-1.5 rounded-full", s.ok ? "bg-emerald-400" : "bg-destructive")}
            aria-hidden
          />
          {SERIES_META[s.series].label} · {s.label}
        </span>
      ))}
    </div>
  )
}

export function ScheduleView() {
  const now = useNow()
  const { data, error, isLoading } = useSWR("/api/schedule", fetcher, {
    revalidateOnFocus: false,
  })
  const [series, setSeries] = useState<SeriesFilter>("ALL")
  const [time, setTime] = useState<TimeFilter>("upcoming")

  const allEvents = data?.events ?? []

  const filtered = useMemo(() => {
    let list = allEvents.filter((e) => (series === "ALL" ? true : e.series === series))
    if (time === "upcoming") list = list.filter((e) => !isPast(e, now))
    else if (time === "past") list = list.filter((e) => isPast(e, now))
    return [...list].sort((a, b) => {
      const am = mainSession(a)?.utc ?? ""
      const bm = mainSession(b)?.utc ?? ""
      return am.localeCompare(bm)
    })
  }, [allEvents, series, time, now])

  const nextUp = useMemo(() => {
    const upcoming = allEvents
      .filter((e) => (series === "ALL" ? true : e.series === series))
      .filter((e) => !isPast(e, now))
      .sort((a, b) => (mainSession(a)?.utc ?? "").localeCompare(mainSession(b)?.utc ?? ""))
    return upcoming[0]
  }, [allEvents, series, now])

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-8 sm:py-10">
      {/* 页头 */}
      <header className="flex flex-col gap-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-pretty text-2xl font-bold tracking-tight sm:text-3xl">赛道时刻</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              WRC · F1 · Formula E 未来赛程 — 当地时间与北京时间双时区，含中国大陆直播提示
            </p>
          </div>
          <BeijingClock now={now} />
        </div>
        {data ? <SourceBar data={data} /> : null}
      </header>

      {/* 筛选 */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap gap-2" role="tablist" aria-label="赛事系列">
          {SERIES_TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={series === t.key}
              onClick={() => setSeries(t.key)}
              className={cn(
                "rounded-full border px-4 py-1.5 text-sm font-medium transition-colors",
                series === t.key
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card text-muted-foreground hover:text-foreground",
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2" role="tablist" aria-label="时间范围">
          {TIME_TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={time === t.key}
              onClick={() => setTime(t.key)}
              className={cn(
                "rounded-md px-3 py-1 text-xs font-medium transition-colors",
                time === t.key
                  ? "bg-secondary text-secondary-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* 加载 / 错误 */}
      {isLoading ? (
        <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
          <LoaderCircle className="size-5 animate-spin" aria-hidden />
          正在获取赛程数据…
        </div>
      ) : null}
      {error ? (
        <div className="flex items-center justify-center gap-2 rounded-lg border border-destructive/40 bg-destructive/10 py-10 text-sm text-foreground">
          <TriangleAlert className="size-5 text-destructive" aria-hidden />
          数据加载失败，请稍后重试。
        </div>
      ) : null}

      {/* 下一场高亮 */}
      {!isLoading && nextUp && time !== "past" ? <NextUp event={nextUp} now={now} /> : null}

      {/* 列表 */}
      {!isLoading && !error ? (
        <section className="flex flex-col gap-3" aria-label="赛程列表">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <CalendarDays className="size-4" aria-hidden />
            共 {filtered.length} 场赛事
          </div>
          {filtered.length === 0 ? (
            <p className="rounded-lg border border-border bg-card px-4 py-10 text-center text-sm text-muted-foreground">
              当前筛选条件下暂无赛事。
            </p>
          ) : (
            filtered.map((e) => <EventCard key={e.id} event={e} now={now} />)
          )}
        </section>
      ) : null}

      <footer className="mt-4 border-t border-border pt-4 text-[11px] leading-relaxed text-muted-foreground">
        <p>
          时间说明：F1 与 Formula E 场次时间来自官方公开接口并换算为北京时间（UTC+8）；WRC
          为官方公布赛历，各赛段具体发车时间以官方 itinerary 为准（标有
          <TriangleAlert className="mx-0.5 inline size-3" aria-hidden />
          的为估计时间）。转播信息仅供参考，请以对应平台节目单为准。
        </p>
      </footer>
    </div>
  )
}
