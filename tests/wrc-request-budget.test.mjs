import test from 'node:test'
import assert from 'node:assert/strict'
import { withWrcRequestBudget, fetchWithinWrcBudget, wrcBudgetExpired } from '../lib/wrc-request-budget.ts'

test('failed HTTP responses release bodies while successful responses remain readable', async () => {
  const original = globalThis.fetch
  let cancelled = 0
  let status = 403
  globalThis.fetch = async () => new Response(new ReadableStream({
    start(controller) { controller.enqueue(new TextEncoder().encode('fixture')) },
    cancel() { cancelled++ },
  }), { status })
  try {
    const failure = await fetchWithinWrcBudget('https://fixture.invalid')
    assert.equal(failure.status, 403)
    assert.equal(cancelled, 1)
    status = 200
    const success = await fetchWithinWrcBudget('https://fixture.invalid')
    assert.equal(cancelled, 1)
    const reader = success.body.getReader()
    assert.equal(new TextDecoder().decode((await reader.read()).value), 'fixture')
    await reader.cancel()
    globalThis.fetch = async () => ({ ok: false, status: 503, body: { cancel: async () => { throw new Error('cancel failed') } } })
    assert.equal((await fetchWithinWrcBudget('https://fixture.invalid')).status, 503)
  } finally { globalThis.fetch = original }
})

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

import { memoizeWrcData } from '../lib/wrc-request-budget.ts'
test('crawl-scoped data cache deduplicates concurrent and repeated loads without sharing mutations', async () => {
  let calls = 0
  const load = async () => { calls++; await new Promise(r => setTimeout(r, 5)); return { stages: [{ name: 'SS1' }] } }
  await withWrcRequestBudget(1000, async () => {
    const [a, b] = await Promise.all([memoizeWrcData('feed:one:2026', load), memoizeWrcData('feed:one:2026', load)])
    a.stages[0].name = 'mutated'
    assert.equal(b.stages[0].name, 'SS1')
    assert.equal((await memoizeWrcData('feed:one:2026', load)).stages[0].name, 'SS1')
    assert.equal(calls, 1)
  })
  await withWrcRequestBudget(1000, () => memoizeWrcData('feed:one:2026', load))
  assert.equal(calls, 2)
})
test('failed and missing data loads do not poison later attempts', async () => {
  await withWrcRequestBudget(1000, async () => {
    assert.equal(await memoizeWrcData('same', async () => null), null)
    await assert.rejects(memoizeWrcData('same', async () => { throw new Error('temporary') }))
    assert.deepEqual(await memoizeWrcData('same', async () => ({ recovered: true })), { recovered: true })
  })
})
