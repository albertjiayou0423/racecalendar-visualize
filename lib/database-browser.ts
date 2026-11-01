export const INSPECTABLE_TABLES = [
  "crawl_snapshots", "crawl_quota", "event_overrides", "service_health_log",
  "predictions", "ai_usage", "feedbacks", "push_subscriptions", "client_crawl_jobs",
  "notification_health_daily", "notification_incidents", "notification_monthly_reports",
] as const

export function isInspectableTable(name: string): boolean {
  return (INSPECTABLE_TABLES as readonly string[]).includes(name)
}

export function quoteIdentifier(name: string): string {
  return `"${name.replaceAll('"', '""')}"`
}

export function pageNumber(value: string | null, fallback: number, maximum: number): number | null {
  if (value === null) return fallback
  if (!/^\d+$/.test(value)) return null
  const number = Number(value)
  return Number.isSafeInteger(number) && number >= 1 && number <= maximum ? number : null
}

export const HIDDEN_COLUMNS = new Set(["endpoint", "p256dh", "auth", "token_hash"])
export const CELL_LIMIT = 16000
