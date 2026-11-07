type JsonRecord = Record<string, unknown>

export type WrcResultEntry = {
  position: string
  driver: string
  coDriver?: string
  car?: string
  time?: string
  gap?: string
}

export type WrcRallyResult = {
  id: string
  round: number
  name: string
  dateStart: string
  location: string
  country: string
  results: WrcResultEntry[]
  resultsAvailable: boolean
}

const API_BASE = "https://api.ocblacktop.com"

function record(value: unknown): JsonRecord | undefined {
  return value && typeof value === "object" && !Array.isArray(value) ? value as JsonRecord : undefined
}

function text(...values: unknown[]): string | undefined {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim()
    if (typeof value === "number" && Number.isFinite(value)) return String(value)
  }
  return undefined
}

function nestedText(value: unknown, ...keys: string[]) {
  const source = record(value)
  return source ? text(...keys.map(key => source[key])) : undefined
}

async function api<T>(path: string, revalidate: number): Promise<T> {
  const apiKey = process.env.OCBLACKTOP_API_KEY
  if (!apiKey) throw new Error("WRC 赛果数据源未配置")
  const response = await fetch(`${API_BASE}${path}`, {
    headers: { "x-api-key": apiKey, Accept: "application/json" },
    next: { revalidate },
    signal: AbortSignal.timeout(10000),
  })
  if (!response.ok) throw new Error(`WRC API HTTP ${response.status}`)
  return await response.json() as T
}

function resultRows(value: unknown): unknown[] | undefined {
  const source = record(value)
  if (!source) return Array.isArray(value) ? value : undefined

  // Prefer final overall classifications over stage-level classifications.
  for (const key of ["overallResults", "overallClassification", "classification", "results", "standings", "finalClassification"]) {
    if (Array.isArray(source[key])) return source[key] as unknown[]
    const nested = record(source[key])
    if (nested) {
      for (const nestedKey of ["overall", "overallResults", "classification", "results", "entries", "rows"]) {
        if (Array.isArray(nested[nestedKey])) return nested[nestedKey] as unknown[]
      }
    }
  }
  for (const key of ["data", "rally", "event", "result", "response"]) {
    const found = resultRows(source[key])
    if (found) return found
  }
  return undefined
}

function normalizeResult(row: unknown): WrcResultEntry | null {
  const source = record(row)
  if (!source) return null
  const crew = record(source.crew)
  const crewMembers = Array.isArray(source.crew) ? source.crew.map(record).filter((item): item is JsonRecord => !!item) : []
  const driver = record(source.driver) ?? record(crew?.driver) ?? crewMembers[0]
  const coDriver = record(source.coDriver) ?? record(source.codriver) ?? record(crew?.coDriver) ?? record(crew?.codriver) ?? crewMembers[1]
  const position = text(source.position, source.pos, source.rank, source.place)
  const driverName = text(source.driverName, source.driver_name, typeof source.driver === "string" ? source.driver : undefined, source.name, driver?.name, driver?.fullName)
  if (!position || !driverName) return null
  return {
    position,
    driver: driverName,
    coDriver: text(source.coDriverName, source.co_driver, typeof source.coDriver === "string" ? source.coDriver : undefined, typeof source.codriver === "string" ? source.codriver : undefined, coDriver?.name, coDriver?.fullName),
    car: text(source.car, source.vehicle, nestedText(source.manufacturer, "name"), source.team),
    time: text(source.totalTime, source.time, source.elapsedTime, source.elapsed),
    gap: text(source.gap, source.timeGap, source.difference),
  }
}

function rallyList(payload: unknown): JsonRecord[] {
  const source = record(payload)
  const data = record(source?.data)
  const season = record(source?.season)
  const candidates = [source?.rallies, source?.rounds, source?.upcoming, source?.completed, source?.events,
    data?.rallies, data?.rounds, data?.upcoming, data?.completed, data?.events, season?.rallies, season?.rounds,
    Array.isArray(source?.data) ? source?.data : undefined]
  for (const candidate of candidates) {
    if (Array.isArray(candidate)) return candidate.map(record).filter((item): item is JsonRecord => !!item)
  }
  return []
}

async function fetchRallyResults(rally: JsonRecord): Promise<WrcResultEntry[]> {
  const id = text(rally.id, rally.rallyId, rally.slug)
  let payload: unknown = rally
  let rows = resultRows(payload)
  let normalized = (rows ?? []).map(normalizeResult).filter((item): item is WrcResultEntry => !!item)
  if (!normalized.length && id) {
    try {
      payload = await api(`/v1/wrc/rallies/${encodeURIComponent(id)}`, 60 * 60 * 24 * 30)
      rows = resultRows(payload)
      normalized = (rows ?? []).map(normalizeResult).filter((item): item is WrcResultEntry => !!item)
    } catch {
      // Try the explicit classification route below.
    }
  }
  if (!normalized.length && id) {
    try {
      const classification = await api(`/v1/wrc/rallies/${encodeURIComponent(id)}/classification`, 60 * 60 * 24 * 30)
      rows = resultRows(classification)
      normalized = (rows ?? []).map(normalizeResult).filter((item): item is WrcResultEntry => !!item)
    } catch {
      // Some rallies do not have a published final classification yet.
    }
  }
  return normalized
}

export async function fetchWrcSeasonResults(year: number): Promise<WrcRallyResult[]> {
  let rallies: JsonRecord[] = []
  try {
    const seasonPayload = await api<unknown>(`/v1/wrc/seasons/${year}`, 60 * 60 * 24 * 30)
    rallies = rallyList(seasonPayload)
  } catch {
    // Keep compatibility with the rally index if a provider account lacks the season endpoint.
  }
  if (!rallies.length) {
    const payload = await api<unknown>(`/v1/wrc/rallies?year=${year}&limit=50`, 60 * 60 * 24 * 30)
    rallies = rallyList(payload)
  }
  const selected = rallies.filter(rally => {
    const date = text(rally.dateStart, rally.startDate, rally.date)
    const rallyYear = text(rally.year) ?? (date ? date.slice(0, 4) : undefined)
    return rallyYear === String(year)
  })
  if (!selected.length) throw new Error(`WRC API 未返回 ${year} 赛季赛事`)

  const entries = await mapWithConcurrency(selected, 4, async rally => {
    const dateStart = text(rally.dateStart, rally.startDate, rally.date) ?? `${year}-01-01`
    const location = record(rally.location)
    const country = record(location?.country)
    let results: WrcResultEntry[] = []
    try {
      results = await fetchRallyResults(rally)
    } catch {
      // A season can contain rallies whose final classifications are not published yet.
    }
    return {
      id: text(rally.id, rally.rallyId, rally.slug) ?? `${year}-${text(rally.round) ?? dateStart}`,
      round: Number(text(rally.round, rally.roundNumber) ?? 0),
      name: text(rally.name, rally.rallyName) ?? "WRC 拉力赛",
      dateStart,
      location: text(location?.name, typeof rally.location === "string" ? rally.location : undefined, rally.locationName, rally.city) ?? "",
      country: text(country?.name, rally.country) ?? "",
      results,
      resultsAvailable: results.length > 0,
    }
  })

  return entries.sort((a, b) => a.round - b.round || a.dateStart.localeCompare(b.dateStart))
}

async function mapWithConcurrency<T, R>(items: T[], limit: number, map: (item: T) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length)
  let cursor = 0
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor++
      results[index] = await map(items[index])
    }
  }))
  return results
}
