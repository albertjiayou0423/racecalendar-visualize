import test from 'node:test'
import assert from 'node:assert/strict'
import { withWrcRequestBudget, fetchWithinWrcBudget, wrcBudgetExpired } from '../lib/wrc-request-budget.ts'

test('expired crawl budget aborts in-flight requests and prevents new requests', async () => {
  const original = globalThis.fetch
  let calls = 0
  globalThis.fetch = (_url, init) => {
    calls++
    return new Promise((resolve, reject) => {
      init.signal.addEventListener('abort', () => reject(init.signal.reason), { once: true })
    })
  }
  const keepAlive = setTimeout(() => {}, 100)
  try {
    await withWrcRequestBudget(15, async () => {
      await assert.rejects(fetchWithinWrcBudget('https://fixture.invalid'), { name: 'TimeoutError' })
      assert.equal(wrcBudgetExpired(), true)
      assert.throws(() => fetchWithinWrcBudget('https://fixture.invalid'), { name: 'TimeoutError' })
    })
    assert.equal(calls, 1)
    assert.equal(wrcBudgetExpired(), false)
  } finally { globalThis.fetch = original; clearTimeout(keepAlive) }
})
test('concurrent crawls have independent budgets and preserve caller timeout signals', async () => {
  const original = globalThis.fetch
  const signals = []
  globalThis.fetch = async (_url, init) => { signals.push(init.signal); return new Response('fixture') }
  try {
    const caller = new AbortController()
    await withWrcRequestBudget(1000, () => fetchWithinWrcBudget('https://fixture.invalid', { signal: caller.signal }))
    caller.abort()
    assert.equal(signals[0].aborted, true)
    await Promise.all([
      withWrcRequestBudget(5, async () => {
        await new Promise(resolve => setTimeout(resolve, 15))
        assert.equal(wrcBudgetExpired(), true)
      }),
      withWrcRequestBudget(1000, async () => {
        await new Promise(resolve => setTimeout(resolve, 20))
        assert.equal(wrcBudgetExpired(), false)
        await fetchWithinWrcBudget('https://fixture.invalid')
      }),
    ])
    assert.equal(signals[1].aborted, false)
  } finally { globalThis.fetch = original }
})
