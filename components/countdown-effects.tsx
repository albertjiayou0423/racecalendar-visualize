import type { CSSProperties } from 'react'

export function CountdownEntrance({ frameMs = -1 }: { frameMs?: number }) {
  return <div className="race-entry-wave" aria-hidden="true" style={frameMs >= 0 ? { animationPlayState: 'paused', animationDelay: `${-frameMs}ms` } : undefined}><svg viewBox="0 0 1440 80" preserveAspectRatio="none"><path d="M0 45 Q360 -20 720 40 T1440 35 V80 H0Z" fill="currentColor" /></svg></div>
}

export function CountdownImpact({ frameMs = -1 }: { frameMs?: number }) {
  return <div className={`race-launch-burst ${frameMs >= 0 ? 'is-frame' : ''}`} style={frameMs >= 0 ? { '--launch-frame': `${frameMs}ms` } as CSSProperties : undefined} aria-hidden="true"><i /><i /><i /></div>
}

export function CountdownFinalPulse({ frameMs = -1 }: { frameMs?: number }) {
  return <div className="rally-prestart-pulse" style={frameMs >= 0 ? { animationPlayState: 'paused', animationDelay: `${-frameMs}ms` } : undefined} aria-hidden="true" />
}
