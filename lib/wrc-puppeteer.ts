import puppeteer from "puppeteer"
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

async function scrapeWrcItinerary(url: string): Promise<WrcDay[] | null> {
  let browser: puppeteer.Browser | null = null
  try {
    browser = await puppeteer.launch({
      headless: "new",
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
        "--disable-features=IsolateOrigins,site-per-process",
        "--flag-switches-begin",
        "--flag-switches-end",
      ],
      timeout: 60000,
    })

    const page = await browser.newPage()
    await page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
    await page.setExtraHTTPHeaders({
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.9",
      "Referer": "https://www.wrc.com/en/",
    })

    page.on("console", (msg) => {
      console.log(`[WRC Page] ${msg.text()}`)
    })

    const response = await page.goto(url, {
      waitUntil: "networkidle2",
      timeout: 60000,
    })

    if (!response || !response.ok()) {
      console.error(`WRC page load failed: ${response?.status()} ${url}`)
      await browser.close()
      return null
    }

    await page.waitForSelector(".itinerary-stage", { timeout: 30000 }).catch(() => {})
    await page.waitForSelector("[data-testid*='stage']", { timeout: 15000 }).catch(() => {})

    await page.waitForTimeout(5000)

    const data = await page.evaluate(() => {
      const days: { date: string; stages: { name: string; time: string; isPowerStage: boolean }[] }[] = []
      
      const dayElements = document.querySelectorAll(".itinerary-day, [class*='day'], [data-testid*='day']")
      
      if (dayElements.length > 0) {
        dayElements.forEach((dayEl) => {
          const dateText = dayEl.querySelector(".itinerary-date, [class*='date'], [class*='title']")?.textContent || ""
          const dateMatch = dateText.match(/(Friday|Saturday|Sunday), (\d{1,2}) (January|February|March|April|May|June|July|August|September|October|November|December)/i)
          if (dateMatch) {
            const dateStr = `${dateMatch[1]}, ${dateMatch[2]} ${dateMatch[3]} ${new Date().getFullYear()}`
            const stages: { name: string; time: string; isPowerStage: boolean }[] = []
            
            const stageElements = dayEl.querySelectorAll(".itinerary-stage, [class*='stage'], li")
            stageElements.forEach((stageEl) => {
              const timeText = stageEl.querySelector(".itinerary-time, [class*='time'], span")?.textContent || ""
              const nameText = stageEl.querySelector(".itinerary-name, [class*='name'], p")?.textContent || stageEl.textContent || ""
              
              const timeMatch = timeText.match(/(\d{2}:\d{2})/)
              if (timeMatch) {
                const time = timeMatch[1]
                let name = nameText.trim()
                if (!name) name = timeText.trim().replace(time, "").trim()
                
                const isPowerStage = name.includes("Power") || nameText.includes("Power")
                
                if (name.includes("SS") || name.includes("Shakedown")) {
                  stages.push({ name, time, isPowerStage })
                }
              }
            })
            
            if (stages.length > 0) {
              days.push({ date: dateStr, stages })
            }
          }
        })
      } else {
        const allText = document.body.textContent || ""
        const dayPattern = /(Friday|Saturday|Sunday), (\d{1,2}) (July|June|May|April|March|February|January|August|September|October|November|December)/gi
        const timePattern = /(\d{2}:\d{2}):\s*(Shakedown|SS\d+|SSS\d+)/gi
        
        const dayMatches = [...allText.matchAll(dayPattern)]
        const timeMatches = [...allText.matchAll(timePattern)]
        
        if (dayMatches.length > 0 && timeMatches.length > 0) {
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
          
          const dayOrder = ['Friday', 'Saturday', 'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday']
          const firstIndex = dayOrder.indexOf(uniqueDays[0]?.dayName || 'Friday')
          
          const correctedDays: { dayName: string; day: number; month: number; monthName: string }[] = []
          for (let i = 0; i < uniqueDays.length; i++) {
            const expectedIndex = (firstIndex + i) % 7
            const expectedDayName = dayOrder[expectedIndex]
            
            let correctedDay = uniqueDays[0].day + i
            let correctedMonth = uniqueDays[0].month
            
            if (correctedDay > 31) {
              correctedDay = correctedDay - 31
              correctedMonth++
            }
            
            const monthNames = Object.keys(months)
            const correctedMonthName = monthNames.find(k => months[k] === correctedMonth) || uniqueDays[0].monthName
            
            correctedDays.push({ dayName: expectedDayName, day: correctedDay, month: correctedMonth, monthName: correctedMonthName })
          }
          
          let timeIndex = 0
          for (const { dayName, day, monthName } of correctedDays) {
            const dateStr = `${dayName}, ${day} ${monthName} ${currentYear}`
            const stages: { name: string; time: string; isPowerStage: boolean }[] = []
            
            while (timeIndex < timeMatches.length) {
              const timeMatch = timeMatches[timeIndex]
              const time = timeMatch[1]
              let name = timeMatch[2].trim()
              
              const isPowerStage = allText.substring(timeMatch.index || 0, (timeMatch.index || 0) + 100).includes("Power")
              
              if (name.startsWith("SS")) {
                name = name + (isPowerStage ? " (Power Stage)" : "")
              } else if (name.includes("Shakedown")) {
                name = "排位测试赛段 (Shakedown)"
              }
              
              stages.push({ name, time, isPowerStage })
              timeIndex++
              
              const nextTimeMatch = timeMatches[timeIndex]
              if (nextTimeMatch && nextTimeMatch[1] < time) {
                break
              }
            }
            
            if (stages.length > 0) {
              days.push({ date: dateStr, stages })
            }
          }
        }
      }
      
      return days
    })

    await browser.close()

    if (!data || data.length === 0) {
      console.error(`No data extracted from: ${url}`)
      return null
    }

    return data as WrcDay[]
  } catch (err) {
    console.error(`Puppeteer error for ${url}:`, err)
    if (browser) {
      try {
        await browser.close()
      } catch (e) {
        console.error("Error closing browser:", e)
      }
    }
    return null
  }
}

