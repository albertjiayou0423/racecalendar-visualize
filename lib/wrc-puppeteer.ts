import type { RaceEvent, RaceSession } from "./types"
import { zonedWallTimeToUtc } from "./tz"
import { buildWrcEvents } from "./wrc-data"

// ============ 直接 fetch (主要方案) ============

async function fetchDirect(url: string, retries: number = 2): Promise<string | null> {
  for (let i = 0; i <= retries; i++) {
    try {
      const res = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.9",
          "Accept-Encoding": "gzip, deflate",
          "Connection": "keep-alive",
          "Upgrade-Insecure-Requests": "1",
        },
        signal: AbortSignal.timeout(15000),
      })
      if (!res.ok) {
        if (res.status >= 500 && i < retries) {
          console.log(`Direct fetch ${url} returned ${res.status}, retrying...`)
          await new Promise(r => setTimeout(r, 1000 * Math.pow(2, i)))
          continue
        }
        return null
      }
      return res.text()
    } catch (e) {
      if (i < retries) {
        console.log(`Direct fetch error for ${url}, retrying...`, e)
        await new Promise(r => setTimeout(r, 1000 * Math.pow(2, i)))
        continue
      }
      console.error(`Direct fetch error for ${url}:`, e)
      return null
    }
  }
  return null
}

// ============ PhantomJsCloud API (fallback) ============

const PHANTOMJS_API_KEY = "a-demo-key-with-low-quota-per-ip-address"

async function fetchRenderedHtml(url: string): Promise<string | null> {
  const requestPayload = {
    url,
    renderType: "html",
    requestSettings: {
      doneWhen: [
        { event: "domReady" },
        { event: "timeout", ms: 8000 },
      ],
      userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    },
    renderSettings: {
      viewport: { width: 1280, height: 800 },
    },
  }

  try {
    const apiUrl = `https://phantomjscloud.com/api/browser/v2/${PHANTOMJS_API_KEY}/?request=${encodeURIComponent(JSON.stringify(requestPayload))}`
    const res = await fetch(apiUrl)

    if (!res.ok) {
      console.error(`PhantomJsCloud failed: ${res.status} for ${url}`)
      return null
    }

    const data = await res.text()
    if (data.includes("Access Denied") || data.includes("Cloudflare")) {
      console.error(`PhantomJsCloud blocked: ${url}`)
      return null
    }
    return data
  } catch (e) {
    console.error(`PhantomJsCloud error for ${url}:`, e)
    return null
  }
}

// ============ 提取 rb3-prerender-data-cache JSON ============

function extractPrerenderCache(html: string): Record<string, any> | null {
  const cachePattern = /<script type="application\/json" id="rb3-prerender-data-cache">([\s\S]*?)<\/script>/
  const match = html.match(cachePattern)
  if (!match) return null
  try {
    return JSON.parse(match[1])
  } catch (e) {
    console.error("Failed to parse prerender cache JSON:", e)
    return null
  }
}

// ============ 从主页提取行程 URL ============

function extractItineraryUrlFromCache(cacheData: Record<string, any>): string | null {
  for (const key of Object.keys(cacheData)) {
    if (key.includes("pageTabs")) {
      const value = cacheData[key]
      const tabs = value?.data?.data?.tabs
      if (Array.isArray(tabs)) {
        const itineraryTab = tabs.find((t: any) => t.label === "Itinerary")
        if (itineraryTab?.url) {
          return `https://www.wrc.com${itineraryTab.url}`
        }
      }
    }
  }
  return null
}

// ============ 日期解析 ============

const MONTH_MAP: Record<string, number> = {
  January: 1, February: 2, March: 3, April: 4, May: 5, June: 6,
  July: 7, August: 8, September: 9, October: 10, November: 11, December: 12,
}

function parseDateText(dateText: string, fallbackDate: string): [number, number, number] {
  const match = dateText.match(/(\w+),\s*(\d{1,2})\s+(\w+)/)
  if (match) {
    const day = parseInt(match[2], 10)
    const month = MONTH_MAP[match[3]]
    const [startY] = fallbackDate.split("-").map(Number)
    if (month) return [startY, month, day]
  }
  const [y, m, d] = fallbackDate.split("-").map(Number)
  return [y, m, d]
}

// ============ 从行程页面解析 FAQ 数据 ============

interface ItineraryDay {
  date: [number, number, number]
  stages: { time: string; name: string; isPowerStage: boolean }[]
}

function stripScriptsAndStyles(html: string): string {
  return html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, "")
}

