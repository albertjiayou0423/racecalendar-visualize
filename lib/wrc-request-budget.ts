import { AsyncLocalStorage } from "node:async_hooks"

export type WrcRequestDiagnostics = {
  requests: number
  networkFailures: number
  cacheHits: number
  httpStatuses: Record<string, number>
  durationMs: number
  budgetExpired: boolean
}
const budgets = new AsyncLocalStorage<{
  signal: AbortSignal; data: Map<string, Promise<unknown>>; startedAt: number
  metrics: Omit<WrcRequestDiagnostics, "durationMs" | "budgetExpired">
}>()

/** Isolates concurrent crawls and cancels network/body work when their budget expires. */
export function withWrcRequestBudget<T>(timeoutMs: number, work: () => Promise<T>): Promise<T> {
  if (!Number.isFinite(timeoutMs) || timeoutMs < 1) throw new RangeError("Invalid WRC request budget")
  return budgets.run({ signal: AbortSignal.timeout(timeoutMs), data: new Map(), startedAt: Date.now(),
    metrics: { requests: 0, networkFailures: 0, cacheHits: 0, httpStatuses: {} } }, work)
}

/** Counts only: never retain request URLs, headers, credentials or response contents. */
export function getWrcRequestDiagnostics(): WrcRequestDiagnostics | undefined {
  const context = budgets.getStore()
  if (!context) return undefined
  return { ...context.metrics, httpStatuses: { ...context.metrics.httpStatuses },
    durationMs: Math.max(0, Date.now() - context.startedAt), budgetExpired: context.signal.aborted }
}

export function wrcBudgetExpired(): boolean {
  return budgets.getStore()?.signal.aborted ?? false
}

export function fetchWithinWrcBudget(input: string | URL, init?: RequestInit): Promise<Response> {
  const context = budgets.getStore()
  const budget = context?.signal
  budget?.throwIfAborted()
  const signal = budget && init?.signal ? AbortSignal.any([budget, init.signal]) : budget || init?.signal
  if (context) context.metrics.requests++
  return fetch(input, { ...init, signal }).then(async response => {
    if (context) context.metrics.httpStatuses[response.status] = (context.metrics.httpStatuses[response.status] || 0) + 1
    if (!response.ok) {
      // Callers only inspect the status of failures; release unused response bodies.
      try { await response.body?.cancel() } catch { /* Preserve the original HTTP failure. */ }
    }
    return response
  }, error => {
    if (context) context.metrics.networkFailures++
    throw error
  })
}

/** Share parsed data within one crawl; null/errors may be retried and never persist. */
export async function memoizeWrcData<T>(key: string, load: () => Promise<T | null>): Promise<T | null> {
  const context = budgets.getStore()
  if (!context) return load()
  context.signal.throwIfAborted()
  let pending = context.data.get(key) as Promise<T | null> | undefined
  if (!pending) {
    pending = Promise.resolve().then(load)
    context.data.set(key, pending)
  } else context.metrics.cacheHits++
  try {
    const result = await pending
    if (result === null && context.data.get(key) === pending) context.data.delete(key)
    return result === null ? null : structuredClone(result)
  } catch (error) {
    if (context.data.get(key) === pending) context.data.delete(key)
    throw error
  }
}
