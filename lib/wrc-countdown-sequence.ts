import type { RaceEvent, RaceSession } from './types'

/** Stay within this rally and never turn estimated/unverified data into a countdown. */
export function nextWrcCountdown(event: RaceEvent, current: RaceSession, now: number) {
  const currentMs = Date.parse(current.utc)
  if (event.series !== 'WRC' || !Number.isFinite(currentMs) || !Number.isFinite(now)) return undefined
  return event.sessions
    .filter(session => {
      const at = Date.parse(session.utc)
      return Number.isFinite(at) && at > currentMs && at > now && !(session.tentative ?? event.tentative ?? false) && !session.clientUploadedAt
    })
    .toSorted((a, b) => Date.parse(a.utc) - Date.parse(b.utc))[0]
}
