"use client"

import dynamic from "next/dynamic"
import type { StartSelection } from "../model"
const Countdown = dynamic(() => import("@/components/immersive-countdown").then(module => module.ImmersiveCountdown), { ssr: false })
const WrcSequence = dynamic(() => import("@/components/wrc-countdown-sequence").then(module => module.WrcCountdownSequence), { ssr: false })

export function SimpleImmersionHost({ selection, onClose }: { selection: StartSelection | null; onClose: () => void }) {
  if (!selection) return null
  const { event, session, entrance } = selection
  return event.series === "WRC" ? <WrcSequence entrance={entrance} event={event} session={session} onClose={onClose} /> : <Countdown entrance={entrance} targetTime={session.utc} series={event.series} title={`${event.name} · ${session.name}`} timeZone={event.tz} isRace={!!session.isMain} onClose={onClose} />
}
