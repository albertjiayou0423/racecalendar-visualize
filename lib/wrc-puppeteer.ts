import type { RaceEvent, RaceSession } from "./types"
import { zonedWallTimeToUtc } from "./tz"
import { buildWrcEvents } from "./wrc-data"

interface WrcStage {
  name: string
  time: string
  isPowerStage?: boolean
}

interface WrcDay {
  date: string
  stages: WrcStage[]
}

// ============ 方案 1: @sparticuz/chromium + puppeteer-core (Vercel 本地) ============

async function scrapeWithChromium(url: string): Promise<string | null> {
  try {
    const isVercel = !!process.env.VERCEL_ENV
    let puppeteer: any
    let launchOptions: any = { headless: true }

    if (isVercel) {
      const chromium = (await import("@sparticuz/chromium")).default
      puppeteer = await import("puppeteer-core")
      launchOptions = {
        args: chromium.args,
        executablePath: await chromium.executablePath(),
        headless: true,
      }
    } else {
      puppeteer = await import("puppeteer")
    }

    const browser = await puppeteer.launch(launchOptions)
    const page = await browser.newPage()
    await page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")

    await page.goto(url, { waitUntil: "networkidle2", timeout: 30000 })
    await page.waitForTimeout(3000)

    const html = await page.content()
    await browser.close()
    return html
  } catch (e) {
    console.error(`Chromium scrape failed for ${url}: ${e}`)
    return null
  }
}

// ============ 方案 2: PhantomJsCloud API (备用) ============

const PHANTOMJS_API_KEY = "a-demo-key-with-low-quota-per-ip-address"

