/** Prioritize rally weekends and nearby dates without changing persisted event order. */
export function prioritizeWrcRallies<T extends { startDate: string; round: number }>(rallies: readonly T[], now = Date.now()): T[] {
  const day = 86400000
  function rank(rally: T): [number, number] {
    const start = Date.parse(rally.startDate)
    if (!Number.isFinite(start)) return [4, rally.round]
    const delta = start - now
    if (delta <= 0 && delta >= -5 * day) return [0, Math.abs(delta)]
    if (delta > 0 && delta <= 14 * day) return [1, delta]
    if (delta < 0 && delta >= -14 * day) return [2, Math.abs(delta)]
    return [3, Math.abs(delta)]
  }
  return [...rallies].sort((a, b) => {
    const ar = rank(a), br = rank(b)
    return ar[0] - br[0] || ar[1] - br[1] || a.round - b.round
  })
}
