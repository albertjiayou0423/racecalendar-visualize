import { test } from 'node:test'
import assert from 'node:assert/strict'
import { countdownCandidate, countdownKey } from '../lib/countdown-entry.ts'
const now = Date.parse('2026-10-14T12:00:00Z')
const event = (seconds, extra = {}) => ({ id: 'f1-test', series: 'F1', sessions: [{ name: '正赛', utc: new Date(now + seconds * 1000).toISOString(), ...extra }] })
test('automatic countdown only opens in the future two-minute window', () => {
  for (const seconds of [-1, 0, 120.001, 121]) assert.equal(countdownCandidate([event(seconds)], now), undefined)
  for (const seconds of [1, 30, 31, 119, 120]) assert.ok(countdownCandidate([event(seconds)], now))
})
test('reject estimates, invalid times and unverified client times', () => {
  for (const extra of [{ tentative: true }, { utc: 'invalid' }, { clientUploadedAt: '2026-10-14' }]) assert.equal(countdownCandidate([event(20, extra)], now), undefined)
  assert.equal(countdownCandidate([{ ...event(20), tentative: true }], now), undefined)
  assert.ok(countdownCandidate([{ ...event(20, { tentative: false }), tentative: true }], now))
})
test('choose earliest session and suppression keys distinguish sessions', () => {
  assert.equal(countdownCandidate([event(25), event(5)], now).session.utc, event(5).sessions[0].utc)
  assert.notEqual(countdownKey(event(5), 'a'), countdownKey(event(5), 'b'))
})
test('WRC only the first chronological stage triggers, including after it has passed', () => {
  const first = event(10).sessions[0]
  const rally = { ...event(25), series: 'WRC', sessions: [event(25).sessions[0], first] }
  assert.equal(countdownCandidate([rally], now).session, first)
  assert.equal(countdownCandidate([rally], now + 15000), undefined)
  assert.equal(countdownCandidate([{ ...rally, sessions: [{ ...first, tentative: true }, event(25).sessions[0]] }], now), undefined)
})
test('past races never automatically enter countdown', () => {
  assert.equal(countdownCandidate([event(-60, { isMain: true })], now), undefined)
  assert.equal(countdownCandidate([event(-121, { isMain: true })], now), undefined)
  assert.equal(countdownCandidate([{ ...event(-31, { isMain: true }), series: 'FE' }], now), undefined)
})
