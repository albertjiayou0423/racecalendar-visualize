import type { RaceEvent, RaceSession } from './types'

export function timelineDays(event: RaceEvent) {
  const pending: RaceSession[] = []
  const sorted = event.sessions.filter(session => {
    if (!Number.isFinite(Date.parse(session.utc)) || (event.series === 'WRC' && (session.tentative ?? event.tentative ?? false))) { pending.push(session); return false }
    return true
  }).toSorted((a, b) => Date.parse(a.utc) - Date.parse(b.utc))
  const days: { key: string; sessions: RaceSession[] }[] = []
  for (const session of sorted) {
    const key = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(session.utc))
    const last = days.at(-1)
    if (last?.key === key) last.sessions.push(session)
    else days.push({ key, sessions: [session] })
  }
  if (pending.length) days.push({ key: 'pending', sessions: pending })
  return days
}

