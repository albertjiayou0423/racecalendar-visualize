import type { RaceEvent, RaceSession } from "./types"
import { zonedWallTimeToUtc } from "./tz"

/**
 * 2026 FIA 世界拉力锦标赛（WRC）赛历。
 * 数据来源：FIA / WRC Promoter 官方公布的 2026 赛历（经维基百科整理）。
 * WRC 官方接口需授权密钥，因此这里以官方公布的赛历为准进行维护；
 * 各比赛日的赛段具体开始时间为按惯例估计值（tentative），最终以官方 itinerary 为准。
 */

interface WrcRallyDef {
  round: number
  name: string
  hq: string
  city: string
  country: string
  code: string
  tz: string
  /** [年, 月, 日] 首日（通常为周四，含排位赛段 Shakedown） */
  start: [number, number, number]
  /** [年, 月, 日] 末日（周日，含决胜赛段 Power Stage） */
  finish: [number, number, number]
  /** 每天的赛段数 [首日Shakedown, 第一比赛日, 第二比赛日, 末日(不含Power Stage)] */
  stages?: [number, number, number, number]
}

const RALLIES: WrcRallyDef[] = [
  { round: 1, name: "蒙特卡洛拉力赛", hq: "加普（Gap）", city: "普罗旺斯", country: "法国", code: "FR", tz: "Europe/Paris", start: [2026, 1, 22], finish: [2026, 1, 25] },
  { round: 2, name: "瑞典拉力赛", hq: "于默奥（Umeå）", city: "西博滕省", country: "瑞典", code: "SE", tz: "Europe/Stockholm", start: [2026, 2, 12], finish: [2026, 2, 15] },
  { round: 3, name: "肯尼亚狩猎拉力赛", hq: "内罗毕", city: "纳库鲁郡", country: "肯尼亚", code: "KE", tz: "Africa/Nairobi", start: [2026, 3, 12], finish: [2026, 3, 15] },
  { round: 4, name: "克罗地亚拉力赛", hq: "里耶卡（Rijeka）", city: "滨海高地县", country: "克罗地亚", code: "HR", tz: "Europe/Zagreb", start: [2026, 4, 9], finish: [2026, 4, 12] },
  { round: 5, name: "加那利群岛拉力赛", hq: "拉斯帕尔马斯", city: "大加那利岛", country: "西班牙", code: "ES", tz: "Atlantic/Canary", start: [2026, 4, 23], finish: [2026, 4, 26] },
  { round: 6, name: "葡萄牙拉力赛", hq: "马托西纽什", city: "波尔图", country: "葡萄牙", code: "PT", tz: "Europe/Lisbon", start: [2026, 5, 7], finish: [2026, 5, 10] },
  { round: 7, name: "日本拉力赛", hq: "丰田市", city: "爱知县", country: "日本", code: "JP", tz: "Asia/Tokyo", start: [2026, 5, 28], finish: [2026, 5, 31] },
  { round: 8, name: "希腊卫城拉力赛", hq: "卢特拉基（Loutraki）", city: "科林西亚", country: "希腊", code: "GR", tz: "Europe/Athens", start: [2026, 6, 25], finish: [2026, 6, 28] },
  { round: 9, name: "爱沙尼亚拉力赛", hq: "塔尔图（Tartu）", city: "塔尔图", country: "爱沙尼亚", code: "EE", tz: "Europe/Tallinn", start: [2026, 7, 16], finish: [2026, 7, 19] },
  { round: 10, name: "芬兰拉力赛", hq: "于韦斯屈莱", city: "中芬兰", country: "芬兰", code: "FI", tz: "Europe/Helsinki", start: [2026, 7, 30], finish: [2026, 8, 2] },
  { round: 11, name: "巴拉圭拉力赛", hq: "恩卡纳西翁", city: "伊塔普阿", country: "巴拉圭", code: "PY", tz: "America/Asuncion", start: [2026, 8, 27], finish: [2026, 8, 30] },
  { round: 12, name: "智利拉力赛", hq: "康塞普西翁", city: "比奥比奥", country: "智利", code: "CL", tz: "America/Santiago", start: [2026, 9, 10], finish: [2026, 9, 13] },
  { round: 13, name: "意大利撒丁岛拉力赛", hq: "阿尔盖罗（Alghero）", city: "撒丁岛", country: "意大利", code: "IT", tz: "Europe/Rome", start: [2026, 10, 1], finish: [2026, 10, 4] },
  { round: 14, name: "沙特阿拉伯拉力赛", hq: "吉达（Jeddah）", city: "麦加省", country: "沙特阿拉伯", code: "SA", tz: "Asia/Riyadh", start: [2026, 11, 11], finish: [2026, 11, 14] },
]

