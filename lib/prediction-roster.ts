export interface PredictionDriver {
  code: string
  name: string
  team: string
}

export interface WrcStandingForPrediction {
  id: number
  name: string
  team?: string
}

export interface FeDriverForPrediction {
  code: string
  name: string
  team?: string
}

const LEGACY_FE_CODES: Record<string, string> = {
  "mitch evans": "EVANS",
  "sam bird": "BIRD",
  "stoffel vandoorne": "VANDOORNE",
  "antonio felix da costa": "DA_COSTA",
  "jean eric vergne": "VERGNE",
  "edoardo mortara": "MORTARA",
  "lucas di grassi": "DI_GRASSI",
  "pascal wehrlein": "WEHRLEIN",
  "nick cassidy": "EVANS_B",
}

export const LEGACY_DRIVER_LABELS: Record<string, Record<string, string>> = {
  FE: {
    JEV: "Nicolas Prost",
  },
  WRC: {
    OGIER: "塞巴斯蒂安·奥吉尔 / 文森特·兰布拉斯",
    LOEB: "塞巴斯蒂安·勒布 / 伊夫·穆勒",
    NEUVILLE: "蒂埃里·诺伊维尔 / 马蒂亚斯·韦伊勒",
    "TÄNAK": "奥特·塔纳克 / 马丁·亚尔韦",
    "ROVANPERÄ": "卡勒·罗万佩拉 / 乔尼·哈尔塔宁",
    EVANS: "埃尔芬·埃文斯 / 斯科特·马丁",
    KATSI: "格雷瓜尔·穆纳 / 塞巴斯蒂安·德尔普拉多",
    SUNINEN: "蒂莫·苏尼宁 / 米卡·安蒂拉",
    BREEN: "克雷格·布林 / 詹姆斯·富尔顿",
    FOURNIER: "亚多·福尼耶 / 文森特·兰布拉斯",
  },
}

function normalizeName(name: string) {
  return name.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase().replace(/[^a-z0-9]+/g, " ").trim()
}

function stableWrcCode(name: string, id: number) {
  const surname = name.trim().split(/\s+/).at(-1) ?? ""
  const code = surname.normalize("NFC").replace(/[^\p{L}\p{N}]+/gu, "").toLocaleUpperCase()
  return code || `WRC-${id}`
}

export function mapWrcPredictionDrivers(standings: WrcStandingForPrediction[]): PredictionDriver[] {
  const seenCodes = new Set<string>()
  return standings.flatMap((standing) => {
    if (!Number.isInteger(standing.id) || standing.id < 1 || !standing.name?.trim()) return []
    const baseCode = stableWrcCode(standing.name, standing.id)
    let code = baseCode
    let suffix = 2
    while (seenCodes.has(code)) code = `${baseCode}-${suffix++}`
    seenCodes.add(code)
    return [{ code, name: standing.name.trim(), team: standing.team?.trim() ?? "" }]
  })
}

export function mapFePredictionDrivers(drivers: FeDriverForPrediction[]): PredictionDriver[] {
  return drivers.flatMap((driver) => {
    if (!driver.code?.trim() || !driver.name?.trim()) return []
    const code = LEGACY_FE_CODES[normalizeName(driver.name)] ?? `FE-${driver.code.toUpperCase()}`
    return [{ code, name: driver.name.trim(), team: driver.team?.trim() ?? "" }]
  })
}

export function predictionRosterUrl(series: "F1" | "WRC" | "FE", eventId: string, currentYear = new Date().getFullYear()) {
  if (series === "FE") {
    const season = eventId.match(/^fe-(\d{1,2})-/)?.[1]
    return `/api/fe-drivers${season ? `?season=${season}` : ""}`
  }

  const year = eventId.match(/^(?:f1|wrc)-(\d{4})-/)?.[1] ?? String(currentYear)
  return series === "F1"
    ? `/api/prediction-drivers?season=${year}`
    : `/api/wrc-standings?season=${year}&championship=333`
}
