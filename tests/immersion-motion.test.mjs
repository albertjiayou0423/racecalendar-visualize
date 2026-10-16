import test from 'node:test'
import assert from 'node:assert/strict'
import { IMMERSION_MOTION, releaseVisible, pulseOrigin } from '../lib/immersion-motion.ts'

test('late observation catches up to the release rather than replaying an expired ceremony', () => {
  for (const series of ['F1', 'FE', 'WRC']) {
    const at = 10000
    const end = IMMERSION_MOTION.impact[series]
    assert.equal(releaseVisible(at, at - 1, series), false)
    assert.equal(releaseVisible(at, at, series), true)
    assert.equal(releaseVisible(at, at + end - 1, series), true)
    assert.equal(releaseVisible(at, at + end, series), false)
    assert.equal(releaseVisible(at, at + 60000, series), false)
    assert.equal(releaseVisible(NaN, at, series), false)
  }
})

test('each prestart pulse is anchored to the actual second boundary', () => {
  const target = 20000
  for (const [now, seconds, age] of [[15000, 5, 0], [15250, 5, 250], [16000, 4, 0], [19950, 1, 950]]) {
    assert.equal(now - pulseOrigin(target, seconds), age)
  }
})
