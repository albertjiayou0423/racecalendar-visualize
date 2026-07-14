import type { RaceEvent, RaceSession } from "./types"
import { zonedWallTimeToUtc } from "./tz"
import { buildWrcEvents } from "./wrc-data"

// ============ PhantomJsCloud API ============

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
    const res = await fetch(apiUrl, { next: { revalidate: 86400 } })

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
    console.error(`PhantomJsCloud error: ${e}`)
    return null
  }
}

// ============ 直接 fetch (不需要渲染的页面) ============

async function fetchDirect(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml",
        "Accept-Language": "en-US,en;q=0.9",
      },
      next: { revalidate: 86400 },
    })
    if (!res.ok) return null
    return res.text()
  } catch (e) {
    console.error(`Direct fetch error: ${e}`)
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

// ============ 从行程页面解析 FAQ 数据 ============

interface ItineraryDay {
  stages: { time: string; name: string; isPowerStage: boolean }[]
}

function parseItineraryFromCache(cacheData: Record<string, any>): ItineraryDay[] | null {
  for (const key of Object.keys(cacheData)) {
    const value = cacheData[key]
    if (!value?.data?.data) continue

    const items = value.data.data.items
    if (!Array.isArray(items)) continue

    for (const item of items) {
      if (item.type !== "faq") continue

      // Itinerary FAQ title usually contains "UTC" or "Version"
      const title = item.title || ""
      if (!title.toLowerCase().includes("itinerary") && !title.includes("UTC") && !title.includes("Version")) continue

      const elements = item.elements
      if (!Array.isArray(elements)) continue

      const days: ItineraryDay[] = []

      for (const element of elements) {
        const question = element.question
        const answer = element.answer

        if (!Array.isArray(question) || !Array.isArray(answer)) continue

        // Extract stage data from the answer list
        const stages: { time: string; name: string; isPowerStage: boolean }[] = []

        for (const ans of answer) {
          if (ans.type !== "list" || !Array.isArray(ans.items)) continue

          for (const listItem of ans.items) {
            if (!listItem.elements) continue
            for (const el of listItem.elements) {
              if (el.variant !== "text") continue
              const text = el.text || ""

              // Parse: "08:01: Shakedown Kastre (4.08 km)" or "13:03: SS1 Raanitsa 1 (21.45 km)"
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
          days.push({ stages })
        }
      }

      if (days.length > 0) return days
    }
  }

  console.error("No itinerary FAQ found in prerender cache")
  return null
}

// ============ 主爬取函数 ============

async function scrapeWrcItinerary(eventSlug: string, tz: string, startDate: string): Promise<RaceSession[] | null> {
  const homeUrl = `https://www.wrc.com/en/events/${eventSlug}`
  console.log(`WRC: fetching homepage ${homeUrl}`)

  // Step 1: Fetch homepage to get the correct itinerary URL
  let homeHtml = await fetchDirect(homeUrl)
  if (!homeHtml || !homeHtml.includes("rb3-prerender-data-cache")) {
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
    // Fallback: try direct URL pattern
    itineraryUrl = `https://www.wrc.com/en/events/${eventSlug}/itinerary-${eventSlug}`
    console.log(`WRC: pageTabs not found, trying fallback itinerary URL: ${itineraryUrl}`)
  } else {
    console.log(`WRC: found itinerary URL: ${itineraryUrl}`)
  }

  // Step 3: Fetch itinerary page
  let itineraryHtml = await fetchDirect(itineraryUrl)
  if (!itineraryHtml || !itineraryHtml.includes("rb3-prerender-data-cache")) {
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

  const days = parseItineraryFromCache(itineraryCache)
  if (!days || days.length === 0) {
    console.error(`WRC: no itinerary data parsed for ${eventSlug}`)
    return null
  }

  // Step 5: Convert to RaceSession using startDate for correct dates
  // The FAQ date text can have errors (e.g., "Sunday, 18 July" when it should be 19 July),
  // so we use startDate + dayIndex for reliable date calculation
  const [startY, startM, startD] = startDate.split("-").map(Number)
  const sessions: RaceSession[] = []

  for (let dayIdx = 0; dayIdx < days.length; dayIdx++) {
    const day = days[dayIdx]
    const date = new Date(Date.UTC(startY, startM - 1, startD + dayIdx))
    const y = date.getUTCFullYear()
    const m = date.getUTCMonth() + 1
    const d = date.getUTCDate()

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
  const errors: string[] = []

  // 只爬取当前时间前后 60 天内的赛事，避免超时
  const now = Date.now()
  const sixtyDays = 60 * 24 * 60 * 60 * 1000
  const ralliesToScrape = WRC_RALLIES.filter(r => {
    const rallyTime = new Date(r.startDate).getTime()
    return Math.abs(rallyTime - now) < sixtyDays
  })

  // 如果没有临近赛事，至少尝试爬取最近的 2 场
  const rallies = ralliesToScrape.length > 0 ? ralliesToScrape : WRC_RALLIES.slice(0, 2)

  console.log(`WRC: scraping ${rallies.length} rallies (filtered by date)`)

  for (const rally of rallies) {
    const sessions = await scrapeWrcItinerary(rally.eventSlug, rally.tz, rally.startDate)

    if (sessions && sessions.length > 0) {
      const index = events.findIndex((e) => e.round === rally.round)
      if (index !== -1) {
        events[index] = {
          ...events[index],
          sessions,
          url: `https://www.wrc.com/en/events/${rally.eventSlug}`,
        }
      }

      successCount++
      console.log(`WRC success: ${rally.name} (${sessions.length} sessions)`)
    } else {
      errors.push(rally.name)
      console.log(`WRC failed: ${rally.name} (using fallback)`)
    }
  }

  const ok = successCount > 0
  const note = errors.length > 0
    ? `${successCount} 场爬取成功，${errors.length} 场使用估计数据（${errors.join(", ")}）`
    : "所有爬取的赛事均获取成功"

  return { events, ok, note }
}
