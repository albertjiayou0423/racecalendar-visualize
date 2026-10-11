import type { RaceEvent } from "./types"
export function normalizeF1Metadata(event: RaceEvent): RaceEvent {
  if (event.series !== "F1") return event
  const names: Record<string, string> = {
    "Brazilian Grand Prix": "巴西大奖赛", "Barcelona Grand Prix": "巴塞罗那大奖赛",
    "Bahrain Grand Prix in Malaysia": "巴林大奖赛（马来西亚）",
  }
  const circuit = event.circuit.toLowerCase()
  return { ...event, name: names[event.name] ?? event.name,
    ...(circuit.includes("vegas") ? { circuitType: "street" as const } : {}),
    ...(circuit.includes("marina bay") && /^f1-2026-/.test(event.id) ? { circuitInfo: { ...event.circuitInfo, length: "4.927 km", laps: "62" } } : {}),
  }
}
export function eventSourceLabel(url?: string) {
  try { return new URL(url ?? "").hostname.endsWith("wikipedia.org") ? "赛事百科" : "官方网站" } catch { return "赛事来源" }
}
