export function countdownDisplay(milliseconds: number) {
  const total = Number.isFinite(milliseconds) ? Math.max(0, Math.ceil(milliseconds / 1000)) : 0
  return { total, days: Math.floor(total / 86400), hours: Math.floor(total / 3600) % 24,
    minutes: Math.floor(total / 60) % 60, seconds: total % 60, showSignals: Number.isFinite(milliseconds) && total <= 1800 }
}
