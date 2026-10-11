import { AsyncLocalStorage } from "node:async_hooks"

const budgets = new AsyncLocalStorage<AbortSignal>()

/** Isolates concurrent crawls and cancels network/body work when their budget expires. */
export function withWrcRequestBudget<T>(timeoutMs: number, work: () => Promise<T>): Promise<T> {
  if (!Number.isFinite(timeoutMs) || timeoutMs < 1) throw new RangeError("Invalid WRC request budget")
  return budgets.run(AbortSignal.timeout(timeoutMs), work)
}

export function wrcBudgetExpired(): boolean {
  return budgets.getStore()?.aborted ?? false
}

export function fetchWithinWrcBudget(input: string | URL, init?: RequestInit): Promise<Response> {
  const budget = budgets.getStore()
  budget?.throwIfAborted()
  const signal = budget && init?.signal ? AbortSignal.any([budget, init.signal]) : budget || init?.signal
  return fetch(input, { ...init, signal })
}
