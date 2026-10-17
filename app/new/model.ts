import type { RaceEvent, RaceSession, Series } from "@/lib/types"

export type ViewMode = "list" | "week" | "month"
export type Filters = { series: "ALL" | Series; query: string; time: "upcoming" | "all" | "past"; region: string; circuit: string; favorites: boolean }
export const DEFAULT_FILTERS: Filters = { series: "ALL", query: "", time: "upcoming", region: "all", circuit: "all", favorites: false }
export type StartSelection = { event: RaceEvent; session: RaceSession; entrance?: boolean }
export const validTime = (session: RaceSession) => Number.isFinite(Date.parse(session.utc))
export const isConfirmed = (event: RaceEvent, session: RaceSession) => validTime(session) && !(session.tentative ?? event.tentative ?? false) && !session.clientUploadedAt
export const dayKey = (milliseconds: number) => new Date(milliseconds + 28800000).toISOString().slice(0, 10)
export const dayStart = (key: string) => Date.parse(`${key}T00:00:00+08:00`)
export function sessionsByTime(event: RaceEvent) {
  return [...event.sessions].sort((a, b) => (validTime(a) ? Date.parse(a.utc) : Infinity) - (validTime(b) ? Date.parse(b.utc) : Infinity))
}
export function eventEnd(event: RaceEvent) {
  const times = event.sessions.filter(validTime).map(session => Date.parse(session.utc) + 7200000)
  return times.length ? Math.max(...times) : Infinity
}
export function eventSession(event: RaceEvent, now: number) {
  const sessions = sessionsByTime(event)
  return sessions.find(session => validTime(session) && Date.parse(session.utc) >= now) ?? sessions.filter(validTime).at(-1) ?? sessions[0]
}
export function filterEvents(events: RaceEvent[], filters: Filters, favoriteIds: string[], now: number) {
  const query = filters.query.trim().toLowerCase()
  return events.filter(event => (filters.series === "ALL" || filters.series === event.series)
    && (!query || `${event.name} ${event.country} ${event.locality} ${event.circuit}`.toLowerCase().includes(query))
    && (filters.region === "all" || event.region === filters.region)
    && (filters.circuit === "all" || event.circuitType === filters.circuit)
    && (!filters.favorites || favoriteIds.includes(event.id))
    && (filters.time === "all" || (filters.time === "past" ? eventEnd(event) < now : eventEnd(event) >= now)))
    .sort((a, b) => {
      const time = (event: RaceEvent) => { const session = eventSession(event, now); return session && validTime(session) ? Date.parse(session.utc) : Infinity }
      return filters.time === "past" ? time(b) - time(a) : time(a) - time(b)
    })
}
export function nextStart(events: RaceEvent[], now: number): StartSelection | undefined {
  return events.flatMap(event => event.sessions.filter(session => isConfirmed(event, session) && Date.parse(session.utc) > now).map(session => ({ event, session })))
    .sort((a, b) => Date.parse(a.session.utc) - Date.parse(b.session.utc))[0]
}
export function dayEvents(events: RaceEvent[], key: string) {
  return events.filter(event => event.sessions.some(session => validTime(session) && dayKey(Date.parse(session.utc)) === key))
}
export function calendarDays(anchor: string, view: "week" | "month") {
  const current = new Date(`${anchor}T00:00:00Z`)
  if (view === "month") current.setUTCDate(1)
  current.setUTCDate(current.getUTCDate() - (current.getUTCDay() + 6) % 7)
  return Array.from({ length: view === "week" ? 7 : 42 }, (_, index) => dayKey(current.getTime() + index * 86400000))
}
export function shiftedAnchor(anchor: string, view: "week" | "month", direction: number) {
  const current = new Date(`${anchor}T00:00:00Z`)
  if (view === "week") current.setUTCDate(current.getUTCDate() + direction * 7)
  else { current.setUTCDate(1); current.setUTCMonth(current.getUTCMonth() + direction) }
  return dayKey(current.getTime())
}