function parseItineraryFromHtml(html: string, fallbackDate: string): ItineraryDay[] | null {
  // 先移除 script/style，避免 JSON / CSS 中的 `xx:xx` 被误识别为赛段时间
  const cleanHtml = stripScriptsAndStyles(html)
  const daySections: ItineraryDay[] = []
  
  const dayPattern = /<div[^>]*class="[^"]*(?:day|date)[^"]*"[^>]*>([\s\S]*?)<\/div>/gi
  let dayMatch
  
  while ((dayMatch = dayPattern.exec(cleanHtml)) !== null) {
    const dayContent = dayMatch[1]
    
    const dateTextMatch = dayContent.match(/(\w+),\s*(\d{1,2})\s+(\w+)/)
    if (!dateTextMatch) continue
    
    const day = parseInt(dateTextMatch[2], 10)
    const month = MONTH_MAP[dateTextMatch[3]]
    const [startY] = fallbackDate.split("-").map(Number)
    
    if (!month) continue
    
    const stages: { time: string; name: string; isPowerStage: boolean }[] = []
    
    const stagePattern = /cosmos-text[^>]*>(\d{1,2}:\d{2}):\s*(.+?)<\/cosmos-text>/gi
    let stageMatch
    
    while ((stageMatch = stagePattern.exec(dayContent)) !== null) {
      const time = stageMatch[1].padStart(5, "0")
      const name = stageMatch[2].trim()
      const isPowerStage = name.toLowerCase().includes("power stage") || name.toLowerCase().includes("wolf power")
      stages.push({ time, name, isPowerStage })
    }
    
    if (stages.length === 0) {
      const altStagePattern = />(\d{1,2}:\d{2}):\s*([^<]+)</g
      while ((stageMatch = altStagePattern.exec(dayContent)) !== null) {
        const time = stageMatch[1].padStart(5, "0")
        const name = stageMatch[2].trim()
        const isPowerStage = name.toLowerCase().includes("power stage") || name.toLowerCase().includes("wolf power")
        stages.push({ time, name, isPowerStage })
      }
    }
    
    if (stages.length > 0) {
      daySections.push({ date: [startY, month, day], stages })
    }
  }
  
  if (daySections.length === 0) {
    const allStagePattern = /(\d{1,2}:\d{2}):\s*([^<\n]+)/g
    const allStages: { time: string; name: string; isPowerStage: boolean }[] = []
    let match
    
    while ((match = allStagePattern.exec(cleanHtml)) !== null) {
      const time = match[1].padStart(5, "0")
      const name = match[2].trim()
      if (!name || name.length < 3 || name.length > 120) continue
      if (name.includes("UTC") || name.includes("Version") || name.includes("Stage") || name.includes("km")) {
        const isPowerStage = name.toLowerCase().includes("power stage") || name.toLowerCase().includes("wolf power")
        allStages.push({ time, name, isPowerStage })
      }
    }
    
    if (allStages.length > 0) {
      const [y, m, d] = fallbackDate.split("-").map(Number)
      daySections.push({ date: [y, m, d], stages: allStages })
    }
  }
  
  if (daySections.length > 0) {
    console.log(`Parsed ${daySections.length} days from HTML`)
    return daySections
  }
  
  console.error("No itinerary data found in HTML")
  return null
}

function parseItineraryFromCache(cacheData: Record<string, any>, fallbackDate: string): ItineraryDay[] | null {
  for (const key of Object.keys(cacheData)) {
    const value = cacheData[key]
    if (!value?.data?.data) continue

    const items = value.data.data.items
    if (!Array.isArray(items)) continue

    for (const item of items) {
      if (item.type !== "faq") continue

      const title = item.title || ""
      if (!title.toLowerCase().includes("itinerary") && !title.includes("UTC") && !title.includes("Version")) continue

      const elements = item.elements
      if (!Array.isArray(elements)) continue

      const days: ItineraryDay[] = []

      for (const element of elements) {
        const question = element.question
        const answer = element.answer

        if (!Array.isArray(question) || !Array.isArray(answer)) continue

        const dateText = question.find((q: any) => q.variant === "text")?.text || ""
        const date = parseDateText(dateText, fallbackDate)

        const stages: { time: string; name: string; isPowerStage: boolean }[] = []

        for (const ans of answer) {
          if (ans.type !== "list" || !Array.isArray(ans.items)) continue

          for (const listItem of ans.items) {
            if (!listItem.elements) continue
            for (const el of listItem.elements) {
              if (el.variant !== "text") continue
              const text = el.text || ""

              const stageMatch = text.match(/^(\d{1,2}:\d{2}):\s*(.+)$/)
              if (!stageMatch) continue

              const time = stageMatch[1].padStart(5, "0")
              const name = stageMatch[2].trim()
              const isPowerStage = name.toLowerCase().includes("power stage") || name.toLowerCase().includes("wolf power")

              stages.push({ time, name, isPowerStage })
            }
          }
        }

        if (stages.length > 0) {
          days.push({ date, stages })
        }
      }

      if (days.length > 0) return days
    }
  }

  console.error("No itinerary FAQ found in prerender cache")
  return null
}

