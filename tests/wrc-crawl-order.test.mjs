import test from 'node:test'
import assert from 'node:assert/strict'
import { prioritizeWrcRallies } from '../lib/wrc-crawl-order.ts'
test('active rally weekend and imminent rallies precede old or distant races', () => {
  const rallies = [
    { round: 1, startDate: '2026-01-22' },
    { round: 14, startDate: '2026-11-26' },
    { round: 13, startDate: '2026-10-22' },
    { round: 12, startDate: '2026-10-08' },
    { round: 11, startDate: '2026-10-01' },
  ]
  const original = [...rallies]
  const result = prioritizeWrcRallies(rallies, Date.parse('2026-10-11T12:00:00Z'))
  assert.deepEqual(result.map(r => r.round), [12, 13, 11, 14, 1])
  assert.deepEqual(rallies, original)
})
test('invalid dates sort last and equal dates retain deterministic round ordering', () => {
  const result = prioritizeWrcRallies([
    { round: 8, startDate: 'unknown' }, { round: 4, startDate: '2026-10-12' },
    { round: 3, startDate: '2026-10-12' }, { round: 1, startDate: 'invalid' },
  ], Date.parse('2026-10-11'))
  assert.deepEqual(result.map(r => r.round), [3, 4, 1, 8])
})
