import { getSql } from "./db"
import { fetchF1, fetchFe, fetchWrc } from "./fetchers"
import { getLatestSnapshot, incrementCrawlCount, saveCrawlSnapshot, saveWrcSnapshotMerged } from "./crawl-store"
import { consumesQuota, fetchWithSnapshot, type FetchResult } from "./fetch-with-snapshot"
import type { RaceEvent, Series } from "./types"
import { createDataFlowRunId, recordDataFlowStage, summarizeDataEvent, type DataFlowStage, type DataFlowTrigger } from "./data-flow-telemetry"

export async function refreshSeries(series: Series, allowApiFallback = true, source = "schedule-api") {
  const trigger: DataFlowTrigger = source === "admin-manual" ? "admin-manual" : source === "schedule-background" ? "schedule-background" : "schedule-api"
  const runId = createDataFlowRunId()
  const startedAt = new Date().toISOString()
  let eventCount = 0
  let sample = null as ReturnType<typeof summarizeDataEvent>
  let diagnostics: import("./wrc-request-budget").WrcRequestDiagnostics | undefined
  let stage: DataFlowStage = "fetching"
  const trace = async (nextStage: DataFlowStage, persistenceError = false, usedSnapshot = false) => {
    stage = nextStage
    try {
      await recordDataFlowStage({ series, runId, stage, trigger, startedAt, eventCount, sample, diagnostics, persistenceError, usedSnapshot })
    } catch (error) {
      // Observability must never change whether schedule data can be fetched or saved.
      console.warn("data_flow.telemetry_write_failed", { series, stage, error: error instanceof Error ? error.name : "unknown" })
    }
  }

  await trace("fetching")
  const outcome = await fetchWithSnapshot<RaceEvent>({
    fetcher: async () => {
      const result: FetchResult<RaceEvent> = await (series === "F1" ? fetchF1() : series === "FE" ? fetchFe() : fetchWrc({ allowApiFallback }))
      eventCount = result.events.length
      sample = summarizeDataEvent(result.events[0])
      diagnostics = result.diagnostics
      await trace(result.ok && result.events.length ? "checking" : "fallback")
      return result
    },
    load: async () => {
      await trace("fallback")
      const snapshot = await getLatestSnapshot(series)
      if (snapshot?.data?.events?.length) {
        eventCount = snapshot.data.events.length
        sample = summarizeDataEvent(snapshot.data.events[0])
      }
      return snapshot
    },
    save: async result => {
      await trace("persisting")
      if (!getSql()) return
      if (series === "WRC") await saveWrcSnapshotMerged(result, source)
      else await saveCrawlSnapshot(series, result, source)
      if (consumesQuota(series, result)) await incrementCrawlCount(series)
    },
  })

  eventCount = outcome.result.events.length
  sample = summarizeDataEvent(outcome.result.events[0]) ?? sample
  diagnostics = outcome.diagnostics ?? diagnostics
  if (outcome.fresh) await trace("complete", outcome.persistenceError)
  else if (outcome.fromCache) await trace("complete", false, true)
  else await trace("failed")
  return outcome
}
