"use client"

import { useEffect, useRef, useState, type ReactNode } from 'react'
import type { RaceEvent, RaceSession } from '@/lib/types'
import { IMMERSION_MOTION } from '@/lib/immersion-motion'
import { nextWrcCountdown } from '@/lib/wrc-countdown-sequence'
import { ImmersiveCountdown } from './immersive-countdown'

/** Opening chooses the first stage; subsequent ticks do not replace an active ceremony. */
export function WrcCountdownSequence({ event, session, onClose, entrance = false, preview = false, children }: {
  event: RaceEvent; session: RaceSession; onClose: () => void; entrance?: boolean; preview?: boolean; children?: ReactNode
}) {
  const [active, setActive] = useState(session)
  const eventRef = useRef(event)
  eventRef.current = event
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>
    let cancelled = false
    const scheduleCheck = () => {
      const startAt = Date.parse(active.utc)
      if (!Number.isFinite(startAt)) return
      const dueAt = startAt + IMMERSION_MOTION.impact.WRC + 350
      const delay = Math.max(0, dueAt - Date.now())
      timer = setTimeout(() => {
        if (cancelled) return
        if (delay > 2_147_483_647) { scheduleCheck(); return }
        const now = Date.now()
        setActive(current => nextWrcCountdown(eventRef.current, current, now) ?? current)
      }, Math.min(delay, 2_147_483_647))
    }
    scheduleCheck()
    return () => { cancelled = true; clearTimeout(timer) }
  }, [active.utc])
  return <ImmersiveCountdown targetTime={active.utc} timeZone={event.tz} series="WRC" title={`${event.name} · ${active.name}`} onClose={onClose} entrance={entrance} preview={preview}>
    {active.utc !== session.utc && <p key={active.utc} role="status" className="race-stage-change">{active.name} · 倒计时</p>}
    {children}
  </ImmersiveCountdown>
}
