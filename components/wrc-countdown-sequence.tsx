"use client"

import { useEffect, useState, type ReactNode } from 'react'
import type { RaceEvent, RaceSession } from '@/lib/types'
import { IMMERSION_MOTION } from '@/lib/immersion-motion'
import { nextWrcCountdown } from '@/lib/wrc-countdown-sequence'
import { ImmersiveCountdown } from './immersive-countdown'

/** Opening chooses the first stage; subsequent ticks do not replace an active ceremony. */
export function WrcCountdownSequence({ event, session, onClose, entrance = false, preview = false, children }: {
  event: RaceEvent; session: RaceSession; onClose: () => void; entrance?: boolean; preview?: boolean; children?: ReactNode
}) {
  const [active, setActive] = useState(session)
  useEffect(() => {
    const timer = setInterval(() => {
      const now = Date.now()
      setActive(current => {
        if (now < Date.parse(current.utc) + IMMERSION_MOTION.impact.WRC + 350) return current
        return nextWrcCountdown(event, current, now) ?? current
      })
    }, 100)
    return () => clearInterval(timer)
  }, [event])
  return <ImmersiveCountdown targetTime={active.utc} timeZone={event.tz} series="WRC" title={`${event.name} · ${active.name}`} onClose={onClose} entrance={entrance} preview={preview}>
    {active.utc !== session.utc && <p key={active.utc} role="status" className="race-stage-change">{active.name} · 倒计时</p>}
    {children}
  </ImmersiveCountdown>
}
