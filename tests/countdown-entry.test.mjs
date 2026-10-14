import { test } from 'node:test'
import assert from 'node:assert/strict'
import { countdownCandidate, countdownKey } from '../lib/countdown-entry.ts'
const now = Date.parse('2026-10-14T12:00:00Z')
const event = (seconds, extra = {}) => ({ id: 'f1-test', series: 'F1', sessions: [{ name: '正赛', utc: new Date(now + seconds * 1000).toISOString(), ...extra }] })
test('automatic countdown only opens in the future 30-second window', () => {
  for (const seconds of [-1, 0, 31]) assert.equal(countdownCandidate([event(seconds)], now), undefined)
  for (const seconds of [1, 30]) assert.ok(countdownCandidate([event(seconds)], now))
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
