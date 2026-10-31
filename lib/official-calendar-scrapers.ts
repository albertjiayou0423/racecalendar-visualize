import { COUNTRY_MAP, F1_CIRCUIT_TZ, zonedWallTimeToUtc } from "./tz"
import type { RaceEvent, Series } from "./types"

const MONTHS: Record<string, number> = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 }
const FE_VENUES: Record<string, { country: string; code: string; tz: string; circuit: string; region: RaceEvent["region"]; displayName?: string }> = {
  "Mexico City": { country: "墨西哥", code: "MX", tz: "America/Mexico_City", circuit: "罗德里格斯兄弟赛道", region: "americas" },
  "Austin": { country: "美国", code: "US", tz: "America/Chicago", circuit: "美洲赛道", region: "americas" },
  "Miami": { country: "美国", code: "US", tz: "America/New_York", circuit: "迈阿密国际自驾赛道", region: "americas" },
  "São Paulo": { country: "巴西", code: "BR", tz: "America/Sao_Paulo", circuit: "安年比森巴大道赛道", region: "americas" },
  "Sao Paulo": { country: "巴西", code: "BR", tz: "America/Sao_Paulo", circuit: "安年比森巴大道赛道", region: "americas" },
  "Sanya": { country: "中国", code: "CN", tz: "Asia/Shanghai", circuit: "海棠湾赛道", region: "asia" },
  "Monaco": { country: "摩纳哥", code: "MC", tz: "Europe/Monaco", circuit: "摩纳哥赛道", region: "europe" },
  "Berlin": { country: "德国", code: "DE", tz: "Europe/Berlin", circuit: "滕珀尔霍夫机场街道赛道", region: "europe" },
  "London": { country: "英国", code: "GB", tz: "Europe/London", circuit: "Brands Hatch", region: "europe" },
  "Zandvoort": { country: "荷兰", code: "NL", tz: "Europe/Amsterdam", circuit: "赞德沃特赛道", region: "europe" },
  "Madrid": { country: "西班牙", code: "ES", tz: "Europe/Madrid", circuit: "Jarama-RACE赛道", region: "europe" },
  "Shanghai": { country: "中国", code: "CN", tz: "Asia/Shanghai", circuit: "上海国际赛车场", region: "asia" },
  "Tokyo": { country: "日本", code: "JP", tz: "Asia/Tokyo", circuit: "东京街道赛道", region: "asia" },
  "Jeddah": { country: "沙特阿拉伯", code: "SA", tz: "Asia/Riyadh", circuit: "吉达滨海赛道", region: "middle-east" },
  "Great Britain (Brands Hatch)": { country: "英国", code: "GB", tz: "Europe/London", circuit: "Brands Hatch", region: "europe", displayName: "London" },
  "Netherlands (Zandvoort)": { country: "荷兰", code: "NL", tz: "Europe/Amsterdam", circuit: "赞德沃特赛道", region: "europe", displayName: "Zandvoort" },
}
const F1_COUNTRY: Record<string, { zh: string; code: string; tz: string }> = {
  Bahrain: { zh: "巴林", code: "BH", tz: "Asia/Bahrain" },
  "Saudi Arabia": { zh: "沙特阿拉伯", code: "SA", tz: "Asia/Riyadh" },
  Australia: { zh: "澳大利亚", code: "AU", tz: "Australia/Melbourne" },
  Japan: { zh: "日本", code: "JP", tz: "Asia/Tokyo" },
  China: { zh: "中国", code: "CN", tz: "Asia/Shanghai" },
  Canada: { zh: "加拿大", code: "CA", tz: "America/Toronto" },
  Portugal: { zh: "葡萄牙", code: "PT", tz: "Europe/Lisbon" },
  "Great Britain": { zh: "英国", code: "GB", tz: "Europe/London" },
  Türkiye: { zh: "土耳其", code: "TR", tz: "Europe/Istanbul" },
  Turkey: { zh: "土耳其", code: "TR", tz: "Europe/Istanbul" },
  Singapore: { zh: "新加坡", code: "SG", tz: "Asia/Singapore" },
  Azerbaijan: { zh: "阿塞拜疆", code: "AZ", tz: "Asia/Baku" },
  Qatar: { zh: "卡塔尔", code: "QA", tz: "Asia/Qatar" },
  "United Arab Emirates": { zh: "阿联酋", code: "AE", tz: "Asia/Dubai" },
  "United States": { zh: "美国", code: "US", tz: "America/Chicago" },
  USA: { zh: "美国", code: "US", tz: "America/Chicago" },
  Mexico: { zh: "墨西哥", code: "MX", tz: "America/Mexico_City" },
  Brazil: { zh: "巴西", code: "BR", tz: "America/Sao_Paulo" },
  Italy: { zh: "意大利", code: "IT", tz: "Europe/Rome" },
  Spain: { zh: "西班牙", code: "ES", tz: "Europe/Madrid" },
  Monaco: { zh: "摩纳哥", code: "MC", tz: "Europe/Monaco" },
  Austria: { zh: "奥地利", code: "AT", tz: "Europe/Vienna" },
  Belgium: { zh: "比利时", code: "BE", tz: "Europe/Brussels" },
  Hungary: { zh: "匈牙利", code: "HU", tz: "Europe/Budapest" },
}
const F1_SLUG_TZ: Record<string, string> = {
  bahrain: "Asia/Bahrain", "saudi-arabia": "Asia/Riyadh", australia: "Australia/Melbourne", japan: "Asia/Tokyo", china: "Asia/Shanghai",
  miami: "America/New_York", canada: "America/Toronto", monaco: "Europe/Monaco", portugal: "Europe/Lisbon", "great-britain": "Europe/London",
  austria: "Europe/Vienna", belgium: "Europe/Brussels", hungary: "Europe/Budapest", italy: "Europe/Rome", spain: "Europe/Madrid",
  azerbaijan: "Asia/Baku", türkiye: "Europe/Istanbul", turkey: "Europe/Istanbul", singapore: "Asia/Singapore", "united-states": "America/Chicago",
  mexico: "America/Mexico_City", brazil: "America/Sao_Paulo", "las-vegas": "America/Los_Angeles", qatar: "Asia/Qatar", "abu-dhabi": "Asia/Dubai",
}
const F1_SLUG_PLACE: Record<string, string> = {
  bahrain: "萨基尔", "saudi-arabia": "吉达", australia: "墨尔本", japan: "铃鹿", china: "上海", miami: "迈阿密", canada: "蒙特利尔",
  monaco: "蒙特卡洛", portugal: "波尔蒂芒", "great-britain": "银石", austria: "施皮尔贝格", belgium: "斯塔沃洛", hungary: "莫焦罗德",
  italy: "蒙扎", spain: "马德里", azerbaijan: "巴库", türkiye: "伊斯坦布尔", turkey: "伊斯坦布尔", singapore: "新加坡", "united-states": "奥斯汀",
  mexico: "墨西哥城", brazil: "圣保罗", "las-vegas": "拉斯维加斯", qatar: "卢赛尔", "abu-dhabi": "阿布扎比",
}

