import { NextResponse } from "next/server"
import { fetchF1, fetchFe, fetchWrc } from "@/lib/fetchers"
import { buildWrcEvents } from "@/lib/wrc-data"
import { initCrawlTables, saveCrawlSnapshot, getLatestSnapshot, getEventOverride, getCrawlQuota, incrementCrawlCount } from "@/lib/crawl-store"
import type { ScheduleResponse, Series, RaceEvent } from "@/lib/types"
import { CIRCUIT_IMAGES } from "@/lib/fetchers"

export const revalidate = 3600
export const maxDuration = 300

/** 每日爬取上限 */
const CRAWL_DAILY_LIMIT = 10

export async function GET() {
  // 初始化爬虫表（幂等）
  await initCrawlTables()

  // 检查今日爬取配额
  // 注意：WRC 不做前置阻止，但只有配额充足时才允许使用 ocblacktop API fallback
  // 官网爬虫（feed API）始终允许，不消耗配额
  const quotaChecks = await Promise.all([
    canCrawlToday("F1"),
    canCrawlToday("FE"),
    canCrawlToday("WRC"),
  ])

  const wrcAllowApi = quotaChecks[2]

  // 根据配额决定是否实际爬取，还是使用快照
  // WRC 始终尝试爬取（官网爬虫不消耗配额），仅在配额充足时启用 API fallback
  const [f1Result, feResult, wrcResult] = await Promise.all([
    quotaChecks[0] ? fetchAndSave("F1", fetchF1) : loadFromSnapshot("F1"),
    quotaChecks[1] ? fetchAndSave("FE", fetchFe) : loadFromSnapshot("FE"),
    fetchAndSave("WRC", () => fetchWrc({ allowApiFallback: wrcAllowApi })),
  ])

  const f1 = f1Result.result
  const fe = feResult.result
  const wrc = wrcResult.result

  const wrcEvents = wrc.events.length > 0
    ? wrc.events
    : buildWrcEvents()

  // 合并所有赛事并应用覆盖
  const allEvents = [...f1.events, ...wrcEvents, ...fe.events]
  const mergedEvents = await applyOverrides(allEvents)

  const body: ScheduleResponse = {
    events: mergedEvents,
    sources: [
      {
        series: "F1",
        label: "Jolpica F1 API（Ergast 兼容）",
        ok: f1.ok,
        note: f1.ok
          ? f1Result.fromCache ? "使用持久化快照数据" : "实时公开数据，时间为 UTC"
          : f1.note,
      },
      {
        series: "WRC",
        label: "WRC 官方 itinerary（爬取 / ocblacktop fallback）",
        ok: wrc.ok,
        note: wrc.ok
          ? wrcResult.fromCache ? "使用持久化快照数据" : (wrc.note || "成功从官方 itinerary 爬取真实赛段时间")
          : "爬取失败，使用估计时间（以官方 itinerary 为准）",
      },
      {
        series: "FE",
        label: "Formula E 官方 API（pulselive）",
        ok: fe.ok,
        note: fe.ok
          ? feResult.fromCache ? "使用持久化快照数据" : "实时公开数据，含当地时间与 GMT 偏移"
          : fe.note,
      },
    ],
    fetchedAt: new Date().toISOString(),
  }

  return NextResponse.json(body)
}

/** 检查今天是否还能爬取（先查配额，不递增） */
async function canCrawlToday(series: Series): Promise<boolean> {
  try {
    const { used, limit } = await getCrawlQuota(series)
    return used < limit
  } catch {
    // DB 不可用时，允许爬取
    return true
  }
}

/** 爬取并保存快照 */
async function fetchAndSave(
  series: Series,
  fetcher: () => Promise<{ events: RaceEvent[]; ok: boolean; note?: string; dataSource?: "scraped" | "api" | "mixed" }>
): Promise<{ result: { events: RaceEvent[]; ok: boolean; note?: string }; fromCache: boolean }> {
  try {
    const result = await fetcher()
    if (result.ok && result.events.length > 0) {
      await saveCrawlSnapshot(series, result, "schedule-api")
      
      if (series === "WRC") {
        if (result.dataSource === "api") {
          await incrementCrawlCount(series)
          console.log(`WRC: 使用 ocblacktop API，消耗配额`)
        } else if (result.dataSource === "mixed") {
          await incrementCrawlCount(series)
          console.log(`WRC: 混合数据（含 API），消耗配额`)
        } else {
          console.log(`WRC: 使用官网爬虫数据，不消耗配额`)
        }
      } else {
        await incrementCrawlCount(series)
      }
    }
    return { result, fromCache: false }
  } catch (err) {
    const cached = await loadFromSnapshot(series)
    if (cached.result.ok) {
      return cached
    }
    return {
      result: { events: [], ok: false, note: err instanceof Error ? err.message : "数据获取失败" },
      fromCache: false,
    }
  }
}

/** 从快照加载数据 */
async function loadFromSnapshot(
  series: Series
): Promise<{ result: { events: RaceEvent[]; ok: boolean; note?: string }; fromCache: boolean }> {
  try {
    const snapshot = await getLatestSnapshot(series)
    if (snapshot?.data?.events && snapshot.data.events.length > 0) {
      return {
        result: {
          events: snapshot.data.events,
          ok: true,
          note: `使用 ${new Date(snapshot.fetchedAt).toLocaleString("zh-CN")} 的持久化快照`,
        },
        fromCache: true,
      }
    }
  } catch {}
  return {
    result: { events: [], ok: false, note: "无快照数据且爬取配额已用尽" },
    fromCache: true,
  }
}

/** F1赛道名称到circuitId的映射 */
const F1_CIRCUIT_MAP: Record<string, string> = {
  "albert park": "albert_park",
  "shanghai": "shanghai",
  "suzuka": "suzuka",
  "miami": "miami",
  "villeneuve": "villeneuve",
  "monaco": "monaco",
  "catalunya": "catalunya",
  "red bull ring": "red_bull_ring",
  "silverstone": "silverstone",
  "spa": "spa",
  "hungaroring": "hungaroring",
  "zandvoort": "zandvoort",
  "monza": "monza",
  "madrid": "madrid",
  "baku": "baku",
  "marina bay": "marina_bay",
  "americas": "americas",
  "rodriguez": "rodriguez",
  "interlagos": "interlagos",
  "vegas": "vegas",
  "losail": "losail",
  "yas marina": "yas_marina",
}

/** 对赛事列表应用手动覆盖 */
async function applyOverrides(events: RaceEvent[]): Promise<RaceEvent[]> {
  try {
    return await Promise.all(
      events.map(async (event) => {
        const override = await getEventOverride(event.id)
        let result = override ? { ...event, ...override } : event

        if (event.series === "F1") {
          const circuitName = event.circuit.toLowerCase()
          for (const [name, key] of Object.entries(F1_CIRCUIT_MAP)) {
            if (circuitName.includes(name)) {
              result = { ...result, circuitImageUrl: CIRCUIT_IMAGES[key] }
              break
            }
          }
        }

        return result
      })
    )
  } catch {
    return events
  }
}