// ============ ocblacktop API (第四层 fallback) ============

const OCBLACKTOP_API_KEY = process.env.OCBLACKTOP_API_KEY
const OCBLACKTOP_BASE = "https://api.ocblacktop.com"

async function fetchOcblacktop<T = any>(path: string): Promise<T | null> {
  if (!OCBLACKTOP_API_KEY) return null
  try {
    const res = await fetch(`${OCBLACKTOP_BASE}${path}`, {
      headers: {
        "X-API-Key": OCBLACKTOP_API_KEY,
        "Accept": "application/json",
      },
      // Vercel Hobby 默认 10s；ocblacktop 响应通常很快
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) {
      console.error(`ocblacktop ${path} failed: ${res.status}`)
      return null
    }
    return (await res.json()) as T
  } catch (e) {
    console.error(`ocblacktop ${path} error:`, e)
    return null
  }
}

function pickString(obj: any, ...keys: string[]): string | undefined {
  for (const key of keys) {
    const v = obj?.[key]
    if (typeof v === "string" && v) return v
  }
  return undefined
}

function pickDateField(obj: any, ...keys: string[]): string | undefined {
  for (const key of keys) {
    const v = obj?.[key]
    if (typeof v === "string" && v) return v
    if (v instanceof Date) return v.toISOString()
  }
  return undefined
}

function normalizeName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, " ").replace(/\s+/g, " ").trim()
}

function rallyNameMatches(a: string, b: string): boolean {
  const na = normalizeName(a)
  const nb = normalizeName(b)
  if (na === nb) return true
  // 互相包含：如 "WRC Rallye Monte-Carlo" vs "Rallye Monte-Carlo"
  if (na.includes(nb) || nb.includes(na)) return true
  // 取词袋交集，至少 2 个词相同
  const sa = new Set(na.split(" "))
  const sb = new Set(nb.split(" "))
  const common = [...sa].filter((w) => sb.has(w) && w.length > 2)
  return common.length >= 2
}

interface OcblacktopRallySummary {
  id?: string
  name?: string
  dateStart?: string
  dateEnd?: string
  startDate?: string
  endDate?: string
  timeZone?: string
  timezone?: string
  location?: { name?: string; country?: { name?: string; twoCode?: string; threeCode?: string } }
}

interface OcblacktopStage {
  name?: string
  title?: string
  scheduledStart?: string
  scheduledStartTime?: string
  scheduledStartTimeUtc?: string
  startTime?: string
  date?: string
  time?: string
  isPowerStage?: boolean
  powerStage?: boolean
  distanceKm?: number
}

async function fetchOcblacktopRallies(): Promise<OcblacktopRallySummary[] | null> {
  const res = await fetchOcblacktop<{ data?: OcblacktopRallySummary[] }>("/v1/wrc/rallies?limit=50")
  if (!res?.data || !Array.isArray(res.data)) return null
  return res.data
}

async function fetchOcblacktopRallyDetail(rallyId: string): Promise<any | null> {
  return fetchOcblacktop(`/v1/wrc/rallies/${rallyId}`)
}

function parseStageTime(stage: OcblacktopStage, rallyTz: string): { utc: string; isMain: boolean } | null {
  const name = pickString(stage, "name", "title") ?? "赛段"
  const isMain = !!(stage?.isPowerStage ?? stage?.powerStage ?? name.toLowerCase().includes("power stage"))

  // 优先使用明确的 UTC 时间
  const utcStr = pickDateField(stage, "scheduledStartTimeUtc", "scheduledStart", "scheduledStartTime", "startTime")
  if (utcStr) {
    const d = new Date(utcStr)
    if (!isNaN(d.getTime())) return { utc: d.toISOString(), isMain }
  }

  // 尝试组合 date + time，按 rally 时区解释
  const dateStr = pickDateField(stage, "date")
  const timeStr = pickString(stage, "time")
  if (dateStr && timeStr) {
    const base = new Date(dateStr)
    if (!isNaN(base.getTime())) {
      const m = timeStr.match(/(\d{1,2}):(\d{2})/)
      if (m) {
        const [y, mo, d] = [base.getFullYear(), base.getMonth() + 1, base.getDate()]
        const utc = zonedWallTimeToUtc(y, mo, d, Number(m[1]), Number(m[2]), rallyTz)
        return { utc: utc.toISOString(), isMain }
      }
    }
  }

  return null
}

