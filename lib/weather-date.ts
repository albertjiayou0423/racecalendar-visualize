/** Return an ISO calendar date for a session timestamp, or null when invalid. */
export function sessionWeatherDate(utc: string): string | null {
  const timestamp = new Date(utc).getTime()
  if (!Number.isFinite(timestamp)) return null
  return new Date(timestamp).toISOString().slice(0, 10)
}
