import type { RaceEvent } from './types'
export function countdownCandidate(events: RaceEvent[], now: number) {
  return events.flatMap(event => event.sessions.map(session => ({ event, session })))
    .filter(({ event, session }) => {
      const delta = Date.parse(session.utc) - now
      return delta > 0 && delta <= 30_000 && !(session.tentative ?? event.tentative ?? false) && !session.clientUploadedAt
    }).sort((a, b) => Date.parse(a.session.utc) - Date.parse(b.session.utc))[0]
}
export function countdownKey(event: RaceEvent, utc: string) { return `race-countdown:${event.id}:${utc}` }
