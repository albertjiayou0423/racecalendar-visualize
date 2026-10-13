import type { RaceEvent, ScheduleResponse, Series } from "@/lib/types"

export const SCHEDULE_SERIES: Series[] = ["F1", "WRC", "FE"]

export interface ClientSeriesCacheEntry {
  events: RaceEvent[]
  source: ScheduleResponse["sources"][number]
  fetchedAt: string
}

export interface ClientScheduleCache {
  version: 1
  series: Partial<Record<Series, ClientSeriesCacheEntry>>
}

const emptyCache = (): ClientScheduleCache => ({ version: 1, series: {} })

function isSeries(value: unknown): value is Series {
  return value === "F1" || value === "WRC" || value === "FE"
}

function isEventForSeries(event: unknown, series: Series): event is RaceEvent {
  return typeof event === "object" && event !== null && "series" in event && event.series === series
}

function readVersionedCache(value: unknown): ClientScheduleCache | null {
  if (!value || typeof value !== "object" || !("version" in value) || value.version !== 1 || !("series" in value)) return null
  const source = value.series
  if (!source || typeof source !== "object") return null

  const cache = emptyCache()
  for (const series of SCHEDULE_SERIES) {
    const entry = (source as Partial<Record<Series, unknown>>)[series]
    if (!entry || typeof entry !== "object" || !("events" in entry) || !Array.isArray(entry.events) || !("source" in entry) || !("fetchedAt" in entry)) continue
    const sourceInfo = entry.source
    if (!sourceInfo || typeof sourceInfo !== "object" || !("ok" in sourceInfo) || sourceInfo.ok !== true || !Array.isArray(entry.events)) continue
    const events = entry.events.filter((event): event is RaceEvent => isEventForSeries(event, series))
    if (!events.length || typeof entry.fetchedAt !== "string") continue
    cache.series[series] = {
      events,
      source: sourceInfo as ClientSeriesCacheEntry["source"],
      fetchedAt: entry.fetchedAt,
    }
  }
  return cache
}

/** Reads the current cache format or safely migrates successful series from the old full-response cache. */
export function parseClientScheduleCache(raw: string | null): ClientScheduleCache | null {
  if (!raw) return null
  try {
    const value: unknown = JSON.parse(raw)
    const versioned = readVersionedCache(value)
    if (versioned) return versioned

    if (!value || typeof value !== "object" || !("events" in value) || !Array.isArray(value.events) || !("sources" in value) || !Array.isArray(value.sources)) return null
    const legacy = value as ScheduleResponse
    if (typeof legacy.fetchedAt !== "string") return null
    const cache = emptyCache()
    for (const source of legacy.sources) {
      if (!isSeries(source?.series) || source.ok !== true) continue
      const events = legacy.events.filter((event): event is RaceEvent => isEventForSeries(event, source.series))
      if (events.length) cache.series[source.series] = { events, source, fetchedAt: legacy.fetchedAt }
    }
    return Object.values(cache.series).some(Boolean) ? cache : null
  } catch {
    return null
  }
}

function cachedSource(
  entry: ClientSeriesCacheEntry,
  reason: string,
  currentSource?: ScheduleResponse["sources"][number],
): ScheduleResponse["sources"][number] {
  const time = Number.isFinite(Date.parse(entry.fetchedAt))
    ? new Date(entry.fetchedAt).toLocaleString("zh-CN")
    : entry.fetchedAt
  return {
    ...entry.source,
    ...currentSource,
    cached: true,
    cacheFetchedAt: entry.fetchedAt,
    note: `${reason}；显示本机 ${time} 的上次成功数据`,
  }
}

/** Builds cached fallback data for first paint or a network failure. */
export function scheduleFromClientCache(cache: ClientScheduleCache, offline = false): ScheduleResponse & { offline?: boolean } {
  const sources = SCHEDULE_SERIES.flatMap((series) => {
    const entry = cache.series[series]
    return entry ? [cachedSource(entry, "等待赛历更新")] : []
  })
  const events = SCHEDULE_SERIES.flatMap((series) => cache.series[series]?.events ?? [])
  const fetchedAt = sources
    .map((source) => source.cacheFetchedAt ?? "")
    .filter(Boolean)
    .sort((a, b) => Date.parse(b) - Date.parse(a))[0] ?? new Date(0).toISOString()
  return { events, sources, fetchedAt, ...(offline ? { offline: true } : {}) }
}

/** Updates only successful series and substitutes their last known-good data for failed/empty series. */
export function mergeScheduleWithClientCache(
  fresh: ScheduleResponse,
  previous: ClientScheduleCache | null,
): { response: ScheduleResponse; cache: ClientScheduleCache } {
  const cache = previous ? { version: 1 as const, series: { ...previous.series } } : emptyCache()
  for (const source of fresh.sources) {
    if (!isSeries(source.series)) continue
    const events = fresh.events.filter((event) => event.series === source.series)
    if (source.ok && events.length) {
      cache.series[source.series] = { events, source: { ...source, cached: false, cacheFetchedAt: undefined }, fetchedAt: fresh.fetchedAt }
    }
  }

  const sources = fresh.sources.map((source) => {
    const events = fresh.events.filter((event) => event.series === source.series)
    const entry = cache.series[source.series]
    const hasFreshData = source.ok && events.length > 0
    if (hasFreshData || !entry) return { ...source, cached: false, cacheFetchedAt: undefined }
    const reason = source.ok ? "服务端暂未返回赛事数据" : "本次服务端获取失败"
    return cachedSource(entry, reason, source)
  })

  const events = SCHEDULE_SERIES.flatMap((series) => {
    const source = sources.find((item) => item.series === series)
    if (source?.cached) return cache.series[series]?.events ?? []
    return fresh.events.filter((event) => event.series === series)
  })
  return { response: { ...fresh, events, sources }, cache }
}
