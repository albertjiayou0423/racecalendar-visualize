import type { RaceEvent, RaceSession } from "./types"
import { F1_CIRCUIT_TZ, COUNTRY_MAP, COUNTRY_CODE_MAP, zonedWallTimeToUtc } from "./tz"
import { buildWrcEvents } from "./wrc-data"
export { fetchWrc } from "./wrc-puppeteer"

const F1_BROADCASTER = {
  name: "五星体育",
  note: "F1 中国大陆转播（上海地区，正赛 / 排位赛为主，以频道节目单为准）",
}

/** ============ F1（jolpica / Ergast 兼容 API，时间为 UTC） ============ */

interface ErgastSession {
  date: string
  time: string
}
interface ErgastDriver {
  driverId: string
  givenName: string
  familyName: string
  nationality: string
}
interface ErgastConstructor {
  constructorId: string
  name: string
  nationality: string
}
interface ErgastFastestLap {
  rank: string
  lap: string
  Time: { time: string }
}
interface ErgastResult {
  position: string
  Driver: ErgastDriver
  Constructor: ErgastConstructor
  laps: string
  Time?: { time: string; millis: string }
  FastestLap?: ErgastFastestLap
}
interface ErgastRace {
  season: string
  round: string
  raceName: string
  url?: string
  Circuit: {
    circuitId: string
    circuitName: string
    url?: string
    Location: { lat: string; long: string; locality: string; country: string }
  }
  date: string
  time?: string
  FirstPractice?: ErgastSession
  SecondPractice?: ErgastSession
  ThirdPractice?: ErgastSession
  SprintQualifying?: ErgastSession
  Sprint?: ErgastSession
  Qualifying?: ErgastSession
  Results?: ErgastResult[]
}

function toUtc(session?: ErgastSession): string | null {
  if (!session?.date || !session?.time) return null
  // Ergast time 已带 Z 后缀
  const iso = `${session.date}T${session.time.replace("Z", "")}Z`
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? null : d.toISOString()
}

const CIRCUIT_IMAGES: Record<string, string> = {
  albert_park: "/circuits/australia_track_2026trackmelbournedetailed.webp",
  shanghai: "/circuits/china_track_2026trackshanghaidetailed.webp",
  suzuka: "/circuits/japan_track_2026tracksuzukadetailed.webp",
  miami: "/circuits/miami_track_2026trackmiamidetailed.webp",
  villeneuve: "/circuits/canada_track_2026trackmontrealdetailed.webp",
  monaco: "/circuits/monaco_track_2026trackmontecarlodetailed.webp",
  catalunya: "/circuits/barcelona-catalunya_track_2026trackcatalunyadetailed.webp",
  red_bull_ring: "/circuits/austria_track_2026trackspielbergdetailed.webp",
  silverstone: "/circuits/great-britain_track_2026tracksilverstonedetailed.webp",
  spa: "/circuits/belgium_track_2026trackspafrancorchampsdetailed.webp",
  hungaroring: "/circuits/hungary_track_2026trackhungaroringdetailed.webp",
  zandvoort: "/circuits/netherlands_track_2026trackzandvoortdetailed.webp",
  monza: "/circuits/italy_track_2026trackmonzadetailed.webp",
  madring: "/circuits/spain_track_2026trackmadringdetailed.webp",
  baku: "/circuits/azerbaijan_track_2026trackbakudetailed.webp",
  marina_bay: "/circuits/singapore_track_2026tracksingaporedetailed.webp",
  americas: "/circuits/united-states_track_2026trackaustindetailed.webp",
  rodriguez: "/circuits/mexico_track_2026trackmexicocitydetailed.webp",
  interlagos: "/circuits/brazil_track_2026trackinterlagosdetailed.webp",
  vegas: "/circuits/las-vegas_track_2026tracklasvegasdetailed.webp",
  losail: "/circuits/qatar_track_2026tracklusaildetailed.webp",
  yas_marina: "/circuits/united-arab-emirates_track_2026trackyasmarinacircuitdetailed.webp",
}

const CIRCUIT_INFO: Record<string, { length: string; laps: string }> = {
  albert_park: { length: "5.303 km", laps: "57" },
  shanghai: { length: "5.451 km", laps: "56" },
  suzuka: { length: "5.807 km", laps: "53" },
  miami: { length: "5.412 km", laps: "57" },
  villeneuve: { length: "4.361 km", laps: "70" },
  monaco: { length: "3.337 km", laps: "78" },
  catalunya: { length: "4.657 km", laps: "66" },
  red_bull_ring: { length: "4.318 km", laps: "71" },
  silverstone: { length: "5.891 km", laps: "52" },
  spa: { length: "7.004 km", laps: "44" },
  hungaroring: { length: "4.381 km", laps: "70" },
  zandvoort: { length: "4.259 km", laps: "72" },
  monza: { length: "5.793 km", laps: "53" },
  madring: { length: "4.428 km", laps: "66" },
  baku: { length: "6.003 km", laps: "51" },
  marina_bay: { length: "5.063 km", laps: "62" },
  americas: { length: "5.513 km", laps: "56" },
  rodriguez: { length: "4.304 km", laps: "71" },
  interlagos: { length: "4.309 km", laps: "71" },
  vegas: { length: "6.201 km", laps: "50" },
  losail: { length: "5.380 km", laps: "57" },
  yas_marina: { length: "5.281 km", laps: "58" },
}

