import { getSql } from "./db"
import { fetchF1, fetchFe, fetchWrc } from "./fetchers"
import { getLatestSnapshot, incrementCrawlCount, saveCrawlSnapshot, saveWrcSnapshotMerged } from "./crawl-store"
import { consumesQuota, fetchWithSnapshot } from "./fetch-with-snapshot"
import type { RaceEvent, Series } from "./types"

export function refreshSeries(series: Series, allowApiFallback = true, source = "schedule-api") {
  return fetchWithSnapshot<RaceEvent>({
    fetcher: () => series === "F1" ? fetchF1() : series === "FE" ? fetchFe() : fetchWrc({ allowApiFallback }),
    load: () => getLatestSnapshot(series),
    save: async result => {
      if (!getSql()) return
      if (series === "WRC") await saveWrcSnapshotMerged(result, source)
      else await saveCrawlSnapshot(series, result, source)
      if (consumesQuota(series, result)) await incrementCrawlCount(series)
    },
  })
}
