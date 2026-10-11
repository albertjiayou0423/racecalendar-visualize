import test from 'node:test'
import assert from 'node:assert/strict'
import { mergeWrcTargets } from '../lib/wrc-targets.ts'
const local = [1, 2, 3].map(round => ({ round, name: `Local ${round}`, eventSlug: `local-${round}-2026`, startDate: '2026-07-01', tz: 'Europe/Helsinki' }))
test('partial official calendar updates matching target but preserves every local round and metadata', () => {
  const result = mergeWrcTargets(local, [{ round: 2, eventSlug: 'official-2-2026', startDate: '2026-07-09', tz: 'UTC' }])
  assert.deepEqual(result.map(r => r.round), [1, 2, 3])
  assert.equal(result[1].eventSlug, 'official-2-2026')
  assert.equal(result[1].startDate, '2026-07-09')
  assert.equal(result[1].name, 'Local 2')
  assert.equal(result[1].tz, 'Europe/Helsinki')
  assert.equal(local[1].eventSlug, 'local-2-2026')
})
test('wrong-season, ambiguous and unknown targets cannot replace local rounds', () => {
  const result = mergeWrcTargets(local, [
    { round: 1, eventSlug: 'old-2025', startDate: '2025-07-01', tz: 'UTC' },
    { round: 2, eventSlug: 'one-2026', startDate: '2026-07-09', tz: 'UTC' },
    { round: 2, eventSlug: 'other-2026', startDate: '2026-07-10', tz: 'UTC' },
    { round: 3, eventSlug: 'wrong-2025', startDate: '2026-07-01', tz: 'UTC' },
    { round: 99, eventSlug: 'unknown-2026', startDate: '2026-07-01', tz: 'UTC' },
  ])
  assert.deepEqual(result, local)
})
