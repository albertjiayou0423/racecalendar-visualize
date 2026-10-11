import test from 'node:test'
import assert from 'node:assert/strict'
import { fetchWithSnapshot } from '../lib/fetch-with-snapshot.ts'

test('failed WRC attempts expose current diagnostics separately from retained snapshot data', async () => {
  const diagnostics = { requests: 3, networkFailures: 1, cacheHits: 0, httpStatuses: { 403: 2 }, durationMs: 100, budgetExpired: false }
  const historical = { ...diagnostics, requests: 99 }
  const snapshot = { data: { ok: true, events: [{ id: 'confirmed' }], diagnostics: historical }, fetchedAt: 'fixture' }
  let writes = 0
  for (const cached of [snapshot, null]) {
    const result = await fetchWithSnapshot({
      fetcher: async () => ({ ok: false, events: [], diagnostics }),
      load: async () => cached, save: async () => { writes++ },
    })
    assert.deepEqual(result.diagnostics, diagnostics)
    assert.equal(result.fromCache, !!cached)
    assert.equal(result.fresh, false)
    if (cached) assert.deepEqual(result.result.diagnostics, historical)
  }
  assert.equal(writes, 0)
})

test('successful WRC attempt diagnostics survive persistence failure', async () => {
  const diagnostics = { requests: 1, networkFailures: 0, cacheHits: 0, httpStatuses: { 200: 1 }, durationMs: 10, budgetExpired: false }
  const result = await fetchWithSnapshot({
    fetcher: async () => ({ ok: true, events: [{ id: 'fresh' }], diagnostics }),
    load: async () => null, save: async () => { throw new Error('database unavailable') },
  })
  assert.equal(result.persistenceError, true)
  assert.deepEqual(result.diagnostics, diagnostics)
})
