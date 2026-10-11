import type { RaceEvent } from "./types"
import { isEstimatedWrcSession } from "./session-time"
const escape = (s: string) => s.replace(/\\/g, "\\\\").replace(/\r\n|\r|\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;")
const stamp = (date: Date) => date.toISOString().replace(/[-:]/g, "").slice(0, 15) + "Z"
function fold(line: string) {
  let result = "", bytes = 0
  for (const char of line) { const size = new TextEncoder().encode(char).length; if (bytes + size > 75) { result += "\r\n "; bytes = 1 }; result += char; bytes += size }
  return result
}
export function buildSubscriptionCalendar(events: RaceEvent[], allSessions: boolean, modified: Date) {
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//RaceCalendar//CN", "CALSCALE:GREGORIAN", "X-WR-CALNAME:赛道时刻", "REFRESH-INTERVAL;VALUE=DURATION:PT1H", "X-PUBLISHED-TTL:PT1H"]
  for (const event of [...events].sort((a, b) => a.id.localeCompare(b.id))) {
    const main = event.sessions.find(s => s.isMain) ?? event.sessions.at(-1)
    const occurrences = new Map<string, number>()
    for (const session of event.sessions) {
      const number = occurrences.get(session.name) || 0; occurrences.set(session.name, number + 1)
      if ((!allSessions && session !== main) || session.tentative || isEstimatedWrcSession(event, session) || !Number.isFinite(Date.parse(session.utc))) continue
      const start = new Date(session.utc)
      // Name + occurrence stays stable when UTC is corrected or sessions are reordered.
      const uid = allSessions ? `${event.id}:${encodeURIComponent(session.name)}:${number}` : event.id
      lines.push("BEGIN:VEVENT", `UID:${uid}@racecalendar`, `DTSTAMP:${stamp(modified)}`, `LAST-MODIFIED:${stamp(modified)}`, `SUMMARY:${escape(`${event.name} · ${allSessions ? session.name : event.series}`)}`, `DTSTART:${stamp(start)}`, `DTEND:${stamp(new Date(start.getTime() + (session.isMain ? 2 : 1) * 3600000))}`, `LOCATION:${escape(`${event.circuit}, ${event.locality}`)}`, `DESCRIPTION:${escape(`${event.series} 第${event.round}站；时间调整由日历客户端同步，请以官方信息为准。`)}`, "END:VEVENT")
    }
  }
  return [...lines, "END:VCALENDAR", ""].map(fold).join("\r\n")
}
