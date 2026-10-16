import test from 'node:test'
import assert from 'node:assert/strict'
import { clockTilt } from '../lib/clock-parallax.ts'

test('initial holding angle is neutral and tilt stays bounded under large movement', () => {
  const neutral = clockTilt(60, -15, 60, -15)
  assert.equal(Math.abs(neutral.x), 0)
  assert.equal(Math.abs(neutral.y), 0)
  const far = clockTilt(150, 80, 60, -15)
  assert.equal(far.x, -5)
  assert.equal(far.y, 6)
})

test('landscape rotates the axes and beta wrapping does not jump across 180 degrees', () => {
  const portrait = clockTilt(80, 0, 60, 0)
  const landscape = clockTilt(80, 0, 60, 0, 90)
  assert.ok(Math.abs(portrait.x + 4.4) < 1e-8)
  assert.ok(Math.abs(landscape.x) < 1e-8)
  assert.ok(Math.abs(landscape.y - 4.4) < 1e-8)
  assert.ok(Math.abs(clockTilt(-179, 0, 179, 0).x + .44) < 1e-8)
})

test('invalid sensor samples never create invalid CSS angles', () => {
  assert.deepEqual(clockTilt(NaN, 0, 0, 0), { x: 0, y: 0 })
  assert.deepEqual(clockTilt(0, Infinity, 0, 0), { x: 0, y: 0 })
})