function decodeHtml(value: string): string {
  return value.replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#x27;|&#39;/g, "'").replace(/&nbsp;/g, " ").replace(/&ouml;/g, "ö").replace(/&eacute;/g, "é").replace(/&atilde;/g, "ã").replace(/&aacute;/g, "á").replace(/&iacute;/g, "í").replace(/&uuml;/g, "ü").replace(/&ccedil;/g, "ç").replace(/&ocirc;/g, "ô").replace(/&atilde;/g, "ã")
}

function plainText(html: string): string {
  return decodeHtml(html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim())
}

function dateMarker(year: number, month: number, day: number, tz: string): string {
  // End-of-day keeps date-only events out of LIVE state during the actual calendar day.
  return zonedWallTimeToUtc(year, month, day, 23, 59, tz).toISOString()
}

function fallbackName(series: Series, countryOrCity: string, title: string): string {
  if (series === "FE") return `${countryOrCity} E-Prix`
  if (series === "WRC") return `${countryOrCity}拉力赛`
  const key = countryOrCity.toLowerCase()
  const names: Record<string, string> = {
    bahrain: "巴林大奖赛", "saudi arabia": "沙特阿拉伯大奖赛", australia: "澳大利亚大奖赛", japan: "日本大奖赛", china: "中国大奖赛", miami: "迈阿密大奖赛", canada: "加拿大大奖赛", monaco: "摩纳哥大奖赛", portugal: "葡萄牙大奖赛", "great britain": "英国大奖赛", austria: "奥地利大奖赛", belgium: "比利时大奖赛", hungary: "匈牙利大奖赛", italy: "意大利大奖赛", spain: "西班牙大奖赛", azerbaijan: "阿塞拜疆大奖赛", türkiye: "土耳其大奖赛", singapore: "新加坡大奖赛", "united states": "美国大奖赛", mexico: "墨西哥城大奖赛", brazil: "圣保罗大奖赛", "las vegas": "拉斯维加斯大奖赛", qatar: "卡塔尔大奖赛", "abu dhabi": "阿布扎比大奖赛",
  }
  return names[key] || title.replace(/^FORMULA 1\s+/i, "").replace(/\s+202\d$/, "")
}