function dateStrToYmd(dateStr: string): [number, number, number] | null {
  const months: Record<string, number> = {
    Jan: 1, February: 2, Mar: 3, Apr: 4, May: 5, Jun: 6,
    Jul: 7, August: 8, Sep: 9, Oct: 10, Nov: 11, Dec: 12,
    January: 1, Feb: 2, March: 3, April: 4, June: 6,
    July: 7, September: 9, October: 10, November: 11, December: 12,
  }
  const match = dateStr.match(/\w+,\s*(\d{1,2})\s+(\w+)\s+(\d{4})/)
  if (!match) return null
  const d = parseInt(match[1], 10)
  const m = months[match[2]]
  const y = parseInt(match[3], 10)
  return m ? [y, m, d] : null
}

function wrcStageToSession(
  stage: WrcStage,
  date: [number, number, number],
  tz: string,
): RaceSession | null {
  const [y, m, d] = date
  const [h, min] = stage.time.split(":").map(Number)
  if (isNaN(h) || isNaN(min)) return null

  return {
    name: stage.name,
    utc: zonedWallTimeToUtc(y, m, d, h, min, tz).toISOString(),
    isMain: stage.isPowerStage,
  }
}

interface WrcRally {
  round: number
  name: string
  hq: string
  city: string
  country: string
  code: string
  tz: string
  url: string
}