function convertOcblacktopStages(detail: any, rallyTz: string): RaceSession[] | null {
  if (!detail || typeof detail !== "object") return null

  // 详情可能直接是对象，也可能包在 data 里
  const payload = detail.data ?? detail

  // 尝试多个可能的 stage 容器字段
  const stageContainers = [
    payload?.stages,
    payload?.schedule,
    payload?.events,
    payload?.itinerary,
    payload?.stageSchedule,
  ].filter(Boolean)

  let rawStages: any[] = []
  for (const container of stageContainers) {
    const arr = Array.isArray(container) ? container : container?.items ?? container?.stages ?? container?.events
    if (Array.isArray(arr) && arr.length > 0) {
      rawStages = arr
      break
    }
  }

  if (rawStages.length === 0) return null

  const sessions: RaceSession[] = []
  for (const stage of rawStages) {
    const parsed = parseStageTime(stage, rallyTz)
    if (!parsed) continue
    const name = pickString(stage, "name", "title") ?? "赛段"
    sessions.push({
      name,
      utc: parsed.utc,
      isMain: parsed.isMain,
    })
  }

  sessions.sort((a, b) => a.utc.localeCompare(b.utc))
  return sessions.length > 0 ? sessions : null
}

async function tryOcblacktopFallback(
  rally: WrcRally,
  ocblacktopRallies: OcblacktopRallySummary[] | null,
): Promise<RaceSession[] | null> {
  if (!ocblacktopRallies || ocblacktopRallies.length === 0) return null

  const match = ocblacktopRallies.find((r) => {
    const candidate = pickString(r, "name")
    return candidate && rallyNameMatches(candidate, rally.name)
  })

  if (!match?.id) {
    console.log(`ocblacktop: no name match for ${rally.name}`)
    return null
  }

  const detail = await fetchOcblacktopRallyDetail(match.id)
  if (!detail) return null

  const tz = pickString(match, "timeZone", "timezone") ?? rally.tz
  const sessions = convertOcblacktopStages(detail, tz)
  if (sessions && sessions.length > 0) {
    console.log(`ocblacktop success: ${rally.name} (${sessions.length} sessions)`)
  }
  return sessions
}

// ============ 主爬取函数 ============

async function scrapeWrcItinerary(eventSlug: string, tz: string, startDate: string): Promise<RaceSession[] | null> {
  const homeUrl = `https://www.wrc.com/en/events/${eventSlug}`
  console.log(`WRC: fetching ${homeUrl}`)

  // Step 1: Fetch homepage to get itinerary URL
  let homeHtml = await fetchDirect(homeUrl)
  if (!homeHtml || !homeHtml.includes("rb3-prerender-data-cache")) {
    console.log(`WRC: direct fetch failed, trying PhantomJsCloud for ${homeUrl}`)
    homeHtml = await fetchRenderedHtml(homeUrl)
  }
  if (!homeHtml) {
    console.error(`WRC: failed to fetch homepage for ${eventSlug}`)
    return null
  }

  const homeCache = extractPrerenderCache(homeHtml)
  if (!homeCache) {
    console.error(`WRC: no prerender cache in homepage for ${eventSlug}`)
    return null
  }

  // Step 2: Extract itinerary URL from pageTabs
  let itineraryUrl = extractItineraryUrlFromCache(homeCache)
  if (!itineraryUrl) {
    itineraryUrl = `https://www.wrc.com/en/events/${eventSlug}/itinerary-${eventSlug}`
    console.log(`WRC: pageTabs not found, trying fallback itinerary URL: ${itineraryUrl}`)
  } else {
    console.log(`WRC: found itinerary URL: ${itineraryUrl}`)
  }

  // Step 3: Fetch itinerary page
  let itineraryHtml = await fetchDirect(itineraryUrl)
  if (!itineraryHtml || !itineraryHtml.includes("rb3-prerender-data-cache")) {
    console.log(`WRC: direct fetch failed, trying PhantomJsCloud for ${itineraryUrl}`)
    itineraryHtml = await fetchRenderedHtml(itineraryUrl)
  }
  if (!itineraryHtml) {
    console.error(`WRC: failed to fetch itinerary page for ${eventSlug}`)
    return null
  }

  // Step 4: Parse FAQ data
  const itineraryCache = extractPrerenderCache(itineraryHtml)
  if (!itineraryCache) {
    console.error(`WRC: no prerender cache in itinerary page for ${eventSlug}`)
    return null
  }

  let days = parseItineraryFromCache(itineraryCache, startDate)
  if (!days || days.length === 0) {
    console.log(`WRC: no itinerary data in cache, trying HTML parsing for ${eventSlug}`)
    days = parseItineraryFromHtml(itineraryHtml, startDate)
  }
  if (!days || days.length === 0) {
    console.error(`WRC: no itinerary data parsed for ${eventSlug}`)
    return null
  }

  // Step 5: Convert to RaceSession
  const sessions: RaceSession[] = []

  for (const day of days) {
    const [y, m, d] = day.date
    for (const stage of day.stages) {
      const [h, min] = stage.time.split(":").map(Number)
      if (isNaN(h) || isNaN(min)) continue
      sessions.push({
        name: stage.name,
        utc: zonedWallTimeToUtc(y, m, d, h, min, tz).toISOString(),
        isMain: stage.isPowerStage,
      })
    }
  }

  sessions.sort((a, b) => a.utc.localeCompare(b.utc))
  console.log(`WRC: parsed ${sessions.length} sessions for ${eventSlug}`)
  return sessions
}

