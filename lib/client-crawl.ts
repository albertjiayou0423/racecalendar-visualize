import type { RaceEvent, RaceSession } from "./types"

export const CLIENT_CRAWL_INTERVAL = 3 * 60 * 60 * 1000
export const CLIENT_CRAWL_LIMIT = 256 * 1024
export type ClientCrawlJob = { id: string; token: string; series: "F1" | "WRC"; year: number; eventSlug?: string; url: string }

export function clientSourceUrl(series: "F1" | "WRC", year: number, eventSlug?: string) {
  if (!Number.isInteger(year) || year < 2020 || year > 2100) throw new Error("无效赛季")
  if (series === "F1") return `https://api.jolpi.ca/ergast/f1/${year}.json`
  if (!eventSlug || !/^[a-z0-9][a-z0-9-]{0,120}$/.test(eventSlug)) throw new Error("无效赛事")
  return `https://www.wrc.com/v3/api/graphql/v1/v3/feed/en-INT?disableUsageRestrictions=true&filter[type]=event-details&filter[uriSlug]=itinerary-${eventSlug}&page[limit]=1&rb3Locale=en&rb3Schema=v1:inlineContent`
}

export async function readLimitedText(input: { body: ReadableStream<Uint8Array> | null }, limit = CLIENT_CRAWL_LIMIT) {
  if (!input.body) throw new Error("空响应")
  const reader = input.body.getReader()
  const decoder = new TextDecoder()
  let size = 0, text = ""
  try {
    while (true) {
      const chunk = await reader.read()
      if (chunk.done) break
      size += chunk.value.byteLength
      if (size > limit) { await reader.cancel(); throw new Error("响应过大") }
      text += decoder.decode(chunk.value, { stream: true })
    }
    return text + decoder.decode()
  } finally { reader.releaseLock() }
}

export async function fetchClientCrawl(job: ClientCrawlJob, signal: AbortSignal, fetcher: typeof fetch = fetch) {
  if (job.url !== clientSourceUrl(job.series, job.year, job.eventSlug)) throw new Error("不允许的数据源")
  const response = await fetcher(job.url, { mode: "cors", credentials: "omit", cache: "no-store", referrerPolicy: "no-referrer", signal })
  if (!response.ok || response.type === "opaque") throw new Error("数据源不可读取")
  const raw = await readLimitedText(response, CLIENT_CRAWL_LIMIT - 4096)
  JSON.parse(raw)
  return raw
}

function validUtc(value: string) {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(value)
    && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value.slice(0, 10)
}
function utc(value: unknown, year: number): string | null {
  if (!value || typeof value !== "object") return null
  const { date, time } = value as Record<string, unknown>
  if (typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !date.startsWith(`${year}-`)
    || typeof time !== "string" || !/^\d{2}:\d{2}:\d{2}Z$/.test(time)) return null
  const result = new Date(`${date}T${time}`)
  if (!Number.isFinite(result.getTime()) || result.toISOString().slice(0, 10) !== date) return null
  return result.toISOString()
}

/** Only update known event sessions; visitor names, metadata, URLs and IDs are never adopted. */
export function parseClientF1(raw: unknown, base: RaceEvent[], year: number): RaceEvent[] {
  const table = (raw as any)?.MRData?.RaceTable
  const races = table?.Races
  if (table?.season !== String(year) || !Array.isArray(races) || !races.length || races.length > 40) throw new Error("赛季或赛事无效")
  const known = new Map(base.filter(event => event.series === "F1").map(event => [event.id, event]))
  const seen = new Set<string>()
  const fields = [["FirstPractice", "第一次自由练习 (FP1)"], ["SecondPractice", "第二次自由练习 (FP2)"], ["ThirdPractice", "第三次自由练习 (FP3)"], ["SprintQualifying", "冲刺排位赛 (SQ)"], ["Sprint", "冲刺赛 (Sprint)"], ["Qualifying", "排位赛 (Qualifying)"]] as const
  return races.map(race => {
    if (race?.season !== String(year) || !/^\d{1,2}$/.test(String(race.round))) throw new Error("赛事标识无效")
    const id = `f1-${year}-${Number(race.round)}`
    const event = known.get(id)
    if (!event || seen.has(id)) throw new Error("未知或重复赛事")
    seen.add(id)
    const main = utc(race, year)
    if (!main) throw new Error("正赛时间无效")
    const anchor = event.sessions.find(session => session.isMain && validUtc(session.utc)) || event.sessions.find(session => validUtc(session.utc))
    if (anchor && Math.abs(Date.parse(main) - Date.parse(anchor.utc)) > 7 * 86400000) throw new Error("赛事日期与已有赛历不符")
    const sessions: RaceSession[] = [{ name: "正赛 (Race)", utc: main, isMain: true }]
    for (const [field, name] of fields) {
      if (!race[field]) continue
      const time = utc(race[field], year)
      if (!time || Math.abs(Date.parse(main) - Date.parse(time)) > 7 * 86400000) throw new Error("场次时间无效")
      sessions.push({ name, utc: time })
    }
    sessions.sort((a, b) => a.utc.localeCompare(b.utc))
    return { ...event, sessions }
  })
}

const sessionKey = (name: string) => {
  const number = name.match(/\bSS\s*0*(\d+)\b/i)?.[1]
  return number ? `ss:${Number(number)}` : name.toLowerCase().replace(/\s+/g, " ").trim()
}
export function fillClientGaps(base: RaceEvent[], candidates: RaceEvent[], sourceUrl: string, uploadedAt: string) {
  const patches = new Map(candidates.map(event => [event.id, event]))
  let filled = 0
  const events = base.map(event => {
    const patch = patches.get(event.id)
    if (!patch || patch.series !== event.series) return event
    const sessions = event.sessions.map(session => ({ ...session }))
    const added: string[] = []
    for (const incoming of patch.sessions) {
      if (!validUtc(incoming.utc)) continue
      const matches = sessions.filter(session => sessionKey(session.name) === sessionKey(incoming.name))
      if (matches.length > 1 || matches.some(session => validUtc(session.utc))) continue
      // A client can fill a missing time, but never turn its own input into independently verified official data.
      const value: RaceSession = { name: matches[0]?.name || incoming.name, utc: incoming.utc, isMain: matches[0]?.isMain ?? incoming.isMain, tentative: true, clientUploadedAt: uploadedAt }
      if (matches.length) sessions[sessions.indexOf(matches[0])] = value
      else if (sessions.length < 100) sessions.push(value)
      else continue
      added.push(value.name)
      filled++
    }
    if (!added.length) return event
    sessions.sort((a, b) => (a.utc || "").localeCompare(b.utc || ""))
    return { ...event, sessions, tentative: event.series === "WRC" ? true : event.tentative, clientData: { uploadedAt, sourceUrl, sessions: [...new Set([...(event.clientData?.sessions || []), ...added])] } }
  })
  return { events, filled }
}
