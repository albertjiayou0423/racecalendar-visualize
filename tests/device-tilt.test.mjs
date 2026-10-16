import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'
import { clockTilt, smoothClockTilt } from '../lib/clock-parallax.ts'

function harness(requestPermission) {
  const winEvents = new Map(), docEvents = new Map(), frames = new Map()
  let id = 0
  const emitter = events => ({
    addEventListener(name, handler) { if (!events.has(name)) events.set(name, new Set()); events.get(name).add(handler) },
    removeEventListener(name, handler) { events.get(name)?.delete(handler) },
  })
  const document = { ...emitter(docEvents), hidden: false }
  const window = { ...emitter(winEvents), screen: { orientation: { angle: 0 } }, DeviceOrientationEvent: requestPermission ? { requestPermission } : {} }
  const exports = {}
  vm.runInNewContext(ts.transpileModule(fs.readFileSync('lib/device-tilt.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, {
    exports, document, window, require: () => ({ clockTilt, smoothClockTilt }),
    requestAnimationFrame(fn) { frames.set(++id, fn); return id }, cancelAnimationFrame(key) { frames.delete(key) },
  })
  const dispatch = (events, name, event = {}) => { for (const listener of [...events.get(name) ?? []]) listener(event) }
  return { subscribe: exports.subscribeDeviceTilt, frames, count: name => winEvents.get(name)?.size ?? 0,
    sample(beta, gamma) { dispatch(winEvents, 'deviceorientation', { beta, gamma }) },
    tap() { dispatch(docEvents, 'pointerup') },
    visible(value) { document.hidden = !value; dispatch(docEvents, 'visibilitychange') },
    step(now) { const pending = [...frames.values()]; frames.clear(); for (const fn of pending) fn(now) },
  }
}

test('all fixtures share one sensor stream, stop in background, and clean up on last unmount', () => {
  const h = harness(), a = [], b = []
  const offA = h.subscribe(pose => a.push(pose)), offB = h.subscribe(pose => b.push(pose))
  assert.equal(h.count('deviceorientation'), 1)
  h.sample(60, 0); h.sample(80, 20); h.step(16); h.step(32)
  assert.ok(a.at(-1).x < 0 && a.at(-1).y > 0)
  assert.equal(a.at(-1), b.at(-1))
  h.visible(false)
  assert.equal(h.count('deviceorientation'), 0)
  assert.equal(h.frames.size, 0)
  h.visible(true)
  assert.equal(h.count('deviceorientation'), 1)
  offA(); assert.equal(h.count('deviceorientation'), 1)
  offB(); assert.equal(h.count('deviceorientation'), 0)
  assert.equal(h.count('orientationchange'), 0)
})

test('permission-gated sensors request once on first gesture and respect denial', async () => {
  let calls = 0
  const h = harness(async () => { calls++; return 'denied' })
  const offA = h.subscribe(() => {}), offB = h.subscribe(() => {})
  assert.equal(calls, 0)
  assert.equal(h.count('deviceorientation'), 0)
  h.tap(); h.tap(); await Promise.resolve(); await Promise.resolve()
  assert.equal(calls, 1)
  assert.equal(h.count('deviceorientation'), 0)
  offA(); offB()
})

test('granted first-gesture permission starts the shared sensor stream', async () => {
  const h = harness(async () => 'granted')
  const off = h.subscribe(() => {})
  h.tap(); await Promise.resolve(); await Promise.resolve()
  assert.equal(h.count('deviceorientation'), 1)
  off()
})