export async function fetchF1(): Promise<{ events: RaceEvent[]; ok: boolean; note?: string }> {
  try {
    const [currentRes, lastYearRes] = await Promise.all([
      fetch("https://api.jolpi.ca/ergast/f1/current.json", { next: { revalidate: 3600 } }),
      fetch("https://api.jolpi.ca/ergast/f1/2025/results.json", { next: { revalidate: 86400 } }),
    ])

    if (!currentRes.ok) throw new Error(`HTTP ${currentRes.status}`)
    const currentJson = await currentRes.json()
    const races: ErgastRace[] = currentJson?.MRData?.RaceTable?.Races ?? []

    let lastYearResults: Record<string, ErgastResult[]> = {}
    if (lastYearRes.ok) {
      const lastYearJson = await lastYearRes.json()
      const lastYearRaces: ErgastRace[] = lastYearJson?.MRData?.RaceTable?.Races ?? []
      for (const race of lastYearRaces) {
        if (race.Results) {
          lastYearResults[race.Circuit.circuitId] = race.Results
        }
      }
    }

    const events: RaceEvent[] = races.map((r) => {
      const tz = F1_CIRCUIT_TZ[r.Circuit.circuitId] ?? "UTC"
      const countryInfo = COUNTRY_MAP[r.Circuit.Location.country]
      const sessions: RaceSession[] = []
      const lastYearResult = lastYearResults[r.Circuit.circuitId]?.[0]
      const circuitInfo = CIRCUIT_INFO[r.Circuit.circuitId]

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

      const streetCircuits = ["monaco", "singapore", "las_vegas", "baku", "jeddah", "miami", "marina_bay", "baku"]
      const isStreet = streetCircuits.some(c => r.Circuit.circuitId.toLowerCase().includes(c))

      const regionMap: Record<string, "europe" | "asia" | "americas" | "middle-east" | "africa" | "oceania"> = {
        "Australia": "oceania",
        "Japan": "asia",
        "China": "asia",
        "Singapore": "asia",
        "Bahrain": "middle-east",
        "Saudi Arabia": "middle-east",
        "Qatar": "middle-east",
        "Abu Dhabi": "middle-east",
        "UAE": "middle-east",
        "USA": "americas",
        "United States": "americas",
        "Canada": "americas",
        "Mexico": "americas",
        "Brazil": "americas",
        "Argentina": "americas",
        "UK": "europe",
        "Great Britain": "europe",
        "Germany": "europe",
        "France": "europe",
        "Spain": "europe",
        "Italy": "europe",
        "Austria": "europe",
        "Belgium": "europe",
        "Hungary": "europe",
        "Netherlands": "europe",
        "Monaco": "europe",
        "Azerbaijan": "asia",
        "Morocco": "africa",
        "South Africa": "africa",
      }
      const region = regionMap[r.Circuit.Location.country] ?? "europe"

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
        circuitType: isStreet ? "street" : "permanent",
        region,
        lat: parseFloat(r.Circuit.Location.lat),
        lon: parseFloat(r.Circuit.Location.long),
        wikipediaUrl: r.url,
        circuitWikipediaUrl: r.Circuit.url,
        circuitImageUrl: CIRCUIT_IMAGES[r.Circuit.circuitId],
        lastYearWinner: lastYearResult
          ? {
              driver: `${lastYearResult.Driver.givenName} ${lastYearResult.Driver.familyName}`,
              constructor: lastYearResult.Constructor.name,
            }
          : undefined,
        lastYearFastestLap: lastYearResult?.FastestLap
          ? {
              driver: `${lastYearResult.Driver.givenName} ${lastYearResult.Driver.familyName}`,
              time: lastYearResult.FastestLap.Time.time,
              lap: lastYearResult.FastestLap.lap,
            }
          : undefined,
        circuitInfo,
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
            circuitType: "street",
            region: getRegionFromCountry(r.country),
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

function getRegionFromCountry(countryCode: string): "europe" | "asia" | "americas" | "middle-east" | "africa" | "oceania" {
  const regionMap: Record<string, "europe" | "asia" | "americas" | "middle-east" | "africa" | "oceania"> = {
    "GB": "europe", "DE": "europe", "FR": "europe", "IT": "europe", "ES": "europe",
    "MC": "europe", "BE": "europe", "NL": "europe", "AT": "europe", "HU": "europe",
    "CN": "asia", "JP": "asia", "KR": "asia", "SG": "asia", "MY": "asia",
    "TH": "asia", "ID": "asia", "SA": "middle-east", "AE": "middle-east", "BH": "middle-east",
    "QA": "middle-east", "US": "americas", "CA": "americas", "MX": "americas",
    "BR": "americas", "AR": "americas", "AU": "oceania", "NZ": "oceania",
    "ZA": "africa", "MA": "africa", "KE": "africa",
  }
  return regionMap[countryCode] ?? "europe"
}