const WRC_RALLIES: WrcRally[] = [
  { round: 1, name: "蒙特卡洛拉力赛", hq: "加普（Gap）", city: "普罗旺斯", country: "法国", code: "FR", tz: "Europe/Paris", url: "https://www.wrc.com/en/events/wrc-rallye-monte-carlo-2026" },
  { round: 2, name: "瑞典拉力赛", hq: "于默奥（Umeå）", city: "西博滕省", country: "瑞典", code: "SE", tz: "Europe/Stockholm", url: "https://www.wrc.com/en/events/wrc-rally-sweden-2026" },
  { round: 3, name: "肯尼亚狩猎拉力赛", hq: "内罗毕", city: "纳库鲁郡", country: "肯尼亚", code: "KE", tz: "Africa/Nairobi", url: "https://www.wrc.com/en/events/wrc-safari-rally-kenya-2026" },
  { round: 4, name: "克罗地亚拉力赛", hq: "里耶卡（Rijeka）", city: "滨海高地县", country: "克罗地亚", code: "HR", tz: "Europe/Zagreb", url: "https://www.wrc.com/en/events/wrc-croatia-rally-2026" },
  { round: 5, name: "加那利群岛拉力赛", hq: "拉斯帕尔马斯", city: "大加那利岛", country: "西班牙", code: "ES", tz: "Atlantic/Canary", url: "https://www.wrc.com/en/events/wrc-rally-islas-canarias-2026" },
  { round: 6, name: "葡萄牙拉力赛", hq: "马托西纽什", city: "波尔图", country: "葡萄牙", code: "PT", tz: "Europe/Lisbon", url: "https://www.wrc.com/en/events/wrc-rally-de-portugal-2026" },
  { round: 7, name: "日本拉力赛", hq: "丰田市", city: "爱知县", country: "日本", code: "JP", tz: "Asia/Tokyo", url: "https://www.wrc.com/en/events/wrc-rally-japan-2026" },
  { round: 8, name: "希腊卫城拉力赛", hq: "卢特拉基（Loutraki）", city: "科林西亚", country: "希腊", code: "GR", tz: "Europe/Athens", url: "https://www.wrc.com/en/events/wrc-acropolis-rally-greece-2026" },
  { round: 9, name: "爱沙尼亚拉力赛", hq: "塔尔图（Tartu）", city: "塔尔图", country: "爱沙尼亚", code: "EE", tz: "Europe/Tallinn", url: "https://www.wrc.com/en/events/wrc-delfi-rally-estonia-2026" },
  { round: 10, name: "芬兰拉力赛", hq: "于韦斯屈莱", city: "中芬兰", country: "芬兰", code: "FI", tz: "Europe/Helsinki", url: "https://www.wrc.com/en/events/wrc-secto-rally-finland-2026" },
  { round: 11, name: "巴拉圭拉力赛", hq: "恩卡纳西翁", city: "伊塔普阿", country: "巴拉圭", code: "PY", tz: "America/Asuncion", url: "https://www.wrc.com/en/events/wrc-rally-del-paraguay-2026" },
  { round: 12, name: "智利拉力赛", hq: "康塞普西翁", city: "比奥比奥", country: "智利", code: "CL", tz: "America/Santiago", url: "https://www.wrc.com/en/events/wrc-rally-chile-bio-bio-2026" },
  { round: 13, name: "意大利撒丁岛拉力赛", hq: "阿尔盖罗（Alghero）", city: "撒丁岛", country: "意大利", code: "IT", tz: "Europe/Rome", url: "https://www.wrc.com/en/events/wrc-rally-italia-sardegna-2026" },
  { round: 14, name: "沙特阿拉伯拉力赛", hq: "吉达（Jeddah）", city: "麦加省", country: "沙特阿拉伯", code: "SA", tz: "Asia/Riyadh", url: "https://www.wrc.com/en/events/wrc-rally-saudi-arabia-2026" },
]

export async function fetchWrc(): Promise<{ events: RaceEvent[]; ok: boolean; note?: string }> {
  const fallbackEvents = buildWrcEvents()
  const events: RaceEvent[] = [...fallbackEvents]
  let successCount = 0
  const errors: string[] = []

  for (const rally of WRC_RALLIES) {
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
        events[index] = {
          ...events[index],
          sessions,
          url: rally.url,
        }
      }

      successCount++
      console.log(`WRC Puppeteer success: ${rally.name} (${sessions.length} sessions)`)
    } else {
      errors.push(rally.name)
      console.log(`WRC Puppeteer failed: ${rally.name} (using fallback)`)
    }
  }

  const ok = successCount > 0
  const note = errors.length > 0
    ? `${successCount} 场赛事获取成功（Puppeteer 爬取真实时间），${errors.length} 场使用估计数据（${errors.join(", ")}）`
    : "所有赛事时间获取成功（Puppeteer 爬取真实时间）"

  return { events, ok, note }
}