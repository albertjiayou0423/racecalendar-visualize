import { after, connection, NextResponse } from "next/server"
import { refreshSeries } from "@/lib/schedule-fetch"
import { buildWrcEvents } from "@/lib/wrc-data"
import { initCrawlTables, getLatestSnapshot, getAllOverrides, getCrawlQuota } from "@/lib/crawl-store"
import type { ScheduleResponse, Series, RaceEvent } from "@/lib/types"
import { normalizeF1Metadata } from "@/lib/f1-metadata"
import { CIRCUIT_IMAGES } from "@/lib/fetchers"
import { addOfficialCalendarFallbacks } from "@/lib/official-calendar-fallback"
import { logServerError, logServerWarn } from "@/lib/server-log"
import { recordScheduleHealth, sendDatabaseAvailabilityAlert, sendMonthlyHealthReport, sendScheduleIncidentAlert } from "@/lib/notification-mail"

export const revalidate = 3600
export const maxDuration = 300


export async function GET() {
  // Fetch only during a request; production builds must not crawl an entire season.
  await connection()
  // 初始化爬虫表（幂等）
  try {
    await initCrawlTables()
  } catch (error) {
    logServerError("api.schedule.database_init_failed", {}, error)
    after(() => sendDatabaseAvailabilityAlert())
    throw error
  }

  // Return persisted data immediately; expensive upstream work runs after the response.
  const series: Series[] = ["F1", "FE", "WRC"]
  const snapshots = await Promise.all(series.map(async name => {
    try {
      return await getLatestSnapshot(name)
    } catch (error) {
      logServerWarn("api.schedule.snapshot_read_failed", { series: name }, error)
      return null
    }
  }))
  const results = await Promise.all(series.map(async (name, i) => {
    const snapshot = snapshots[i]
    if (snapshot?.data?.ok && snapshot.data.events?.length) {
      if (!Number.isFinite(Date.parse(snapshot.fetchedAt)) || Date.now() - Date.parse(snapshot.fetchedAt) > 3600000) {
        after(() => refreshInBackground(name))
      }
      return {
        result: { ...snapshot.data, note: `使用 ${snapshot.fetchedAt} 的持久化快照` },
        fromCache: true,
      }
    }
    if (name !== "WRC" && !await canCrawlToday(name)) return loadFromSnapshot(name)
    return refreshSeries(name, await canCrawlToday(name))
  }))
  const [f1Result, feResult, wrcResult] = results

  after(async () => {
    const statuses = results.map(({ result }, index) => ({ series: series[index], ok: result.ok }))
    await recordScheduleHealth(statuses)
    if (statuses.every(status => !status.ok)) await sendScheduleIncidentAlert()
    try {
      await sendMonthlyHealthReport()
    } catch (error) {
      logServerError("notifications.monthly_report_failed", {}, error)
    }
  })

  results.forEach(({ result, fromCache }, index) => {
    if (!result.ok) logServerWarn("api.schedule.series_unavailable", {
      series: series[index],
      source: fromCache ? "snapshot" : "upstream",
      eventCount: result.events.length,
      note: result.note,
    })
  })

  const f1 = f1Result.result
  const fe = feResult.result
  const wrc = wrcResult.result

  const wrcEvents = wrc.events.length > 0
    ? wrc.events
    : buildWrcEvents()

  // Calendar dates can be public before session times. Keep the fast snapshot path
  // and overlay the published next-year date-only safety calendar while source refresh runs.
  const currentYear = new Date().getFullYear()
  const snapshotEvents = [...f1.events, ...wrcEvents, ...fe.events]
  const calendarFallback = addOfficialCalendarFallbacks(snapshotEvents, currentYear + 1)
  const allEvents = calendarFallback.events.map(normalizeF1Metadata)
  const mergedEvents = await applyOverrides(allEvents)

  const body: ScheduleResponse = {
    events: mergedEvents,
    sources: [
      {
        series: "F1",
        label: "Jolpica F1 API（Ergast 兼容）",
        ok: f1.ok,
        note: [f1.note || (f1Result.fromCache ? "使用持久化快照数据" : "实时公开数据，时间为 UTC"), calendarFallback.added.F1 ? `官网赛历日期补齐 ${calendarFallback.added.F1} 场，具体场次时间待确认` : null].filter(Boolean).join("；"),
      },
      {
        series: "WRC",
        label: "WRC 官方赛历 / itinerary（行程回退）",
        ok: wrc.ok,
        note: [wrc.ok
          ? wrcResult.fromCache ? (wrc.note || "使用持久化快照数据") : (wrc.note || "成功从官方 itinerary 爬取真实赛段时间")
          : "爬取失败，使用官方日期和待确认的赛段时间", calendarFallback.added.WRC ? `官方日期补齐 ${calendarFallback.added.WRC} 场，赛段时间待确认` : null].filter(Boolean).join("；"),
      },
      {
        series: "FE",
        label: "Formula E 官方 API（pulselive）",
        ok: fe.ok,
        note: [fe.note || (feResult.fromCache ? "使用持久化快照数据" : "实时公开数据，含当地时间与 GMT 偏移"), calendarFallback.added.FE ? `官网赛历日期补齐 ${calendarFallback.added.FE} 场，具体场次时间待确认` : null].filter(Boolean).join("；"),
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
  } catch (error) {
    logServerWarn("api.schedule.quota_check_failed", { series }, error)
    // DB 不可用时，允许爬取
    return true
  }
}

/** 从快照加载数据 */
async function loadFromSnapshot(
  series: Series
): Promise<{ result: { events: RaceEvent[]; ok: boolean; note?: string }; fromCache: boolean }> {
  try {
    const snapshot = await getLatestSnapshot(series)
    if (snapshot?.data?.ok && snapshot.data.events?.length > 0) {
      return {
        result: {
          events: snapshot.data.events,
          ok: true,
          note: `使用 ${new Date(snapshot.fetchedAt).toLocaleString("zh-CN")} 的持久化快照`,
        },
        fromCache: true,
      }
    }
  } catch (error) {
    logServerError("api.schedule.snapshot_read_failed", { series }, error)
  }
  logServerWarn("api.schedule.snapshot_unavailable", { series })
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
    const overrides = new Map((await getAllOverrides()).map(row => [row.eventId, row.data]))
    return events.map((event) => {
        const override = overrides.get(event.id)
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
  } catch (error) {
    logServerWarn("api.schedule.overrides_read_failed", {}, error)
    return events
  }
}

// Deduplicate refreshes within a warm function instance. Persistence remains authoritative.
const activeRefreshes = new Map<Series, Promise<void>>()
function refreshInBackground(series: Series): Promise<void> {
  const active = activeRefreshes.get(series)
  if (active) return active
  const pending = (async () => {
    const allowed = await canCrawlToday(series)
    if (series === "WRC" || allowed) await refreshSeries(series, allowed)
  })().catch(error => logServerError("api.schedule.background_refresh_failed", { series }, error))
    .finally(() => activeRefreshes.delete(series))
  activeRefreshes.set(series, pending)
  return pending
}
