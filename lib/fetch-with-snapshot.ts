import type { WrcRequestDiagnostics } from "./wrc-request-budget"
export type FetchResult<T> = { events: T[]; ok: boolean; note?: string; dataSource?: "scraped" | "api" | "mixed"; diagnostics?: WrcRequestDiagnostics }
export type Snapshot<T> = { data: FetchResult<T>; fetchedAt: string }

/** Shared policy for scheduled and manual fetches; failed data never becomes a snapshot. */
export async function fetchWithSnapshot<T>(options: {
  fetcher: () => Promise<FetchResult<T>>
  load: () => Promise<Snapshot<T> | null>
  save: (result: FetchResult<T>) => Promise<void>
}): Promise<{ result: FetchResult<T>; fromCache: boolean; fresh: boolean; persistenceError?: boolean; diagnostics?: WrcRequestDiagnostics }> {
  let result: FetchResult<T>
  try {
    result = await options.fetcher()
  } catch (err) {
    result = { events: [], ok: false, note: err instanceof Error ? err.message : "数据获取失败" }
  }
  const attempt = result.diagnostics ? { diagnostics: result.diagnostics } : {}
  if (result.ok && result.events.length) {
    try {
      await options.save(result)
      return { result, fromCache: false, fresh: true, ...attempt }
    } catch {
      return { result: { ...result, note: `${result.note || "数据获取成功"}；持久化失败，请重试` }, fromCache: false, fresh: true, persistenceError: true, ...attempt }
    }
  }
  let snapshot: Snapshot<T> | null = null
  try { snapshot = await options.load() } catch { /* No usable snapshot. */ }
  if (snapshot?.data?.ok && snapshot.data.events?.length) {
    return {
      result: { ...snapshot.data, note: `获取失败，使用 ${snapshot.fetchedAt} 的最近成功快照` },
      fromCache: true, fresh: false, ...attempt,
    }
  }
  return { result: { ...result, ok: false }, fromCache: false, fresh: false, ...attempt }
}

export function consumesQuota(series: string, result: { dataSource?: string }): boolean {
  return series !== "WRC" || result.dataSource === "api" || result.dataSource === "mixed"
}