// ============ WRC 赛事列表 ============

interface WrcRally {
  round: number
  name: string
  hq: string
  city: string
  country: string
  code: string
  tz: string
  eventSlug: string
  startDate: string
}

const WRC_RALLIES: WrcRally[] = [
  { round: 1, name: "蒙特卡洛拉力赛", hq: "加普（Gap）", city: "普罗旺斯", country: "法国", code: "FR", tz: "Europe/Paris", eventSlug: "wrc-rallye-monte-carlo-2026", startDate: "2026-01-22" },
  { round: 2, name: "瑞典拉力赛", hq: "于默奥（Umeå）", city: "西博滕省", country: "瑞典", code: "SE", tz: "Europe/Stockholm", eventSlug: "wrc-rally-sweden-2026", startDate: "2026-02-13" },
  { round: 3, name: "肯尼亚狩猎拉力赛", hq: "内罗毕", city: "纳库鲁郡", country: "肯尼亚", code: "KE", tz: "Africa/Nairobi", eventSlug: "wrc-safari-rally-kenya-2026", startDate: "2026-03-20" },
  { round: 4, name: "克罗地亚拉力赛", hq: "里耶卡（Rijeka）", city: "滨海高地县", country: "克罗地亚", code: "HR", tz: "Europe/Zagreb", eventSlug: "wrc-croatia-rally-2026", startDate: "2026-04-10" },
  { round: 5, name: "加那利群岛拉力赛", hq: "拉斯帕尔马斯", city: "大加那利岛", country: "西班牙", code: "ES", tz: "Atlantic/Canary", eventSlug: "wrc-rally-islas-canarias-2026", startDate: "2026-04-25" },
  { round: 6, name: "葡萄牙拉力赛", hq: "马托西纽什", city: "波尔图", country: "葡萄牙", code: "PT", tz: "Europe/Lisbon", eventSlug: "wrc-rally-de-portugal-2026", startDate: "2026-05-15" },
  { round: 7, name: "日本拉力赛", hq: "丰田市", city: "爱知县", country: "日本", code: "JP", tz: "Asia/Tokyo", eventSlug: "wrc-rally-japan-2026", startDate: "2026-05-29" },
  { round: 8, name: "希腊卫城拉力赛", hq: "卢特拉基（Loutraki）", city: "科林西亚", country: "希腊", code: "GR", tz: "Europe/Athens", eventSlug: "wrc-acropolis-rally-greece-2026", startDate: "2026-06-26" },
  { round: 9, name: "爱沙尼亚拉力赛", hq: "塔尔图（Tartu）", city: "塔尔图", country: "爱沙尼亚", code: "EE", tz: "Europe/Tallinn", eventSlug: "wrc-delfi-rally-estonia-2026", startDate: "2026-07-17" },
  { round: 10, name: "芬兰拉力赛", hq: "于韦斯屈莱", city: "中芬兰", country: "芬兰", code: "FI", tz: "Europe/Helsinki", eventSlug: "wrc-secto-rally-finland-2026", startDate: "2026-08-07" },
  { round: 11, name: "巴拉圭拉力赛", hq: "恩卡纳西翁", city: "伊塔普阿", country: "巴拉圭", code: "PY", tz: "America/Asuncion", eventSlug: "wrc-rally-del-paraguay-2026", startDate: "2026-08-28" },
  { round: 12, name: "智利拉力赛", hq: "康塞普西翁", city: "比奥比奥", country: "智利", code: "CL", tz: "America/Santiago", eventSlug: "wrc-rally-chile-bio-bio-2026", startDate: "2026-09-11" },
  { round: 13, name: "意大利撒丁岛拉力赛", hq: "阿尔盖罗（Alghero）", city: "撒丁岛", country: "意大利", code: "IT", tz: "Europe/Rome", eventSlug: "wrc-rally-italia-sardegna-2026", startDate: "2026-10-09" },
  { round: 14, name: "沙特阿拉伯拉力赛", hq: "吉达（Jeddah）", city: "麦加省", country: "沙特阿拉伯", code: "SA", tz: "Asia/Riyadh", eventSlug: "wrc-rally-saudi-arabia-2026", startDate: "2026-11-13" },
]

