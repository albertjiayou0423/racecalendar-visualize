import type { RaceEvent } from './types'
export function countdownCandidate(events: RaceEvent[], now: number) {
  return events.flatMap(event => {
    // Pick the earliest stage before testing the current trigger window: later
    // stages must not become automatic candidates once SS1 has started.
    const sessions = event.series === 'WRC'
      ? event.sessions.filter(s => Number.isFinite(Date.parse(s.utc))).toSorted((a, b) => Date.parse(a.utc) - Date.parse(b.utc)).slice(0, 1)
      : event.sessions
    return sessions.map(session => ({ event, session }))
  })
    .filter(({ event, session }) => {
      const delta = Date.parse(session.utc) - now
      const afterStartWindow = session.isMain && event.series !== 'WRC' ? (event.series === 'F1' ? 120_000 : 30_000) : 0
      return (delta > 0 || (afterStartWindow > 0 && delta >= -afterStartWindow)) && delta <= 30_000 && !(session.tentative ?? event.tentative ?? false) && !session.clientUploadedAt
    }).sort((a, b) => Date.parse(a.session.utc) - Date.parse(b.session.utc))[0]
}
export function countdownKey(event: RaceEvent, utc: string) { return `race-countdown:${event.id}:${utc}` }
