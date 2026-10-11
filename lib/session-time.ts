import type { RaceEvent, RaceSession } from "./types"

/** A session explicitly marked confirmed overrides an event-wide estimate flag. */
export function isEstimatedWrcSession(event: Pick<RaceEvent, "series" | "tentative">, session: RaceSession): boolean {
  return event.series === "WRC" && (session.tentative ?? event.tentative ?? false)
}
