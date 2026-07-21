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
  type: "street" | "permanent" | "hybrid" | "rally"
  /** 长度（km） */
  length: number
  /** 弯道数 */
  turns: number
  /** 比赛圈数（典型） */
  laps: number
  /** 首次使用年份 */
  firstUsed: number
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
  difficulty: 1 | 2 | 3 | 4 | 5
  /** 描述 */
  description: string
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
    turns: 17,
    laps: 17,
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