/** 计算两个日期相差的天数 */
function dayDiff(start: [number, number, number], finish: [number, number, number]): number {
  const s = Date.UTC(start[0], start[1] - 1, start[2])
  const f = Date.UTC(finish[0], finish[1] - 1, finish[2])
  return Math.round((f - s) / 86400000)
}

/** 给起始日期加上 n 天，返回 [年, 月, 日] */
function addDays(start: [number, number, number], n: number): [number, number, number] {
  const d = new Date(Date.UTC(start[0], start[1] - 1, start[2] + n))
  return [d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate()]
}

function buildSessions(def: WrcRallyDef): RaceSession[] {
  const total = dayDiff(def.start, def.finish)
  const sessions: RaceSession[] = []
  const stageCounts = def.stages ?? [1, 8, 8, 4]
  let ssNum = 1

  // 首日（周四）：排位测试赛段 Shakedown
  {
    const [y, m, d] = def.start
    sessions.push({
      name: "排位测试赛段 (Shakedown)",
      utc: zonedWallTimeToUtc(y, m, d, 8, 0, def.tz).toISOString(),
      tentative: true,
    })
  }

  // 第一比赛日（周五）
  if (total >= 1) {
    const [y, m, d] = addDays(def.start, 1)
    let startHour = 8
    let startMin = 30
    for (let i = 0; i < stageCounts[1]; i++) {
      sessions.push({
        name: `SS${ssNum}`,
        utc: zonedWallTimeToUtc(y, m, d, startHour, startMin, def.tz).toISOString(),
        tentative: true,
      })
      ssNum++
      startMin += 25
      if (startMin >= 60) {
        startMin -= 60
        startHour++
      }
      if (i === 3) {
        startHour = 13
        startMin = 0
      }
    }
  }

  // 第二比赛日（周六）
  if (total >= 2) {
    const [y, m, d] = addDays(def.start, 2)
    let startHour = 8
    let startMin = 30
    for (let i = 0; i < stageCounts[2]; i++) {
      sessions.push({
        name: `SS${ssNum}`,
        utc: zonedWallTimeToUtc(y, m, d, startHour, startMin, def.tz).toISOString(),
        tentative: true,
      })
      ssNum++
      startMin += 25
      if (startMin >= 60) {
        startMin -= 60
        startHour++
      }
      if (i === 3) {
        startHour = 13
        startMin = 0
      }
    }
  }

  // 末日（周日）：特殊赛段 + Power Stage
  {
    const [y, m, d] = def.finish
    let startHour = 8
    let startMin = 30
    for (let i = 0; i < stageCounts[3]; i++) {
      sessions.push({
        name: `SS${ssNum}`,
        utc: zonedWallTimeToUtc(y, m, d, startHour, startMin, def.tz).toISOString(),
        tentative: true,
      })
      ssNum++
      startMin += 25
      if (startMin >= 60) {
        startMin -= 60
        startHour++
      }
    }
    sessions.push({
      name: `SS${ssNum} (Power Stage)`,
      utc: zonedWallTimeToUtc(y, m, d, 12, 0, def.tz).toISOString(),
      isMain: true,
      tentative: true,
    })
  }

  return sessions
}

export function buildWrcEvents(): RaceEvent[] {
  return RALLIES.map((def) => {
    // 地区映射
    const regionMap: Record<string, "europe" | "asia" | "americas" | "middle-east" | "africa" | "oceania"> = {
      "法国": "europe", "瑞典": "europe", "克罗地亚": "europe", "西班牙": "europe",
      "葡萄牙": "europe", "希腊": "europe", "爱沙尼亚": "europe", "芬兰": "europe",
      "意大利": "europe", "肯尼亚": "africa", "日本": "asia", "巴拉圭": "americas",
      "智利": "americas", "沙特阿拉伯": "middle-east",
    }
    return {
      id: `wrc-2026-${def.round}`,
      series: "WRC" as const,
      round: def.round,
      name: def.name,
      circuit: `${def.hq} · 赛事总部`,
      locality: def.city,
      country: def.country,
      countryCode: def.code,
      tz: def.tz,
      sessions: buildSessions(def),
      broadcaster: {
        name: "腾讯视频",
        note: "WRC 中国大陆转播（直播 / 集锦，以平台节目单为准）",
      },
      url: "https://www.wrc.com/",
      tentative: true,
      circuitType: "rally",
      region: regionMap[def.country] ?? "europe",
    }
  })
}