function makeDateEvent(input: { series: Series; year: number; round: number; name: string; place: string; country: string; countryCode?: string; tz: string; circuit?: string; region?: RaceEvent["region"]; date: [number, number, number]; url?: string }): RaceEvent {
  const [year, month, day] = input.date
  return {
    id: `${input.series.toLowerCase()}-${year}-${input.round}`,
    series: input.series,
    round: input.round,
    name: input.name,
    circuit: input.circuit || `${input.place}赛道`,
    locality: input.place,
    country: input.country,
    countryCode: input.countryCode,
    tz: input.tz,
    sessions: [{ name: input.series === "WRC" ? "赛事日期" : "正赛日期", utc: dateMarker(year, month, day, input.tz), isMain: true, tentative: true }],
    circuitType: input.series === "WRC" ? "rally" : input.series === "FE" ? "street" : "permanent",
    region: input.region,
    url: input.url,
  }
}

/** Parse F1's public, keyless calendar page. Every event date is the published weekend's final day. */
export function parseOfficialF1Calendar(html: string, year: number): RaceEvent[] {
  const events: RaceEvent[] = []
  const anchor = new RegExp(`<a\\b[^>]*href="/en/racing/${year}/([^"/?#]+)"[^>]*>([\\s\\S]*?)<\\/a>`, "gi")
  for (const match of html.matchAll(anchor)) {
    const slug = match[1]
    const content = match[2]
    if (slug === "pre-season-testing") continue
    const text = plainText(content)
    const round = text.match(/ROUND\s+(\d+)/i)
    const endDate = text.match(/(?:\d{1,2}\s+[A-Za-z]{3}\s*-\s*)?(\d{1,2})\s+([A-Za-z]{3})$/i)
    const eventTitle = content.match(/<span[^>]*>([^<]*GRAND PRIX[^<]*)<\/span>/i)?.[1]
    const place = content.match(/<p[^>]*>([^<]+)<\/p>/i)?.[1]
    const countryName = content.match(/<title>\s*Flag of ([^<]+)<\/title>/i)?.[1]
      || content.match(/title="Flag of ([^"]+)"/i)?.[1]
      || decodeHtml(place || "").trim()
    if (!round || !endDate || !countryName) continue
    const month = MONTHS[endDate[2].slice(0, 3).toLowerCase()]
    const day = Number(endDate[1])
    if (!month || day < 1 || day > 31) continue
    const countryInfo = COUNTRY_MAP[countryName] || F1_COUNTRY[countryName]
    const name = fallbackName("F1", countryName, plainText(eventTitle || countryName))
    const tz = F1_SLUG_TZ[slug] || F1_CIRCUIT_TZ[slug] || F1_COUNTRY[countryName]?.tz || "UTC"
    const placeName = F1_SLUG_PLACE[slug] || countryInfo?.zh || decodeHtml(place || countryName)
    events.push(makeDateEvent({ series: "F1", year, round: Number(round[1]), name, place: placeName, country: countryInfo?.zh || countryName, countryCode: countryInfo?.code, tz, date: [year, month, day], url: `https://www.formula1.com/en/racing/${year}/${slug}` }))
  }
  return uniqueRounds(events)
}

