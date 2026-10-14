import { test } from 'node:test'
import assert from 'node:assert/strict'
import { countdownDisplay } from '../lib/countdown-display.ts'
test('split long countdown into days, hours, minutes and seconds', () => {
  const result = countdownDisplay((9 * 86400 + 5 * 3600 + 45 * 60 + 16) * 1000)
  assert.deepEqual([result.days, result.hours, result.minutes, result.seconds], [9, 5, 45, 16])
  assert.equal(result.showSignals, false)
})
test('signals appear only in the last half hour and never on invalid times', () => {
  assert.equal(countdownDisplay(1800001).showSignals, false)
  assert.equal(countdownDisplay(1800000).showSignals, true)
  assert.equal(countdownDisplay(NaN).showSignals, false)
  assert.equal(countdownDisplay(999).seconds, 1)
  assert.equal(countdownDisplay(0).seconds, 0)
})
test('time unit rollover boundaries', () => {
  for (const [total, expected] of [[86400, [1, 0, 0, 0]], [3600, [0, 1, 0, 0]], [60, [0, 0, 1, 0]], [59, [0, 0, 0, 59]]]) {
    const r = countdownDisplay(total * 1000)
    assert.deepEqual([r.days, r.hours, r.minutes, r.seconds], expected)
  }
})
