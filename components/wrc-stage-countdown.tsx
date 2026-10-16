"use client"
import { useState } from 'react'
import type { RaceEvent, RaceSession } from '@/lib/types'
import { WrcCountdownSequence } from './wrc-countdown-sequence'
export function WrcStageCountdown({ event, session }: { event: RaceEvent; session: RaceSession }) {
  const [open, setOpen] = useState(false)
  if (event.series !== 'WRC' || session.clientUploadedAt || (session.tentative ?? event.tentative ?? false) || !Number.isFinite(Date.parse(session.utc))) return null
  return <>
    <button type="button" className="mt-2 inline-flex min-h-9 items-center rounded-full border border-border px-3 text-xs text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground" onClick={() => setOpen(true)} aria-label={`${session.name} 沉浸式倒计时`}>赛段倒计时</button>
    {open && <WrcCountdownSequence event={event} session={session} onClose={() => setOpen(false)} />}
  </>
}
