import test from 'node:test'
import assert from 'node:assert/strict'
import { clockTilt, smoothClockTilt } from '../lib/clock-parallax.ts'

test('initial holding angle is neutral and tilt stays bounded under large movement', () => {
  const neutral = clockTilt(60, -15, 60, -15)
  assert.equal(Math.abs(neutral.x), 0)
  assert.equal(Math.abs(neutral.y), 0)
  const far = clockTilt(150, 80, 60, -15)
  assert.equal(far.x, 5)
  assert.equal(far.y, -6)
})

test('landscape rotates the axes and beta wrapping does not jump across 180 degrees', () => {
  const portrait = clockTilt(80, 0, 60, 0)
  const landscape = clockTilt(80, 0, 60, 0, 90)
  assert.ok(Math.abs(portrait.x - 4.4) < 1e-8)
  assert.ok(Math.abs(landscape.x) < 1e-8)
  assert.ok(Math.abs(landscape.y + 4.4) < 1e-8)
  assert.ok(Math.abs(clockTilt(-179, 0, 179, 0).x - .44) < 1e-8)
})

test('viewer-facing display counter-rotates each screen axis in all four orientations', () => {
  for (const angle of [0, 90, 180, 270, -90]) {
    const radians = angle * Math.PI / 180
    // Rotate a pure screen-axis movement back into sensor beta/gamma.
    for (const direction of [-1, 1]) {
      const vertical = clockTilt(60 + direction * 10 * Math.cos(radians), -direction * 10 * Math.sin(radians), 60, 0, angle)
      const horizontal = clockTilt(60 + direction * 10 * Math.sin(radians), direction * 10 * Math.cos(radians), 60, 0, angle)
      assert.ok(Math.abs(vertical.x - direction * 2.2) < 1e-8)
      assert.ok(Math.abs(vertical.y) < 1e-8)
      assert.ok(Math.abs(horizontal.x) < 1e-8)
      assert.ok(Math.abs(horizontal.y + direction * 2.2) < 1e-8)
    }
  }
})

test('invalid sensor samples never create invalid CSS angles', () => {
  assert.deepEqual(clockTilt(NaN, 0, 0, 0), { x: 0, y: 0 })
  assert.deepEqual(clockTilt(0, Infinity, 0, 0), { x: 0, y: 0 })
})

test('damping has the same response at 60Hz and 120Hz without overshoot', () => {
  function run(hz) {
    let pose = { x: 0, y: 0 }
    for (let i = 0; i < hz / 5; i++) pose = smoothClockTilt(pose, { x: 5, y: -6 }, 1000 / hz)
    return pose
  }
  const a = run(60), b = run(120)
  assert.ok(Math.abs(a.x - b.x) < 1e-6)
  assert.ok(Math.abs(a.y - b.y) < 1e-6)
  assert.ok(a.x > 0 && a.x < 5 && a.y < 0 && a.y > -6)
  assert.ok(smoothClockTilt({ x: 0, y: 0 }, { x: 5, y: 6 }, 5000).x < 2)
})
