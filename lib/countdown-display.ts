export function countdownDisplay(milliseconds: number) {
  const total = Number.isFinite(milliseconds) ? Math.max(0, Math.ceil(milliseconds / 1000)) : 0
  return { total, days: Math.floor(total / 86400), hours: Math.floor(total / 3600) % 24,
    minutes: Math.floor(total / 60) % 60, seconds: total % 60, showSignals: Number.isFinite(milliseconds) && total <= 1800 }
}

/** Wake when the displayed second changes; keep a 1s heartbeat after zero for live-state freshness. */
export function countdownTickDelay(targetMs: number, now: number) {
  if (!Number.isFinite(targetMs) || !Number.isFinite(now)) return 1000
  const remaining = targetMs - now
  if (remaining <= 0) return 1000
  return Math.min(remaining, ((remaining - 1) % 1000) + 1)
}
