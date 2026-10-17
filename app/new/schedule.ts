import type { RaceEvent, RaceSession, ScheduleResponse } from "@/lib/types"
import { mergeScheduleWithClientCache, parseClientScheduleCache, scheduleFromClientCache } from "@/lib/client-schedule-cache"

export function readNewHomeCache() {
  try {
    const cache = parseClientScheduleCache(localStorage.getItem("schedule-cache-v2")) ?? parseClientScheduleCache(localStorage.getItem("schedule-cache"))
    return cache && Object.values(cache.series).some(entry => entry && entry.events.length > 0) ? cache : null
  } catch { return null }
}

export async function fetchNewHomeSchedule(url: string): Promise<ScheduleResponse> {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(20000) })
    if (!response.ok) throw new Error("赛历暂时无法更新")
    const data = await response.json() as ScheduleResponse
    if (!Array.isArray(data.events) || !Array.isArray(data.sources) || typeof data.fetchedAt !== "string") throw new Error("赛历数据暂不可用")
    const merged = mergeScheduleWithClientCache(data, readNewHomeCache())
    try { localStorage.setItem("schedule-cache-v2", JSON.stringify(merged.cache)) } catch { /* Read-only storage. */ }
    return merged.response
  } catch (error) {
    const cache = readNewHomeCache()
    if (cache) return scheduleFromClientCache(cache, true)
    throw error
  }
}

export function confirmed(event: RaceEvent, session: RaceSession) {
  return Number.isFinite(Date.parse(session.utc)) && !(session.tentative ?? event.tentative ?? false) && !session.clientUploadedAt
}

export function upcomingSession(event: RaceEvent, now: number) {
  return event.sessions.filter(session => Number.isFinite(Date.parse(session.utc)) && Date.parse(session.utc) >= now)
    .toSorted((a, b) => Date.parse(a.utc) - Date.parse(b.utc))[0]
}

export function beijingDay(time: number) {
  return new Date(time + 8 * 3600000).toISOString().slice(0, 10)
}

export function nextConfirmed(events: RaceEvent[], now: number) {
  return events.flatMap(event => event.sessions.filter(session => confirmed(event, session) && Date.parse(session.utc) >= now).map(session => ({ event, session })))
    .sort((a, b) => Date.parse(a.session.utc) - Date.parse(b.session.utc))[0]
}
