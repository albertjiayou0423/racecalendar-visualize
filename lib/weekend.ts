import type { RaceEvent, Series } from "./types"
import { isEstimatedWrcSession } from "./session-time"

/** Friday through Monday-exclusive in Beijing; Monday-Thursday selects the coming weekend. */
export function weekendRange(now: number, offset = 0) {
  const date = new Date(now + 8 * 3600000)
  const day = date.getUTCDay()
  const delta = day === 0 ? -2 : day >= 5 ? 5 - day : 5 - day
  const friday = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + delta + offset * 7) - 8 * 3600000
  return { start: friday, end: friday + 3 * 86400000 }
}
export function weekendSessions(events: RaceEvent[], now: number, series: Series[], offset = 0) {
  const range = weekendRange(now, offset)
  const rows = events.filter(e => series.includes(e.series)).flatMap(event => event.sessions.flatMap((session, index) => {
    const start = Date.parse(session.utc)
    if (!Number.isFinite(start) || start < range.start || start >= range.end) return []
    const estimated = isEstimatedWrcSession(event, session) || session.tentative === true
    return [{
      id: `${event.id}:${index}`, event, session, start, estimated,
      end: start + (session.isMain ? 2 : 1) * 3600000
    }]
  })).sort((a, b) => a.start - b.start || a.id.localeCompare(b.id))
  return rows.map(row => ({ ...row, conflicts: row.estimated ? [] : rows.filter(other => !other.estimated && other.event.id !== row.event.id && other.start < row.end && row.start < other.end).map(other => other.id) }))
}
