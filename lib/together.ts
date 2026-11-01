import type { RaceEvent, RaceSession } from "@/lib/types"
import { isTimeUnconfirmed } from "@/lib/session-time"

/** The next future session with a verified, usable start time. */
export function nextConfirmedSession(event: RaceEvent, now = Date.now()): RaceSession | null {
  return [...event.sessions]
    .filter((session) => {
      const time = Date.parse(session.utc)
      return Number.isFinite(time) && time > now && !isTimeUnconfirmed(event, session)
    })
    .sort((a, b) => Date.parse(a.utc) - Date.parse(b.utc))[0] ?? null
}
