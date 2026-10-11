import { AsyncLocalStorage } from "node:async_hooks"

const budgets = new AsyncLocalStorage<{ signal: AbortSignal; data: Map<string, Promise<unknown>> }>()

/** Isolates concurrent crawls and cancels network/body work when their budget expires. */
export function withWrcRequestBudget<T>(timeoutMs: number, work: () => Promise<T>): Promise<T> {
  if (!Number.isFinite(timeoutMs) || timeoutMs < 1) throw new RangeError("Invalid WRC request budget")
  return budgets.run({ signal: AbortSignal.timeout(timeoutMs), data: new Map() }, work)
}

export function wrcBudgetExpired(): boolean {
  return budgets.getStore()?.signal.aborted ?? false
}

export function fetchWithinWrcBudget(input: string | URL, init?: RequestInit): Promise<Response> {
  const budget = budgets.getStore()?.signal
  budget?.throwIfAborted()
  const signal = budget && init?.signal ? AbortSignal.any([budget, init.signal]) : budget || init?.signal
  return fetch(input, { ...init, signal }).then(async response => {
    if (!response.ok) {
      // Callers only inspect the status of failures; release unused response bodies.
      try { await response.body?.cancel() } catch { /* Preserve the original HTTP failure. */ }
    }
    return response
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
  }
  try {
    const result = await pending
    if (result === null && context.data.get(key) === pending) context.data.delete(key)
    return result === null ? null : structuredClone(result)
  } catch (error) {
    if (context.data.get(key) === pending) context.data.delete(key)
    throw error
  }
}
