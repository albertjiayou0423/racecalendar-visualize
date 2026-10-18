import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'
import test from 'node:test'

test('legacy browser timeout works without AbortSignal static helpers and forwards cancellation', async () => {
  const exports = {}
  const code = ts.transpileModule(fs.readFileSync('lib/browser-abort.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText
  vm.runInNewContext(code, { exports, AbortController, DOMException, setTimeout, clearTimeout })
  const signal = exports.browserTimeoutSignal(5)
  await new Promise(resolve => setTimeout(resolve, 15))
  assert.equal(signal.aborted, true)
  assert.equal(signal.reason.name, 'TimeoutError')
  const parent = new AbortController()
  const child = exports.browserTimeoutSignal(10000, parent.signal)
  parent.abort('page-hidden')
  assert.equal(child.aborted, true)
  assert.equal(child.reason, 'page-hidden')
  assert.equal(exports.browserTimeoutSignal(10000, parent.signal).aborted, true)
})

test('modal focus works in WebViews without checkVisibility and skips closed details', () => {
  const exports = {}
  let effect
  let focused = false
  const hiddenDetails = { tagName: 'DETAILS', hasAttribute: () => false, querySelector: () => ({ contains: () => false }), parentElement: null }
  const hidden = { getClientRects: () => [{}], parentElement: hiddenDetails, matches: () => false, focus: () => assert.fail('closed details must not receive focus') }
  const visible = { getClientRects: () => [{}], parentElement: null, matches: () => false, focus: () => { focused = true } }
  const container = { tabIndex: -1, querySelectorAll: () => [hidden, visible], addEventListener() {}, removeEventListener() {} }
  const code = ts.transpileModule(fs.readFileSync('lib/use-focus-trap.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText
  vm.runInNewContext(code, { exports, require: () => ({ useEffect: work => { effect = work } }), document: { activeElement: null } })
  exports.useFocusTrap({ current: container }, true)
  const cleanup = effect()
  assert.equal(focused, true)
  cleanup()
})
