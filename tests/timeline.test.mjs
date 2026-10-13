import test from 'node:test'
import assert from 'node:assert/strict'
import { timelineDays } from '../lib/timeline.ts'
test('timeline sorts without mutation and groups at the Beijing midnight boundary', () => {
  const sessions = [{ name: 'SS9', utc: '2026-11-01T16:01:00Z' }, { name: 'SS2', utc: '2026-11-01T15:59:00Z' }]
  const days = timelineDays({ series: 'WRC', sessions })
  assert.deepEqual(days.map(day => day.sessions[0].name), ['SS2', 'SS9'])
  assert.equal(days.length, 2)
  assert.equal(sessions[0].name, 'SS9')
})
test('invalid and estimated times remain visible without invented dates; explicit confirmation wins', () => {
  const days = timelineDays({ series: 'WRC', tentative: true, sessions: [
    { name: 'estimated', utc: '2026-11-01T10:00:00Z' },
    { name: 'confirmed', utc: '2026-11-01T11:00:00Z', tentative: false },
    { name: 'missing', utc: '' }
  ] })
  assert.equal(days[0].sessions[0].name, 'confirmed')
  assert.deepEqual(days[1].sessions.map(session => session.name), ['estimated', 'missing'])
  assert.equal(days[1].key, 'pending')
  assert.deepEqual(timelineDays({ series: 'F1', sessions: [] }), [])
})
