/**
 * 赛道数据库 - 包含各赛道的详细信息
 * 数据来源：Wikipedia, 官方文档
 */

export interface CircuitDetail {
  id: string
  name: string
  nameEn: string
  city: string
  country: string
  /** 赛道类型 */
  type: "street" | "permanent" | "hybrid" | "rally" | "unknown"
  /** 长度（km） */
  length?: number
  /** 弯道数 */
  turns?: number
  /** 比赛圈数（典型） */
  laps?: number
  /** 该场拉力赛的赛段数（适用于 WRC 拉力，不等同于弯道数） */
  stages?: number
  /** 首次使用年份 */
  firstUsed?: number
  /** 单圈纪录 */
  lapRecord?: {
    time: string
    driver: string
    year: number
  }
  /** 设计者 */
  designer?: string
  /** 容量 */
  capacity?: number
  /** 当前合同时长到期 */
  contractUntil?: number
  /** 难度等级 1-5 */
  difficulty?: 1 | 2 | 3 | 4 | 5
  /** 描述 */
  description?: string
  /** Current and historical series represented in the public schedule. */
  series?: ("F1" | "WRC" | "FE")[]
  seasons?: number[]
  lat?: number
  lon?: number
  /** Record was inferred from the schedule, so unavailable engineering data is intentionally omitted. */
  scheduleDerived?: boolean
  /** Wikipedia URL */
  wikipediaUrl?: string
}

export const CIRCUIT_DATABASE: Record<string, CircuitDetail> = {
  // F1 赛道
  "bahrain": {
    id: "bahrain",
    name: "巴林国际赛车场",
    nameEn: "Bahrain International Circuit",
    city: "萨基尔",
    country: "巴林",
    type: "permanent",
    length: 5.412,
    turns: 15,
    laps: 57,
    firstUsed: 2004,
    lapRecord: { time: "1:31.447", driver: "Pedro de la Rosa", year: 2005 },
    designer: "Hermann Tilke",
    capacity: 70000,
    difficulty: 4,
    description: "位于巴林萨基尔沙漠地区，著名的夜场比赛。赛道多弯道和技术性高，对车手体能和赛车散热是极大考验。",
    wikipediaUrl: "https://en.wikipedia.org/wiki/Bahrain_International_Circuit",
  },
  "jeddah": {
    id: "jeddah",
    name: "吉达滨海赛道",
    nameEn: "Jeddah Corniche Circuit",
    city: "吉达",
    country: "沙特阿拉伯",
    type: "street",
    length: 6.174,
    turns: 27,
    laps: 50,
    firstUsed: 2021,
    lapRecord: { time: "1:30.734", driver: "Lewis Hamilton", year: 2021 },
    designer: "Hermann Tilke",
    difficulty: 5,
    description: "F1史上最快街道赛道，平均时速超过250km/h。狭窄多弯，视野受限，对车手胆量和技术要求极高。",
    wikipediaUrl: "https://en.wikipedia.org/wiki/Jeddah_Corniche_Circuit",
  },
  "monaco": {
    id: "monaco",
    name: "蒙特卡洛赛道",
    nameEn: "Circuit de Monaco",
    city: "蒙特卡洛",
    country: "摩纳哥",
    type: "street",
    length: 3.337,
    turns: 19,
    laps: 78,
    firstUsed: 1950,
    lapRecord: { time: "1:12.909", driver: "Lewis Hamilton", year: 2021 },
    difficulty: 5,
    description: "F1最具传奇色彩的街道赛道，最慢但最考验车手技术。超车极其困难，排位赛成绩决定一切。",
    wikipediaUrl: "https://en.wikipedia.org/wiki/Circuit_de_Monaco",
  },
  // WRC 赛道
  "monte-carlo": {
    id: "monte-carlo",
    name: "蒙特卡洛拉力赛",
    nameEn: "Rallye Monte-Carlo",
    city: "加普",
    country: "摩纳哥",
    type: "rally",
    length: 324.44,
    stages: 17,
    firstUsed: 1911,
    designer: "Traditional Rally",
    difficulty: 5,
    description: "世界拉力锦标赛的创始赛事，冬季高山赛段以变化莫测的路面条件闻名。冰雪、干燥、湿滑交替出现。",
    wikipediaUrl: "https://en.wikipedia.org/wiki/Rallye_Monte-Carlo",
  },
  // FE 赛道
  "tokyo": {
    id: "tokyo",
    name: "东京街道赛道",
    nameEn: "Tokyo Street Circuit",
    city: "东京",
    country: "日本",
    type: "street",
    length: 2.582,
    turns: 18,
    laps: 32,
    firstUsed: 2024,
    difficulty: 4,
    description: "围绕东京国际展示场（Tokyo Big Sight）的街道赛道，FE首场日本站。狭窄多弯，电动赛车的能量管理至关重要。",
    wikipediaUrl: "https://en.wikipedia.org/wiki/Tokyo_ePrix",
  },
}