/** Parse Formula E's public, keyless season calendar page (including cross-year seasons). */
export function parseOfficialFeCalendar(html: string): RaceEvent[] {
  const events: RaceEvent[] = []
  const cards = html.matchAll(/<article\b[^>]*data-testid="round-card"[^>]*>([\s\S]*?)<\/article>/gi)
  for (const card of cards) {
    const content = card[1]
    const round = content.match(/\bR(\d{1,2})\s*[·•]/i)
    const dateLabel = content.match(/aria-label="(\d{1,2})\s+([A-Za-z]{3,9})\s+(20\d{2})"/i)
    const place = content.match(/<h3[^>]*>([\s\S]*?)<\/h3>/i)?.[1]
    if (!round || !dateLabel || !place) continue
    const month = MONTHS[dateLabel[2].slice(0, 3).toLowerCase()]
    const year = Number(dateLabel[3])
    const day = Number(dateLabel[1])
    const placeName = plainText(place)
    const venue = FE_VENUES[placeName] || Object.entries(FE_VENUES).find(([name]) => name.toLowerCase() === placeName.toLowerCase())?.[1]
    const displayName = venue?.displayName || placeName
    if (!month || day < 1 || day > 31 || !year) continue
    const link = content.match(/href="([^"]*\/races?\/[^"?#]+|\/en\/[^"?#]+)"/i)?.[1]
    events.push(makeDateEvent({ series: "FE", year, round: Number(round[1]), name: fallbackName("FE", displayName, displayName), place: displayName, country: venue?.country || placeName, countryCode: venue?.code, tz: venue?.tz || "UTC", circuit: venue?.circuit, region: venue?.region, date: [year, month, day], url: link ? new URL(link, "https://www.fiaformulae.com").toString() : "https://www.fiaformulae.com/en/calendar" }))
  }
  return uniqueRounds(events)
}

function uniqueRounds(events: RaceEvent[]): RaceEvent[] {
  return [...new Map(events.map(event => [`${event.series}:${event.sessions[0]?.utc.slice(0, 4)}:${event.round}`, event])).values()]
}

export async function fetchOfficialF1Calendar(year: number): Promise<RaceEvent[]> {
  try {
    const response = await fetch(`https://www.formula1.com/en/racing/${year}`, { headers: { "user-agent": "Mozilla/5.0 RaceCalendar/1.0" }, next: { revalidate: 3600 } })
    if (!response.ok) return []
    return parseOfficialF1Calendar(await response.text(), year)
  } catch { return [] }
}

export async function fetchOfficialFeCalendar(): Promise<RaceEvent[]> {
  try {
    const response = await fetch("https://www.fiaformulae.com/en/calendar", { headers: { "user-agent": "Mozilla/5.0 RaceCalendar/1.0" }, next: { revalidate: 3600 } })
    if (!response.ok) return []
    return parseOfficialFeCalendar(await response.text())
  } catch { return [] }
}

/** Keep detailed API sessions when available; fill only missing year/rounds. */
export function mergeCalendarEvents(apiEvents: RaceEvent[], calendarEvents: RaceEvent[], years: number[]): RaceEvent[] {
  const calendarByKey = new Map(calendarEvents
    .filter(event => years.includes(eventYear(event)))
    .map(event => [`${event.series}:${eventYear(event)}:${event.round}`, event]))
  const keys = new Set<string>()
  const mergedApi = apiEvents.map(event => {
    const year = eventYear(event)
    if (!years.includes(year)) return event
    const key = `${event.series}:${year}:${event.round}`
    keys.add(key)
    const calendar = calendarByKey.get(key)
    if (!calendar) return event
    const hasConfirmedTime = event.sessions.some(session => !session.tentative)
    if (hasConfirmedTime) {
      const hasConfirmedMain = event.sessions.some(session => session.isMain && !session.tentative)
      if (hasConfirmedMain) return event
      return { ...event, sessions: [...event.sessions, ...calendar.sessions].sort((a, b) => a.utc.localeCompare(b.utc)) }
    }
    // An official date-only page can correct the placeholder date and timezone,
    // while keeping the API's established event ID and metadata.
    return { ...calendar, ...event, tz: calendar.tz, circuit: event.circuit || calendar.circuit, sessions: calendar.sessions }
  })
  const missing = [...calendarByKey].flatMap(([key, event]) => keys.has(key) ? [] : [event])
  return [...mergedApi, ...missing]
}

function eventYear(event: RaceEvent): number {
  const idMatch = event.id.match(/(?:^|-)20\d{2}(?:-|$)/)
  if (idMatch) return Number(idMatch[0].replace(/-/g, ""))
  const timestamp = event.sessions.map(session => Date.parse(session.utc)).find(Number.isFinite)
  return timestamp === undefined ? 0 : new Date(timestamp).getUTCFullYear()
}

