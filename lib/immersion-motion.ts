import type { Series } from './types'

/** Shared motion score. Durations also drive the CSS and lab scrubbers. */
export const IMMERSION_MOTION = { entry: 1000, revealAt: 420, reveal: 500, pulse: 850, impact: { F1: 1600, FE: 1600, WRC: 1800 } } as const

export function releaseVisible(at: number, now: number, series: Series) {
  const age = now - at
  return Number.isFinite(age) && age >= 0 && age < IMMERSION_MOTION.impact[series]
}

export function pulseOrigin(target: number, totalSeconds: number) {
  return target - totalSeconds * 1000
}
