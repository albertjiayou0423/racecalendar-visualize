import type { RaceEvent, RaceSession } from "./types"

const estimated = (event: RaceEvent, session: RaceSession) => session.tentative ?? event.tentative ?? false
function key(session: RaceSession): string {
  const number = session.name.match(/\bSS\s*0*(\d+)\b/i)?.[1]
  if (number) return `ss:${Number(number)}`
  if (/shakedown/i.test(session.name)) return "shakedown"
  return session.name.toLowerCase().replace(/\s+/g, " ").trim()
}

/** Never replace confirmed snapshot times with estimates; fresh confirmed times win. */
export function mergeWrcSnapshotEvents(incoming: readonly RaceEvent[], previous: readonly RaceEvent[]): { events: RaceEvent[]; retainedSessions: number } {
  const oldEvents = new Map(previous.filter(event => event.series === "WRC").map(event => [event.id, event]))
  let retainedSessions = 0
  const events = incoming.map(event => {
    const old = oldEvents.get(event.id)
    if (event.series !== "WRC" || !old) return event
    const known = old.sessions.filter(session => !estimated(old, session) && Number.isFinite(Date.parse(session.utc)))
    if (!known.length) return event
    const whollyEstimated = event.sessions.every(session => estimated(event, session))
    if (whollyEstimated && known.length === old.sessions.length) {
      retainedSessions += known.length
      return { ...event, sessions: known.map(session => ({ ...session, tentative: false })), tentative: false, url: old.url || event.url }
    }
    const byKey = new Map<string, RaceSession[]>()
    for (const session of known) {
      const list = byKey.get(key(session)) || []
      list.push(session)
      byKey.set(key(session), list)
    }
    const sessions = event.sessions.map(session => {
      const matches = byKey.get(key(session))
      if (!estimated(event, session) || matches?.length !== 1) return { ...session }
      retainedSessions++
      return { ...matches[0], tentative: false }
    })
    if (whollyEstimated) {
      const included = new Set(sessions.map(key))
      for (const session of known) if (!included.has(key(session))) {
        sessions.push({ ...session, tentative: false })
        included.add(key(session))
        retainedSessions++
      }
    }
    sessions.sort((a, b) => a.utc.localeCompare(b.utc))
    return { ...event, sessions, tentative: sessions.some(session => estimated(event, session)) }
  })
  return { events, retainedSessions }
}