/**
 * 根据电路名称模糊匹配获取赛道详情
 */
export function findCircuitDetail(circuitName: string): CircuitDetail | null {
  const name = circuitName.toLowerCase()
  
  for (const [, detail] of Object.entries(CIRCUIT_DATABASE)) {
    if (
      name.includes(detail.id) ||
      name.includes(detail.nameEn.toLowerCase()) ||
      detail.nameEn.toLowerCase().includes(name) ||
      (detail.city && name.includes(detail.city.toLowerCase()))
    ) {
      return detail
    }
  }
  return null
}

export function getAllCircuits(): CircuitDetail[] {
  return Object.values(CIRCUIT_DATABASE)
}

function normalizeKey(value: string) {
  return value.normalize("NFKD").toLowerCase().replace(/[^a-z0-9\p{Script=Han}]+/gu, " ").trim()
}

function scheduleLength(value?: string): number | undefined {
  if (!value) return undefined
  const match = value.match(/(\d+(?:\.\d+)?)\s*km/i)
  const length = match ? Number(match[1]) : NaN
  return Number.isFinite(length) && length > 0 && length < 1000 ? length : undefined
}

function scheduleLaps(value?: string): number | undefined {
  if (!value) return undefined
  const laps = Number(value.match(/\d+/)?.[0])
  return Number.isInteger(laps) && laps > 0 && laps < 200 ? laps : undefined
}

/** Merge the curated reference entries with all venues present in the live schedule. */
export function buildCircuitDatabase(events: import("./types").RaceEvent[]): CircuitDetail[] {
  const entries = new Map<string, CircuitDetail>(Object.entries(CIRCUIT_DATABASE))
  const eventGroups = new Map<string, import("./types").RaceEvent[]>()
  for (const event of events) {
    const name = event.series === "WRC" ? event.name?.trim() : event.circuit?.trim() || event.name?.trim()
    if (!name) continue
    const groupKey = normalizeKey(`${name} ${event.country}`)
    eventGroups.set(groupKey, [...(eventGroups.get(groupKey) ?? []), event])
  }

  for (const [groupKey, group] of eventGroups) {
    const event = group[0]
    const nameEn = event.series === "WRC" ? event.name.trim() : event.circuit?.trim() || event.name.trim()
    const known = [...entries.values()].find(item => {
      const aliases = [item.name, item.nameEn, item.id].map(normalizeKey).filter(Boolean)
      return aliases.some(alias => groupKey.includes(alias) || alias.includes(groupKey))
    })
    const series = [...new Set(group.map(item => item.series))]
    const seasons = [...new Set(group.flatMap(item => {
      const year = Number(item.id.match(/(?:f1|fe|wrc)-(\d{4})-/i)?.[1] ?? item.sessions[0]?.utc.slice(0, 4))
      return Number.isInteger(year) ? [year] : []
    }))].sort((a, b) => a - b)
    const circuitId = known?.id ?? `calendar-${groupKey.replace(/\s+/g, "-").slice(0, 72) || `${event.series.toLowerCase()}-${event.round}`}`
    const base = known ?? {
      id: circuitId,
      name: event.series === "WRC" ? event.name : event.circuit?.trim() || event.name,
      nameEn,
      city: event.locality || "",
      country: event.country || "",
      type: event.circuitType ?? (event.series === "WRC" ? "rally" : "unknown"),
      length: scheduleLength(event.circuitInfo?.length),
      laps: scheduleLaps(event.circuitInfo?.laps),
      firstUsed: undefined,
      difficulty: undefined,
      description: "来自赛事日历的地点记录。赛道长度、弯道数等资料尚未可靠收录。",
      scheduleDerived: true,
      lat: Number.isFinite(event.lat) ? event.lat : undefined,
      lon: Number.isFinite(event.lon) ? event.lon : undefined,
    } satisfies CircuitDetail
    entries.set(circuitId, {
      ...base,
      series: [...new Set([...(base.series ?? []), ...series])],
      seasons: [...new Set([...(base.seasons ?? []), ...seasons])].sort((a, b) => a - b),
      length: base.length ?? scheduleLength(event.circuitInfo?.length),
      laps: base.laps ?? scheduleLaps(event.circuitInfo?.laps),
      lat: base.lat ?? (Number.isFinite(event.lat) ? event.lat : undefined),
      lon: base.lon ?? (Number.isFinite(event.lon) ? event.lon : undefined),
      scheduleDerived: base.scheduleDerived ?? false,
    })
  }
  return [...entries.values()].sort((a, b) => a.name.localeCompare(b.name, "zh-CN"))
}