// ============ 主函数 ============

export async function fetchWrc(): Promise<{ events: RaceEvent[]; ok: boolean; note?: string }> {
  const fallbackEvents = buildWrcEvents()
  const events: RaceEvent[] = [...fallbackEvents]
  let successCount = 0
  let ocblacktopCount = 0
  const errors: string[] = []

  const now = Date.now()
  const thirtyDays = 30 * 24 * 60 * 60 * 1000
  const recentRallies = WRC_RALLIES.filter(r => {
    const rallyTime = new Date(r.startDate).getTime()
    return rallyTime >= now - thirtyDays && rallyTime <= now + thirtyDays * 2
  })

  const rallies = recentRallies.length > 0 ? recentRallies : WRC_RALLIES.slice(0, 2)

  console.log(`WRC: scraping ${rallies.length} rallies (filtered by date)`)

  // 预取 ocblacktop rally 列表，作为第四层 fallback 的名称索引
  const ocblacktopRallies = OCBLACKTOP_API_KEY ? await fetchOcblacktopRallies() : null
  if (OCBLACKTOP_API_KEY) {
    console.log(`ocblacktop: ${ocblacktopRallies ? ocblacktopRallies.length : 0} rallies indexed`)
  }

  const results = await Promise.allSettled(
    rallies.map(async (rally) => {
      // 第一层：直接 fetch WRC 官网
      let sessions = await scrapeWrcItinerary(rally.eventSlug, rally.tz, rally.startDate)
      let source = "wrc-official"

      // 第四层 fallback：ocblacktop API
      if ((!sessions || sessions.length === 0) && ocblacktopRallies) {
        sessions = await tryOcblacktopFallback(rally, ocblacktopRallies)
        if (sessions && sessions.length > 0) source = "ocblacktop"
      }

      return { rally, sessions, source }
    })
  )

  for (const result of results) {
    if (result.status === "fulfilled") {
      const { rally, sessions, source } = result.value
      if (sessions && sessions.length > 0) {
        const index = events.findIndex((e) => e.round === rally.round)
        if (index !== -1) {
          events[index] = {
            ...events[index],
            sessions,
            url: source === "ocblacktop"
              ? `https://ocblacktop.com`
              : `https://www.wrc.com/en/events/${rally.eventSlug}`,
            tentative: source === "ocblacktop",
          }
        }
        if (source === "ocblacktop") {
          ocblacktopCount++
        } else {
          successCount++
        }
        console.log(`WRC success (${source}): ${rally.name} (${sessions.length} sessions)`)
      } else {
        errors.push(rally.name)
        console.log(`WRC failed: ${rally.name} (using fallback)`)
      }
    } else {
      console.error(`WRC error: ${result.reason}`)
    }
  }

  const ok = successCount > 0 || ocblacktopCount > 0
  const parts: string[] = []
  if (successCount > 0) parts.push(`${successCount} 场官网爬取成功`)
  if (ocblacktopCount > 0) parts.push(`${ocblacktopCount} 场来自 ocblacktop fallback`)
  if (errors.length > 0) parts.push(`${errors.length} 场使用估计数据（${errors.join(", ")}）`)
  const note = parts.length > 0 ? parts.join("，") : "所有爬取的赛事均获取成功"

  return { events, ok, note }
}
