import type { RaceEvent, RaceSession } from "./types"

/** A session explicitly marked confirmed overrides an event-wide estimate flag. */
export function isEstimatedWrcSession(event: Pick<RaceEvent, "series" | "tentative">, session: RaceSession): boolean {
  return event.series === "WRC" && (session.tentative ?? event.tentative ?? false)
}

/** The session has a date but its exact start time is not confirmed. */
export function isTimeUnconfirmed(event: Pick<RaceEvent, "series" | "tentative">, session: RaceSession): boolean {
  return isEstimatedWrcSession(event, session) || (session.tentative ?? event.tentative ?? false) || !!session.clientUploadedAt
}
