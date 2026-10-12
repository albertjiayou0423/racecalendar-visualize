import type { RaceEvent, ScheduleResponse, Series } from "./types"
export const PLAYGROUND_SCENARIOS = ["normal", "loading", "empty", "error", "offline", "tentative", "long", "busy"] as const
export function playgroundData(scenario: string, now: number): ScheduleResponse {
  const events: RaceEvent[] = (["F1", "WRC", "FE"] as Series[]).map((series, index) => ({
    id: `playground-${series.toLowerCase()}`, series, round: index + 1,
    name: scenario === "long" ? "用于检查窄屏排版的超长赛事名称 · 城市街道大奖赛暨赛季特别站" : `${series} 预览赛事`,
    circuit: "预览赛道", locality: "上海", country: "中国", tz: "Asia/Shanghai",
    circuitType: series === "WRC" ? "rally" : "street", region: "asia",
    tentative: scenario === "tentative" && series === "WRC",
    sessions: Array.from({ length: scenario === "busy" ? 12 : 3 }, (_, i) => ({
      name: series === "WRC" ? `SS${i + 1} 预览赛段` : i === 2 ? "正赛" : `练习赛 ${i + 1}`,
      utc: new Date(now + (index + 1) * 3600000 + i * 7200000).toISOString(),
      isMain: i === 2, tentative: scenario === "tentative" && series === "WRC",
    })),
    broadcaster: { name: "预览转播信息", confirmed: false },
  }))
  return { events: scenario === "empty" ? [] : events, sources: (["F1", "WRC", "FE"] as Series[]).map(series => ({ series, label: "Playground 隔离测试数据", ok: scenario !== "error" })), fetchedAt: new Date(now).toISOString(), ...(scenario === "offline" ? { offline: true } : {}) }
}
