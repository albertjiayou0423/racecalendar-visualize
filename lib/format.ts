import type { RaceEvent, Series } from "./types"

export const BEIJING_TZ = "Asia/Shanghai"

const WEEKDAYS = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"]

/** 在指定时区里取出年月日时分与星期几 */
function partsInZone(utc: string, timeZone: string) {
  const date = new Date(utc)
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    weekday: "short",
  })
  const map = dtf.formatToParts(date).reduce<Record<string, string>>((acc, p) => {
    if (p.type !== "literal") acc[p.type] = p.value
    return acc
  }, {})
  // 通过 UTC 偏移计算真实星期几，避免依赖 locale 文本
  const offsetMin = Math.round(
    (Date.UTC(
      Number(map.year),
      Number(map.month) - 1,
      Number(map.day),
      Number(map.hour),
      Number(map.minute),
    ) -
      date.getTime()) /
      60000,
  )
  const localMs = date.getTime() + offsetMin * 60000
  const weekday = WEEKDAYS[new Date(localMs).getUTCDay()]
  return {
    year: Number(map.year),
    month: Number(map.month),
    day: Number(map.day),
    hour: map.hour,
    minute: map.minute,
    weekday,
    offsetMin,
  }
}

/** 格式化为 "HH:mm" */
export function formatTime(utc: string, timeZone: string): string {
  const p = partsInZone(utc, timeZone)
  return `${p.hour}:${p.minute}`
}

/** 格式化为 "M月D日 周X HH:mm" */
export function formatDateTime(utc: string, timeZone: string): string {
  const p = partsInZone(utc, timeZone)
  return `${p.month}月${p.day}日 ${p.weekday} ${p.hour}:${p.minute}`
}

/** 格式化为 "M月D日 周X" */
export function formatDate(utc: string, timeZone: string): string {
  const p = partsInZone(utc, timeZone)
  return `${p.month}月${p.day}日 ${p.weekday}`
}

/** 生成如 "UTC+9" 的偏移标签 */
export function offsetLabel(utc: string, timeZone: string): string {
  const { offsetMin } = partsInZone(utc, timeZone)
  if (offsetMin === 0) return "UTC"
  const sign = offsetMin > 0 ? "+" : "-"
  const abs = Math.abs(offsetMin)
  const h = Math.floor(abs / 60)
  const m = abs % 60
  return `UTC${sign}${h}${m ? `:${String(m).padStart(2, "0")}` : ""}`
}

/** 事件的主赛事场次（正赛 / 决胜赛段），没有则取最后一个 */
export function mainSession(event: RaceEvent) {
  return event.sessions.find((s) => s.isMain) ?? event.sessions[event.sessions.length - 1]
}

/** 事件的首个场次 */
export function firstSession(event: RaceEvent) {
  return event.sessions[0]
}

/** 事件是否已结束（所有场次都已结束） */
export function isPast(event: RaceEvent, now: number): boolean {
  const last = event.sessions[event.sessions.length - 1]
  if (!last) return true
  const end = new Date(last.utc).getTime() + 2 * 60 * 60 * 1000
  return end < now
}

/** 事件是否正在进行中（当前时间在某个场次的开始和结束之间） */
export function isLive(event: RaceEvent, now: number): boolean {
  return event.sessions.some((s) => {
    const start = new Date(s.utc).getTime()
    const end = start + 2 * 60 * 60 * 1000
    return now >= start && now <= end
  })
}

export function isOngoing(event: RaceEvent, now: number): boolean {
  return isLive(event, now)
}

export function isUpcoming(event: RaceEvent, now: number): boolean {
  if (!event.sessions || event.sessions.length === 0) return false
  const first = event.sessions[0]
  if (!first) return false
  return now < new Date(first.utc).getTime()
}

/** 倒计时：返回天/时/分/秒，以及是否进行中/已过 */
export function countdown(utc: string, now: number) {
  const diff = new Date(utc).getTime() - now
  const past = diff <= 0
  const abs = Math.abs(diff)
  const days = Math.floor(abs / 86400000)
  const hours = Math.floor((abs % 86400000) / 3600000)
  const minutes = Math.floor((abs % 3600000) / 60000)
  const seconds = Math.floor((abs % 60000) / 1000)
  return { days, hours, minutes, seconds, past }
}

export const SERIES_META: Record<
  Series,
  { label: string; full: string; color: string; textColor: string }
> = {
  F1: { label: "F1", full: "一级方程式", color: "var(--f1)", textColor: "var(--f1-foreground)" },
  WRC: { label: "WRC", full: "世界拉力锦标赛", color: "var(--wrc)", textColor: "var(--wrc-foreground)" },
  FE: { label: "FE", full: "电动方程式", color: "var(--fe)", textColor: "var(--fe-foreground)" },
}
