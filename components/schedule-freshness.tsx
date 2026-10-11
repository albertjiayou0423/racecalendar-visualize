"use client"
import { useEffect, useState } from "react"
import Link from "next/link"
import type { ScheduleResponse } from "@/lib/types"
import { formatDateTime, BEIJING_TZ } from "@/lib/format"
import { observeSessions, compareSchedules, type ScheduleChange } from "@/lib/schedule-changes"
const KEY = "racecalendar:time-history:v1"
export function ScheduleFreshness({ data, now }: { data: ScheduleResponse; now: number }) {
  const [changes, setChanges] = useState<ScheduleChange[]>([])
  useEffect(() => {
    const sessions = observeSessions(data.events)
    try {
      const previous = JSON.parse(localStorage.getItem(KEY) || "null")
      const history = compareSchedules(sessions, previous)
      setChanges(history)
      if (!data.offline) localStorage.setItem(KEY, JSON.stringify({ sessions, changes: history }))
    } catch { /* Storage is optional. */ }
  }, [data])
  const label = (time: string) => Number.isFinite(Date.parse(time)) ? formatDateTime(time, BEIJING_TZ) : "时间待确认"
  return <details className="rounded-xl border border-border bg-card p-4"><summary className="cursor-pointer text-xs text-muted-foreground">数据更新时间{data.offline ? " · 离线缓存" : ""}{changes.length ? ` · ${changes.length} 条时间变更` : ""}</summary><ul className="mt-3 space-y-2">{data.sources.map(source => {
    const age = source.updatedAt ? now - Date.parse(source.updatedAt) : NaN
    return <li key={source.series} className="text-xs"><span className="font-medium">{source.series}</span> · {Number.isFinite(age) ? `${Math.max(0, Math.floor(age / 60000))} 分钟前更新` : "更新时间未知"}{Number.isFinite(age) && age > 6 * 3600000 && <span className="ml-2 text-amber-500">数据可能过期</span>}<p className="mt-1 text-muted-foreground">{source.label}{source.updatedAt ? ` · ${label(source.updatedAt)}` : ""}</p></li>
  })}</ul><p className="mt-3 text-xs text-muted-foreground">变更记录仅比较本浏览器两次访问的场次时间，不代表完整官方变更历史。</p>{changes.map((change, i) => <div key={`${change.eventId}:${i}`} className="mt-3 border-t border-border pt-3 text-xs"><Link href={`/event/${change.eventId}`} className="font-medium hover:underline">{change.eventName} · {change.session}</Link><p className="mt-1 text-muted-foreground"><del>{label(change.before)}</del> → {label(change.after)}</p></div>)}</details>
}
