import test from 'node:test'
import assert from 'node:assert/strict'
import { didCountdownStart } from '../lib/countdown-transition.ts'

const waiting = { targetMs: 1000, series: 'WRC', started: false }
test('only an actual crossing of the same countdown triggers the ceremony', () => {
  assert.equal(didCountdownStart(waiting, { ...waiting, started: true }), true)
  assert.equal(didCountdownStart(waiting, waiting), false)
  assert.equal(didCountdownStart({ ...waiting, started: true }, { ...waiting, started: true }), false)
})
test('changing target, series or invalid timestamps resets without a false start', () => {
  for (const change of [{ targetMs: 2000 }, { series: 'F1' }, { targetMs: NaN }]) {
    assert.equal(didCountdownStart(waiting, { ...waiting, ...change, started: true }), false)
  }
  assert.equal(didCountdownStart({ ...waiting, started: true }, { ...waiting, targetMs: 2000 }), false)
})
