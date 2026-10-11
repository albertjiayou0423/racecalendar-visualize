import type { RaceEvent } from "./types"
export type ScheduleChange = { eventId: string; eventName: string; session: string; before: string; after: string }
type Observed = { key: string; eventId: string; eventName: string; session: string; time: string }
export function observeSessions(events: RaceEvent[]): Observed[] {
  return events.flatMap(event => event.sessions.map((session, i) => ({ key: `${event.id}:${session.name}:${event.sessions.slice(0, i).filter(s => s.name === session.name).length}`, eventId: event.id, eventName: event.name, session: session.name, time: session.tentative || (event.series === "WRC" && (session.tentative ?? event.tentative)) || !Number.isFinite(Date.parse(session.utc)) ? "时间待确认" : new Date(session.utc).toISOString() })))
}
export function compareSchedules(current: Observed[], previous: unknown): ScheduleChange[] {
  const value = previous as { sessions?: Observed[]; changes?: ScheduleChange[] } | null
  const old = new Map((Array.isArray(value?.sessions) ? value.sessions : []).filter(s => s && typeof s.key === "string" && typeof s.time === "string").map(s => [s.key, s.time]))
  const detected = current.filter(s => old.has(s.key) && old.get(s.key) !== s.time).map(s => ({ eventId: s.eventId, eventName: s.eventName, session: s.session, before: old.get(s.key)!, after: s.time }))
  const history = (Array.isArray(value?.changes) ? value.changes : []).filter(s => s && [s.eventId, s.eventName, s.session, s.before, s.after].every(v => typeof v === "string"))
  return [...detected, ...history].slice(0, 20)
}