async function scrapeWithPhantomJsCloud(url: string): Promise<string | null> {
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

// ============ 混合爬取：先 Chromium，失败回退 PhantomJsCloud ============

async function fetchRenderedHtml(url: string): Promise<string | null> {
  // 方案 1: 本地 Chromium
  let html = await scrapeWithChromium(url)
  if (html && html.length > 5000) return html

  // 方案 2: PhantomJsCloud
  console.log(`Chromium failed, falling back to PhantomJsCloud: ${url}`)
  html = await scrapeWithPhantomJsCloud(url)
  return html
}

// ============ 解析逻辑 ============

function parseWrcItinerary(html: string): WrcDay[] | null {
  const result: WrcDay[] = []

  const dayPattern = /(Friday|Saturday|Sunday), (\d{1,2}) (July|June|May|April|March|February|January|August|September|October|November|December)/gi
  const timePattern = /(\d{2}:\d{2}):\s*(Shakedown|SS\d+|SSS\d+)/gi

  const dayMatches = [...html.matchAll(dayPattern)]
  const timeMatches = [...html.matchAll(timePattern)]

  if (dayMatches.length === 0 || timeMatches.length === 0) return null

  const months: Record<string, number> = {
    January: 1, February: 2, March: 3, April: 4, May: 5, June: 6,
    July: 7, August: 8, September: 9, October: 10, November: 11, December: 12,
  }

  const currentYear = new Date().getFullYear()
  const seenDates = new Set<string>()
  const uniqueDays: { dayName: string; day: number; month: number; monthName: string }[] = []

  for (const match of dayMatches) {
    const dayName = match[1]
    const day = parseInt(match[2], 10)
    const monthName = match[3]
    const month = months[monthName]
    if (!month || day < 1 || day > 31) continue
    const dateKey = `${dayName}-${day}-${monthName}`
    if (seenDates.has(dateKey)) continue
    seenDates.add(dateKey)
    uniqueDays.push({ dayName, day, month, monthName })
  }

  if (uniqueDays.length === 0) return null

  const dayOrder = ['Friday', 'Saturday', 'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday']
  const firstIndex = dayOrder.indexOf(uniqueDays[0].dayName)

  const correctedDays = uniqueDays.map((_, i) => {
    const expectedIndex = (firstIndex + i) % 7
    let correctedDay = uniqueDays[0].day + i
    let correctedMonth = uniqueDays[0].month
    if (correctedDay > 31) {
      correctedDay -= 31
      correctedMonth++
    }
    return {
      dayName: dayOrder[expectedIndex],
      day: correctedDay,
      month: correctedMonth,
      monthName: Object.keys(months).find(k => months[k] === correctedMonth) || uniqueDays[0].monthName,
    }
  })

  let timeIndex = 0
  for (const { dayName, day, monthName } of correctedDays) {
    const dateStr = `${dayName}, ${day} ${monthName} ${currentYear}`
    const stages: WrcStage[] = []

    while (timeIndex < timeMatches.length) {
      const timeMatch = timeMatches[timeIndex]
      const time = timeMatch[1]
      let name = timeMatch[2].trim()
      const isPowerStage = html.substring((timeMatch.index || 0), (timeMatch.index || 0) + 100).includes("Power")

      if (name.startsWith("SS")) {
        name = name + (isPowerStage ? " (Power Stage)" : "")
      } else if (name.includes("Shakedown")) {
        name = "排位测试赛段 (Shakedown)"
      }

      stages.push({ name, time, isPowerStage })
      timeIndex++

      const nextTimeMatch = timeMatches[timeIndex]
      if (nextTimeMatch && nextTimeMatch[1] < time) break
    }

    if (stages.length > 0) result.push({ date: dateStr, stages })
  }

  return result.length > 0 ? result : null
}

function extractItineraryUrl(html: string): string | null {
  const cachePattern = /<script type="application\/json" id="rb3-prerender-data-cache">([\s\S]*?)<\/script>/
  const match = html.match(cachePattern)
  if (!match) return null

  try {
    const cacheData = JSON.parse(match[1])
    for (const key of Object.keys(cacheData)) {
      if (key.includes('pageTabs')) {
        const value = cacheData[key]
        if (value?.data?.data?.tabs) {
          const itineraryTab = value.data.data.tabs.find((t: any) => t.label === 'Itinerary')
          if (itineraryTab?.url) return `https://www.wrc.com${itineraryTab.url}`
        }
      }
    }
  } catch { /* ignore */ }
  return null
}

async function scrapeWrcItinerary(url: string): Promise<WrcDay[] | null> {
  try {
    const mainPageHtml = await fetchRenderedHtml(url)
    if (!mainPageHtml) return null

    const itineraryUrl = extractItineraryUrl(mainPageHtml)
    if (!itineraryUrl) {
      console.error(`No itinerary URL found for: ${url}`)
      return null
    }

    console.log(`Found itinerary URL: ${itineraryUrl}`)
    const itineraryHtml = await fetchRenderedHtml(itineraryUrl)
    if (!itineraryHtml) return null

    return parseWrcItinerary(itineraryHtml)
  } catch (err) {
    console.error(`WRC fetch error: ${url}`, err)
    return null
  }
}

function dateStrToYmd(dateStr: string): [number, number, number] | null {
  const months: Record<string, number> = {
    January: 1, February: 2, March: 3, April: 4, May: 5, June: 6,
    July: 7, August: 8, September: 9, October: 10, November: 11, December: 12,
  }
  const match = dateStr.match(/\w+,\s*(\d{1,2})\s+(\w+)\s+(\d{4})/)
  if (!match) return null
  const d = parseInt(match[1], 10)
  const m = months[match[2]]
  const y = parseInt(match[3], 10)
  return m ? [y, m, d] : null
}

function wrcStageToSession(stage: WrcStage, date: [number, number, number], tz: string): RaceSession | null {
  const [y, m, d] = date
  const [h, min] = stage.time.split(":").map(Number)
  if (isNaN(h) || isNaN(min)) return null
  return {
    name: stage.name,
    utc: zonedWallTimeToUtc(y, m, d, h, min, tz).toISOString(),
    isMain: stage.isPowerStage,
  }
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
  url: string
  startDate: string // ISO date for filtering
}

const WRC_RALLIES: WrcRally[] = [
  { round: 1, name: "蒙特卡洛拉力赛", hq: "加普（Gap）", city: "普罗旺斯", country: "法国", code: "FR", tz: "Europe/Paris", url: "https://www.wrc.com/en/events/wrc-rallye-monte-carlo-2026", startDate: "2026-01-22" },
  { round: 2, name: "瑞典拉力赛", hq: "于默奥（Umeå）", city: "西博滕省", country: "瑞典", code: "SE", tz: "Europe/Stockholm", url: "https://www.wrc.com/en/events/wrc-rally-sweden-2026", startDate: "2026-02-13" },
  { round: 3, name: "肯尼亚狩猎拉力赛", hq: "内罗毕", city: "纳库鲁郡", country: "肯尼亚", code: "KE", tz: "Africa/Nairobi", url: "https://www.wrc.com/en/events/wrc-safari-rally-kenya-2026", startDate: "2026-03-20" },
  { round: 4, name: "克罗地亚拉力赛", hq: "里耶卡（Rijeka）", city: "滨海高地县", country: "克罗地亚", code: "HR", tz: "Europe/Zagreb", url: "https://www.wrc.com/en/events/wrc-croatia-rally-2026", startDate: "2026-04-10" },
  { round: 5, name: "加那利群岛拉力赛", hq: "拉斯帕尔马斯", city: "大加那利岛", country: "西班牙", code: "ES", tz: "Atlantic/Canary", url: "https://www.wrc.com/en/events/wrc-rally-islas-canarias-2026", startDate: "2026-04-25" },
  { round: 6, name: "葡萄牙拉力赛", hq: "马托西纽什", city: "波尔图", country: "葡萄牙", code: "PT", tz: "Europe/Lisbon", url: "https://www.wrc.com/en/events/wrc-rally-de-portugal-2026", startDate: "2026-05-15" },
  { round: 7, name: "日本拉力赛", hq: "丰田市", city: "爱知县", country: "日本", code: "JP", tz: "Asia/Tokyo", url: "https://www.wrc.com/en/events/wrc-rally-japan-2026", startDate: "2026-05-29" },
  { round: 8, name: "希腊卫城拉力赛", hq: "卢特拉基（Loutraki）", city: "科林西亚", country: "希腊", code: "GR", tz: "Europe/Athens", url: "https://www.wrc.com/en/events/wrc-acropolis-rally-greece-2026", startDate: "2026-06-26" },
  { round: 9, name: "爱沙尼亚拉力赛", hq: "塔尔图（Tartu）", city: "塔尔图", country: "爱沙尼亚", code: "EE", tz: "Europe/Tallinn", url: "https://www.wrc.com/en/events/wrc-delfi-rally-estonia-2026", startDate: "2026-07-17" },
  { round: 10, name: "芬兰拉力赛", hq: "于韦斯屈莱", city: "中芬兰", country: "芬兰", code: "FI", tz: "Europe/Helsinki", url: "https://www.wrc.com/en/events/wrc-secto-rally-finland-2026", startDate: "2026-08-07" },
  { round: 11, name: "巴拉圭拉力赛", hq: "恩卡纳西翁", city: "伊塔普阿", country: "巴拉圭", code: "PY", tz: "America/Asuncion", url: "https://www.wrc.com/en/events/wrc-rally-del-paraguay-2026", startDate: "2026-08-28" },
  { round: 12, name: "智利拉力赛", hq: "康塞普西翁", city: "比奥比奥", country: "智利", code: "CL", tz: "America/Santiago", url: "https://www.wrc.com/en/events/wrc-rally-chile-bio-bio-2026", startDate: "2026-09-11" },
  { round: 13, name: "意大利撒丁岛拉力赛", hq: "阿尔盖罗（Alghero）", city: "撒丁岛", country: "意大利", code: "IT", tz: "Europe/Rome", url: "https://www.wrc.com/en/events/wrc-rally-italia-sardegna-2026", startDate: "2026-10-09" },
  { round: 14, name: "沙特阿拉伯拉力赛", hq: "吉达（Jeddah）", city: "麦加省", country: "沙特阿拉伯", code: "SA", tz: "Asia/Riyadh", url: "https://www.wrc.com/en/events/wrc-rally-saudi-arabia-2026", startDate: "2026-11-13" },
]

// ============ 主函数 ============

export async function fetchWrc(): Promise<{ events: RaceEvent[]; ok: boolean; note?: string }> {
  const fallbackEvents = buildWrcEvents()
  const events: RaceEvent[] = [...fallbackEvents]
  let successCount = 0
  const errors: string[] = []

  // 只爬取当前时间前后 30 天内的赛事，避免 Vercel 超时
  const now = Date.now()
  const thirtyDays = 30 * 24 * 60 * 60 * 1000
  const ralliesToScrape = WRC_RALLIES.filter(r => {
    const rallyTime = new Date(r.startDate).getTime()
    return Math.abs(rallyTime - now) < thirtyDays
  })

  // 如果没有临近赛事，至少尝试爬取最近的 2 场
  const rallies = ralliesToScrape.length > 0 ? ralliesToScrape : WRC_RALLIES.slice(0, 2)

  console.log(`WRC: scraping ${rallies.length} rallies (filtered by date)`)

  for (const rally of rallies) {
    const days = await scrapeWrcItinerary(rally.url)

    if (days && days.length > 0) {
      const sessions: RaceSession[] = []
      for (const day of days) {
        const date = dateStrToYmd(day.date)
        if (!date) continue
        for (const stage of day.stages) {
          const session = wrcStageToSession(stage, date, rally.tz)
          if (session) sessions.push(session)
        }
      }

      sessions.sort((a, b) => a.utc.localeCompare(b.utc))

      const index = events.findIndex((e) => e.round === rally.round)
      if (index !== -1) {
        events[index] = { ...events[index], sessions, url: rally.url }
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
    ? `${successCount} 场爬取成功，${errors.length} 场使用估计数据（${errors.join(", ")}），其余未爬取`
    : "所有爬取的赛事均获取成功"

  return { events, ok, note }
}