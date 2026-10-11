export function isoWeek(date: Date): { y: number; w: number } {
  const thursday = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
  thursday.setUTCDate(thursday.getUTCDate() + 3 - (thursday.getUTCDay() + 6) % 7)
  const y = thursday.getUTCFullYear()
  const first = new Date(Date.UTC(y, 0, 4))
  first.setUTCDate(first.getUTCDate() + 3 - (first.getUTCDay() + 6) % 7)
  return { y, w: 1 + Math.round((thursday.getTime() - first.getTime()) / 604800000) }
}
export function weekMonday({ y, w }: { y: number; w: number }): Date {
  const date = new Date(Date.UTC(y, 0, 4))
  date.setUTCDate(date.getUTCDate() - (date.getUTCDay() + 6) % 7 + (w - 1) * 7)
  return date
}
export function beijingWeek(now: number) { return isoWeek(new Date(now + 8 * 3600000)) }
