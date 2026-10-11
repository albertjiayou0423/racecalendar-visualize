import type { RaceEvent } from "./types"
import { isEstimatedWrcSession } from "./session-time"

const escapeText = (text: string) => text.replace(/\\/g, "\\\\").replace(/\r\n|\r|\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;")
const timestamp = (date: Date) => date.toISOString().replace(/[-:]/g, "").slice(0, 15) + "Z"
function fold(line: string) {
  const parts: string[] = []
  let segment = ""
  let bytes = 0
  for (const char of line) {
    const length = new TextEncoder().encode(char).length
    if (bytes + length > 75) { parts.push(segment); segment = " "; bytes = 1 }
    segment += char; bytes += length
  }
  parts.push(segment)
  return parts.join("\r\n")
}
export function buildRaceCalendar(event: RaceEvent, now = new Date()): string | null {
  const main = event.sessions.find(session => session.isMain) ?? event.sessions.at(-1)
  if (!main || isEstimatedWrcSession(event, main) || !Number.isFinite(Date.parse(main.utc))) return null
  const start = new Date(main.utc)
  return ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//RaceCalendar//CN", "CALSCALE:GREGORIAN", "BEGIN:VEVENT",
    `UID:${escapeText(event.id)}@racecalendar`, `DTSTAMP:${timestamp(now)}`,
    `SUMMARY:${escapeText(`${event.name} - ${event.series}`)}`, `DTSTART:${timestamp(start)}`,
    `DTEND:${timestamp(new Date(start.getTime() + 2 * 60 * 60 * 1000))}`,
    `LOCATION:${escapeText(`${event.circuit}, ${event.locality}, ${event.country}`)}`,
    `DESCRIPTION:${escapeText(`${event.name} - ${event.series} 第${event.round}站`)}`,
    "END:VEVENT", "END:VCALENDAR", ""].map(fold).join("\r\n")
}
