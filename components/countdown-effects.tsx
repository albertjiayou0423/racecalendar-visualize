"use client"

import { useLayoutEffect, useRef, type CSSProperties } from 'react'
import { IMMERSION_MOTION } from '@/lib/immersion-motion'

/** Align newly mounted layers to the same wall-clock cue, then let the browser run smoothly. */
function useMotionCue(at?: number, frameMs = -1) {
  const ref = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    if (frameMs >= 0) {
      // Pausing a completed animation keeps its old elapsed time. Reset that
      // time so the CSS negative delay is the sole frame position.
      const shell = ref.current?.closest('.race-immersive')
      const clocks = shell?.querySelectorAll<HTMLElement>('.race-stage, .rally-inline, .rally-countdown-digits') ?? []
      const animations = [...(ref.current?.getAnimations({ subtree: true }) ?? []), ...(shell?.getAnimations().filter(animation => animation instanceof CSSAnimation && animation.animationName === 'impact-screen') ?? []), ...Array.from(clocks).flatMap(el => el.getAnimations()).filter(animation => animation instanceof CSSAnimation && animation.animationName.startsWith('rally-'))]
      for (const animation of animations) {
        animation.pause()
        animation.currentTime = animation instanceof CSSAnimation && animation.animationName === 'impact-screen' ? frameMs : 0
      }
      return
    }
    if (at === undefined) return
    const shell = ref.current?.closest('.race-immersive')
    const animations = [...(ref.current?.getAnimations({ subtree: true }) ?? []), ...(shell?.getAnimations().filter(animation => animation instanceof CSSAnimation && animation.animationName === 'impact-screen') ?? [])]
    for (const animation of animations) {
      animation.currentTime = Math.max(0, Date.now() - at)
    }
  }, [at, frameMs])
  return ref
}

export function CountdownEntrance({ frameMs = -1, at }: { frameMs?: number; at?: number }) {
  const ref = useMotionCue(at, frameMs)
  return <div ref={ref} className="race-entry-wave" aria-hidden="true" style={{ '--entry-duration': `${IMMERSION_MOTION.entry}ms`, ...(frameMs >= 0 ? { animationPlayState: 'paused', animationDelay: `${-frameMs}ms` } : {}) } as CSSProperties}><svg viewBox="0 0 1440 80" preserveAspectRatio="none"><path d="M0 45 Q360 -20 720 40 T1440 35 V80 H0Z" fill="currentColor" /></svg></div>
}

export function CountdownImpact({ frameMs = -1, at }: { frameMs?: number; at?: number }) {
  const ref = useMotionCue(at, frameMs)
  return <div ref={ref} className={`race-launch-burst ${frameMs >= 0 ? 'is-frame' : ''}`} style={frameMs >= 0 ? { '--launch-frame': `${frameMs}ms` } as CSSProperties : undefined} aria-hidden="true"><i /><i /><i /></div>
}

export function CountdownFinalPulse({ frameMs = -1, at }: { frameMs?: number; at?: number }) {
  const ref = useMotionCue(at, frameMs)
  return <div ref={ref} className="rally-prestart-pulse" style={{ '--pulse-duration': `${IMMERSION_MOTION.pulse}ms`, ...(frameMs >= 0 ? { animationPlayState: 'paused', animationDelay: `${-frameMs}ms` } : {}) } as CSSProperties} aria-hidden="true" />
}
