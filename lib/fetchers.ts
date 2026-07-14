import type { RaceEvent, RaceSession } from "./types"
import { F1_CIRCUIT_TZ, COUNTRY_MAP, COUNTRY_CODE_MAP, zonedWallTimeToUtc } from "./tz"
import { buildWrcEvents } from "./wrc-data"

const F1_BROADCASTER = {
  name: "五星体育",
  note: "F1 中国大陆转播（上海地区，正赛 / 排位赛为主，以频道节目单为准）",
}

/** ============ F1（jolpica / Ergast 兼容 API，时间为 UTC） ============ */

interface ErgastSession {
  date: string
  time: string
}
interface ErgastRace {
  season: string
  round: string
  raceName: string
  url?: string
  Circuit: {
    circuitId: string
    circuitName: string
    Location: { locality: string; country: string }
  }
  date: string
  time?: string
  FirstPractice?: ErgastSession
  SecondPractice?: ErgastSession
  ThirdPractice?: ErgastSession
  SprintQualifying?: ErgastSession
  Sprint?: ErgastSession
  Qualifying?: ErgastSession
}

function toUtc(session?: ErgastSession): string | null {
  if (!session?.date || !session?.time) return null
  // Ergast time 已带 Z 后缀
  const iso = `${session.date}T${session.time.replace("Z", "")}Z`
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? null : d.toISOString()
}

