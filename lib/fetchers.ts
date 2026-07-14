import type { RaceEvent, RaceSession } from "./types"
import { F1_CIRCUIT_TZ, COUNTRY_MAP, COUNTRY_CODE_MAP } from "./tz"

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
