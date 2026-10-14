"use client"
import { useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
import type { RaceEvent } from '@/lib/types'
import { countdownCandidate, countdownKey } from '@/lib/countdown-entry'
import { ImmersiveCountdown } from './immersive-countdown'
export function CountdownAutoEntry({ events, now }: { events: RaceEvent[]; now: number }) {
  const pathname = usePathname()
  const seen = useRef(new Set<string>())
  const [active, setActive] = useState<ReturnType<typeof countdownCandidate>>()
  useEffect(() => {
    if (pathname !== '/' || active || document.visibilityState !== 'visible' || document.querySelector('[aria-modal="true"]')) return
    const candidate = countdownCandidate(events, now)
    if (!candidate) return
    const key = countdownKey(candidate.event, candidate.session.utc)
    if (seen.current.has(key)) return
    try { if (sessionStorage.getItem(key)) return } catch { /* Storage disabled. */ }
    seen.current.add(key)
    try { sessionStorage.setItem(key, '1') } catch { /* In-memory guard remains. */ }
    setActive(candidate)
  }, [events, now, pathname, active])
  if (!active || pathname !== '/') return null
  return <ImmersiveCountdown targetTime={active.session.utc} series={active.event.series} title={`${active.event.name} · ${active.session.name}`} onClose={() => setActive(undefined)} />
}
