export type F1StartPhase = 'unknown' | 'formation' | 'delayed' | 'racing' | 'finished'
export interface F1StartState {
  phase: F1StartPhase
  observedAt: string
  signalAt?: string
  reason?: string
}
function utc(value: unknown) {
  if (typeof value !== 'string') return NaN
  return Date.parse(/[Zz]|[+-]\d\d:\d\d$/.test(value) ? value : value + 'Z')
}
/** Ignore old/replayed meetings and generic green flags; only explicit start messages count. */
export function parseF1StartState(snapshot: Record<string, any>, targetMs: number, now: number): F1StartState {
  const base = { phase: 'unknown' as const, observedAt: new Date(now).toISOString() }
  const info = snapshot.SessionInfo
  const offset = info?.GmtOffset
  const offsetMatch = typeof offset === 'string' ? offset.match(/^([+-]?)(\d\d:\d\d)(?::00)?$/) : null
  const start = typeof info?.StartDate === 'string'
    ? Date.parse(/[Zz]|[+-]\d\d:\d\d$/.test(info.StartDate) ? info.StartDate : offsetMatch ? info.StartDate + (offsetMatch[1] || '+') + offsetMatch[2] : '') : NaN
  if (!Number.isFinite(start) || Math.abs(start - targetMs) > 15 * 60000 || !['Race', 'Sprint'].includes(info?.Name)) return { ...base, reason: 'session-mismatch' }
  if (['Ends', 'Finished', 'Finalised'].includes(snapshot.SessionStatus?.Status)) return { ...base, phase: 'finished' }
  const messages = Object.values(snapshot.RaceControlMessages?.Messages ?? {}) as any[]
  const signals = messages.map(m => ({ text: String(m?.Message ?? '').trim().toUpperCase(), at: utc(m?.Utc) }))
    .filter(m => Number.isFinite(m.at) && m.at >= targetMs - 15 * 60000 && m.at <= now + 5000 && now - m.at <= 10 * 60000)
    .sort((a, b) => b.at - a.at)
  for (const signal of signals) {
    let phase: F1StartPhase | undefined
    if (/^(RACE|SPRINT) START(?:ED)?$/.test(signal.text)) phase = 'racing'
    else if (/^(?:EXTRA )?FORMATION LAP(?: STARTED| START)?$/.test(signal.text)) phase = 'formation'
    else if (/^(?:START DELAYED|DELAYED START|ABORTED START|START ABORTED)$/.test(signal.text)) phase = 'delayed'
    if (phase) return { ...base, phase, signalAt: new Date(signal.at).toISOString() }
  }
  // Session status alone may refer to the session opening. Require a lap as corroboration.
  if (snapshot.SessionStatus?.Status === 'Started' && snapshot.LapCount?.CurrentLap >= 1) return { ...base, phase: 'racing' }
  return base
}

export function simulatedStartPhase(series: 'F1' | 'FE', elapsed: number, compressed = false) {
  const formationEnd = compressed ? 12 : series === 'F1' ? 90 : 20
  const blueEnd = formationEnd + (series === 'F1' ? 5 : 0)
  if (elapsed < 0) return { phase: 'waiting', lit: 0 }
  if (elapsed < formationEnd) return { phase: elapsed < (compressed ? 8 : 30) ? 'green' : 'formation', lit: 0 }
  if (elapsed < blueEnd) return { phase: 'blue', lit: 0 }
  if (elapsed < blueEnd + 5) return { phase: 'red', lit: Math.min(5, Math.floor(elapsed - blueEnd) + 1) }
  if (elapsed < blueEnd + 6.5) return { phase: 'hold', lit: 5 }
  return { phase: 'out', lit: 0 }
}