export async function fetchF1(): Promise<{ events: RaceEvent[]; ok: boolean; note?: string }> {
  try {
    const res = await fetch("https://api.jolpi.ca/ergast/f1/current.json", {
      next: { revalidate: 3600 },
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const json = await res.json()
    const races: ErgastRace[] = json?.MRData?.RaceTable?.Races ?? []

    const events: RaceEvent[] = races.map((r) => {
      const tz = F1_CIRCUIT_TZ[r.Circuit.circuitId] ?? "UTC"
      const countryInfo = COUNTRY_MAP[r.Circuit.Location.country]
      const sessions: RaceSession[] = []

      const push = (name: string, s?: ErgastSession, isMain?: boolean) => {
        const utc = toUtc(s)
        if (utc) sessions.push({ name, utc, isMain })
      }
      push("第一次自由练习 (FP1)", r.FirstPractice)
      push("第二次自由练习 (FP2)", r.SecondPractice)
      push("第三次自由练习 (FP3)", r.ThirdPractice)
      push("冲刺排位赛 (SQ)", r.SprintQualifying)
      push("冲刺赛 (Sprint)", r.Sprint)
      push("排位赛 (Qualifying)", r.Qualifying)
      const raceUtc = toUtc({ date: r.date, time: r.time ?? "" })
      if (raceUtc) sessions.push({ name: "正赛 (Race)", utc: raceUtc, isMain: true })

      sessions.sort((a, b) => a.utc.localeCompare(b.utc))

      return {
        id: `f1-${r.season}-${r.round}`,
        series: "F1" as const,
        round: Number(r.round),
        name: translateGpName(r.raceName),
        circuit: r.Circuit.circuitName,
        locality: r.Circuit.Location.locality,
        country: countryInfo?.zh ?? r.Circuit.Location.country,
        countryCode: countryInfo?.code,
        tz,
        sessions,
        broadcaster: F1_BROADCASTER,
        url: r.url,
      }
    })

    return { events, ok: true }
  } catch (err) {
    return { events: [], ok: false, note: err instanceof Error ? err.message : "F1 数据获取失败" }
  }
}

/** 将英文大奖赛名翻译为中文 */
function translateGpName(name: string): string {
  const map: Record<string, string> = {
    "Australian Grand Prix": "澳大利亚大奖赛",
    "Chinese Grand Prix": "中国大奖赛",
    "Japanese Grand Prix": "日本大奖赛",
    "Miami Grand Prix": "迈阿密大奖赛",
    "Canadian Grand Prix": "加拿大大奖赛",
    "Monaco Grand Prix": "摩纳哥大奖赛",
    "Spanish Grand Prix": "西班牙大奖赛",
    "Austrian Grand Prix": "奥地利大奖赛",
    "British Grand Prix": "英国大奖赛",
    "Belgian Grand Prix": "比利时大奖赛",
    "Hungarian Grand Prix": "匈牙利大奖赛",
    "Dutch Grand Prix": "荷兰大奖赛",
    "Italian Grand Prix": "意大利大奖赛",
    "Madrid Grand Prix": "马德里大奖赛",
    "Spanish Grand Prix (Madrid)": "马德里大奖赛",
    "Azerbaijan Grand Prix": "阿塞拜疆大奖赛",
    "Singapore Grand Prix": "新加坡大奖赛",
    "United States Grand Prix": "美国大奖赛",
    "Mexico City Grand Prix": "墨西哥城大奖赛",
    "São Paulo Grand Prix": "圣保罗大奖赛",
    "Sao Paulo Grand Prix": "圣保罗大奖赛",
    "Las Vegas Grand Prix": "拉斯维加斯大奖赛",
    "Qatar Grand Prix": "卡塔尔大奖赛",
    "Abu Dhabi Grand Prix": "阿布扎比大奖赛",
  }
  return map[name] ?? name
}

/** ============ Formula E（pulselive 公开 API，含本地时间 + GMT 偏移） ============ */

const FE_BASE = "https://api.formula-e.pulselive.com/formula-e/v1"

interface FeChampionship {
  id: string
  name: string
  status: string
}
interface FeRace {
  id: string
  name: string
  sequence: number
  country: string
  city: string
  date: string
  raceLiveStatus: string | null
}
interface FeSession {
  sessionName: string
  sessionDate: string | null
  startTime: string
  offsetGMT: string
}

/** 解析 "09:00" / "-05:00" 形式的偏移，返回分钟 */
function parseOffsetMinutes(offset: string): number {
  const m = offset.match(/^(-?)(\d{1,2}):(\d{2})$/)
  if (!m) return 0
  const sign = m[1] === "-" ? -1 : 1
  return sign * (Number(m[2]) * 60 + Number(m[3]))
}

/** 由偏移分钟得到用于展示的 IANA 时区（Etc/GMT，整点）；带半点则回退 UTC */
function etcZoneFromOffset(minutes: number): string {
  if (minutes % 60 !== 0) return "UTC"
  const hours = minutes / 60
  // Etc/GMT 符号与偏移相反：UTC+9 -> Etc/GMT-9
  const sign = hours >= 0 ? "-" : "+"
  return `Etc/GMT${sign}${Math.abs(hours)}`
}

function feSessionUtc(s: FeSession): string | null {
  if (!s.sessionDate || !/^\d{1,2}:\d{2}$/.test(s.startTime)) return null
  const [y, mo, d] = s.sessionDate.split("-").map(Number)
  const [h, mi] = s.startTime.split(":").map(Number)
  const offsetMin = parseOffsetMinutes(s.offsetGMT)
  const wallUtc = Date.UTC(y, mo - 1, d, h, mi)
  return new Date(wallUtc - offsetMin * 60000).toISOString()
}

function feSessionLabel(name: string): string | null {
  if (name.startsWith("Free Practice")) return name.replace("Free Practice", "自由练习")
  if (name === "Qual Group A") return "排位赛"
  if (name === "Race") return "正赛 (E-Prix)"
  return null
}

export async function fetchFe(): Promise<{ events: RaceEvent[]; ok: boolean; note?: string }> {
  try {
    const champRes = await fetch(`${FE_BASE}/championships`, { next: { revalidate: 3600 } })
    if (!champRes.ok) throw new Error(`HTTP ${champRes.status}`)
    const champJson = await champRes.json()
    const champs: FeChampionship[] = champJson?.championships ?? []
    const present = champs.find((c) => c.status === "Present") ?? champs[champs.length - 1]
    if (!present) throw new Error("未找到当前 FE 赛季")

    const racesRes = await fetch(`${FE_BASE}/races?championshipId=${present.id}`, {
      next: { revalidate: 3600 },
    })
    if (!racesRes.ok) throw new Error(`HTTP ${racesRes.status}`)
    const racesJson = await racesRes.json()
    const races: FeRace[] = racesJson?.races ?? []

    const events = await Promise.all(
      races.map(async (r): Promise<RaceEvent | null> => {
        try {
          const sesRes = await fetch(`${FE_BASE}/races/${r.id}/sessions`, {
            next: { revalidate: 3600 },
          })
          const sesJson = sesRes.ok ? await sesRes.json() : { sessions: [] }
          const rawSessions: FeSession[] = sesJson?.sessions ?? []

          const sessions: RaceSession[] = []
          let eventOffset = 0
          for (const s of rawSessions) {
            const label = feSessionLabel(s.sessionName)
            const utc = feSessionUtc(s)
            if (label && utc) {
              sessions.push({ name: label, utc, isMain: s.sessionName === "Race" })
              eventOffset = parseOffsetMinutes(s.offsetGMT)
            }
          }
          sessions.sort((a, b) => a.utc.localeCompare(b.utc))

          // 若无法拿到场次时间，则以比赛日期兜底一个正赛条目
          if (sessions.length === 0 && r.date) {
            const [y, mo, d] = r.date.split("-").map(Number)
            sessions.push({
              name: "正赛 (E-Prix)",
              utc: new Date(Date.UTC(y, mo - 1, d, 12, 0)).toISOString(),
              isMain: true,
              tentative: true,
            })
          }

          return {
            id: `fe-${r.id}`,
            series: "FE" as const,
            round: r.sequence,
            name: cleanFeName(r.name),
            circuit: `${r.city} 街道赛道`,
            locality: r.city,
            country: COUNTRY_CODE_MAP[r.country] ?? r.country,
            countryCode: r.country,
            tz: etcZoneFromOffset(eventOffset),
            sessions,
            broadcaster: {
              name: "官方渠道",
              note: "FE 中国大陆转播以官方 App / 平台节目单为准",
            },
            url: "https://www.fiaformulae.com/",
          }
        } catch {
          return null
        }
      }),
    )

    return { events: events.filter((e): e is RaceEvent => e !== null), ok: true }
  } catch (err) {
    return { events: [], ok: false, note: err instanceof Error ? err.message : "FE 数据获取失败" }
  }
}

function cleanFeName(name: string): string {
  // 去掉赞助前缀，保留城市 E-Prix
  return name.replace(/^\d{4}\s+/, "").replace(/Google Cloud |ABB |Hankook |SABIC /g, "")
}

/** ============ WRC（从官方 itinerary 页面爬取真实时间） ============ */

interface WrcStage {
  name: string
  time: string
  isPowerStage?: boolean
}

interface WrcDay {
  date: string
  stages: WrcStage[]
}

function parseWrcItinerary(html: string): WrcDay[] | null {
  const result: WrcDay[] = []
  
  const dayPattern = /(Friday|Saturday|Sunday), (\d{1,2}) (July|June|May|April|March|February|January|August|September|October|November|December)/gi
  const timePattern = /(\d{2}:\d{2}):\s*(Shakedown|SS\d+|SSS\d+)/gi
  
  const dayMatches = [...html.matchAll(dayPattern)]
  const timeMatches = [...html.matchAll(timePattern)]
  
  if (dayMatches.length === 0 || timeMatches.length === 0) {
    return null
  }
  
  const months: Record<string, number> = {
    January: 1, February: 2, March: 3, April: 4, May: 5, June: 6,
    July: 7, August: 8, September: 9, October: 10, November: 11, December: 12,
  }
  
  const currentYear = new Date().getFullYear()
  
  let timeIndex = 0
  const processedDates = new Set<string>()
  
  for (const dayMatch of dayMatches) {
    const dayName = dayMatch[1]
    const day = parseInt(dayMatch[2], 10)
    const monthName = dayMatch[3]
    const month = months[monthName]
    
    if (!month || day < 1 || day > 31) continue
    
    const dateKey = `${dayName}-${day}-${monthName}`
    if (processedDates.has(dateKey)) continue
    processedDates.add(dateKey)
    
    const dateStr = `${dayName}, ${day} ${monthName} ${currentYear}`
    const stages: WrcStage[] = []
    
    while (timeIndex < timeMatches.length) {
      const timeMatch = timeMatches[timeIndex]
      const time = timeMatch[1]
      let name = timeMatch[2].trim()
      
      let isPowerStage = false
      if (name.includes("Power") || html.substring(timeMatch.index, timeMatch.index + 100).includes("Power")) {
        isPowerStage = true
      }
      
      if (name.startsWith("SS")) {
        name = name + (isPowerStage ? " (Power Stage)" : "")
      } else if (name.includes("Shakedown")) {
        name = "排位测试赛段 (Shakedown)"
      }
      
      stages.push({ name, time, isPowerStage })
      timeIndex++
      
      const nextTimeMatch = timeMatches[timeIndex]
      if (nextTimeMatch) {
        const nextTime = nextTimeMatch[1]
        if (nextTime < time) {
          break
        }
      }
    }
    
    if (stages.length > 0) {
      result.push({ date: dateStr, stages })
    }
  }
  
  return result.length > 0 ? result : null
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

async function fetchWrcItinerary(url: string): Promise<WrcDay[] | null> {
  const apiKey = process.env.SCRAPER_API_KEY
  
  async function fetchWithApi(): Promise<string | null> {
    if (!apiKey) return null
    try {
      const encodedUrl = encodeURIComponent(url)
      const res = await fetch(`https://api.apilayer.com/scraper?url=${encodedUrl}`, {
        headers: {
          "apikey": apiKey,
          "X-User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          "X-Referer": "https://www.wrc.com/en/",
          "X-Accept-Language": "en-US,en;q=0.9",
        },
        next: { revalidate: 86400 },
      })
      if (!res.ok) {
        console.error(`Scraper API failed: ${res.status} ${res.statusText} for ${url}`)
        return null
      }
      const data = await res.json()
      if (typeof data === "string") return data
      if (data && typeof data === "object") {
        if (data["data-selector"]) return data["data-selector"].join("\n")
        if (data.data) return data.data
        if (typeof data.html === "string") return data.html
      }
      return null
    } catch (e) {
      console.error(`Scraper API error: ${e}`)
      return null
    }
  }
  
  async function fetchDirect(): Promise<string | null> {
    try {
      const res = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.9",
          "Accept-Encoding": "gzip, deflate, br",
          "Connection": "keep-alive",
          "Upgrade-Insecure-Requests": "1",
          "Sec-Ch-Ua": "\"Not_A Brand\";v=\"8\", \"Chromium\";v=\"120\", \"Google Chrome\";v=\"120\"",
          "Sec-Ch-Ua-Mobile": "?0",
          "Sec-Ch-Ua-Platform": "\"Windows\"",
          "Sec-Fetch-Dest": "document",
          "Sec-Fetch-Mode": "navigate",
          "Sec-Fetch-Site": "none",
          "Sec-Fetch-User": "?1",
          "Cache-Control": "max-age=0",
          "Referer": "https://www.wrc.com/en/",
        },
        next: { revalidate: 86400 },
      })
      
      if (!res.ok) {
        console.error(`WRC fetch failed: ${res.status} ${res.statusText} for ${url}`)
        return null
      }
      
      return res.text()
    } catch (e) {
      console.error(`WRC direct fetch error: ${e}`)
      return null
    }
  }
  
  try {
    let html = await fetchWithApi()
    
    if (!html) {
      html = await fetchDirect()
    }
    
    if (!html) {
      return null
    }
    
    if (html.includes("Access Denied") || html.includes("Cloudflare")) {
      console.error(`WRC Cloudflare blocked: ${url}`)
      return null
    }
    
    const days = parseWrcItinerary(html)
    if (!days) {
      console.error(`WRC parse failed: ${url}, html preview: ${html.substring(0, 500)}`)
    }
    return days
  } catch (err) {
    console.error(`WRC fetch error: ${url}`, err)
    return null
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
  { round: 1, name: "蒙特卡洛拉力赛", hq: "加普（Gap）", city: "普罗旺斯", country: "法国", code: "FR", tz: "Europe/Paris", url: "https://www.wrc.com/en/events/wrc-rallye-monte-carlo-2026/itinerary-rallye-monte-carlo-2026" },
  { round: 2, name: "瑞典拉力赛", hq: "于默奥（Umeå）", city: "西博滕省", country: "瑞典", code: "SE", tz: "Europe/Stockholm", url: "https://www.wrc.com/en/events/wrc-rally-sweden-2026/itinerary-rally-sweden-2026" },
  { round: 3, name: "肯尼亚狩猎拉力赛", hq: "内罗毕", city: "纳库鲁郡", country: "肯尼亚", code: "KE", tz: "Africa/Nairobi", url: "https://www.wrc.com/en/events/wrc-safari-rally-kenya-2026/itinerary-safari-rally-kenya-2026" },
  { round: 4, name: "克罗地亚拉力赛", hq: "里耶卡（Rijeka）", city: "滨海高地县", country: "克罗地亚", code: "HR", tz: "Europe/Zagreb", url: "https://www.wrc.com/en/events/wrc-croatia-rally-2026/itinerary-croatia-rally-2026" },
  { round: 5, name: "加那利群岛拉力赛", hq: "拉斯帕尔马斯", city: "大加那利岛", country: "西班牙", code: "ES", tz: "Atlantic/Canary", url: "https://www.wrc.com/en/events/wrc-rally-islas-canarias-2026/itinerary-rally-islas-canarias-2026" },
  { round: 6, name: "葡萄牙拉力赛", hq: "马托西纽什", city: "波尔图", country: "葡萄牙", code: "PT", tz: "Europe/Lisbon", url: "https://www.wrc.com/en/events/wrc-rally-de-portugal-2026/itinerary-rally-de-portugal-2026" },
  { round: 7, name: "日本拉力赛", hq: "丰田市", city: "爱知县", country: "日本", code: "JP", tz: "Asia/Tokyo", url: "https://www.wrc.com/en/events/wrc-rally-japan-2026/itinerary-rally-japan-2026" },
  { round: 8, name: "希腊卫城拉力赛", hq: "卢特拉基（Loutraki）", city: "科林西亚", country: "希腊", code: "GR", tz: "Europe/Athens", url: "https://www.wrc.com/en/events/wrc-acropolis-rally-greece-2026/itinerary-acropolis-rally-greece-2026" },
  { round: 9, name: "爱沙尼亚拉力赛", hq: "塔尔图（Tartu）", city: "塔尔图", country: "爱沙尼亚", code: "EE", tz: "Europe/Tallinn", url: "https://www.wrc.com/en/events/wrc-delfi-rally-estonia-2026/itinerary-wrc-rally-estonia-2026" },
  { round: 10, name: "芬兰拉力赛", hq: "于韦斯屈莱", city: "中芬兰", country: "芬兰", code: "FI", tz: "Europe/Helsinki", url: "https://www.wrc.com/en/events/wrc-rally-finland-2026/itinerary-rally-finland-2026" },
  { round: 11, name: "巴拉圭拉力赛", hq: "恩卡纳西翁", city: "伊塔普阿", country: "巴拉圭", code: "PY", tz: "America/Asuncion", url: "https://www.wrc.com/en/events/wrc-rally-paraguay-2026/itinerary-rally-paraguay-2026" },
  { round: 12, name: "智利拉力赛", hq: "康塞普西翁", city: "比奥比奥", country: "智利", code: "CL", tz: "America/Santiago", url: "https://www.wrc.com/en/events/wrc-rally-chile-2026/itinerary-rally-chile-2026" },
  { round: 13, name: "意大利撒丁岛拉力赛", hq: "阿尔盖罗（Alghero）", city: "撒丁岛", country: "意大利", code: "IT", tz: "Europe/Rome", url: "https://www.wrc.com/en/events/wrc-rally-italia-sardegna-2026/itinerary-rally-italia-sardegna-2026" },
  { round: 14, name: "沙特阿拉伯拉力赛", hq: "吉达（Jeddah）", city: "麦加省", country: "沙特阿拉伯", code: "SA", tz: "Asia/Riyadh", url: "https://www.wrc.com/en/events/wrc-rally-saudi-arabia-2026/itinerary-rally-saudi-arabia-2026" },
]

export async function fetchWrc(): Promise<{ events: RaceEvent[]; ok: boolean; note?: string }> {
  const fallbackEvents = buildWrcEvents()
  const events: RaceEvent[] = [...fallbackEvents]
  let successCount = 0
  const errors: string[] = []

  for (const rally of WRC_RALLIES) {
    const days = await fetchWrcItinerary(rally.url)
    
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
    } else {
      errors.push(rally.name)
    }
  }

  const ok = successCount > 0
  const note = errors.length > 0 
    ? `${successCount} 场赛事获取成功（真实时间），${errors.length} 场使用估计数据（${errors.join(", ")}）`
    : "所有赛事时间获取成功（真实时间）"

  return { events, ok, note }
}
