import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'
import { createRequire } from 'node:module'
import * as guide from '../lib/usage-guide.ts'
const require = createRequire(import.meta.url)
const source = ts.transpileModule(fs.readFileSync('components/usage-guide.tsx', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
}).outputText

function mount(storage = new Map(), pathname = '/') {
  const state = [], effects = [], timers = [], listeners = new Map()
  let cursor = 0
  const exports = {}
  const window = { addEventListener: (key, callback) => listeners.set(key, callback), removeEventListener: key => listeners.delete(key),
    setTimeout: callback => { timers.push(callback); return timers.length }, clearTimeout() {},
    dispatchEvent: event => listeners.get(event.type)?.(),
  }
  vm.runInNewContext(source, { exports, window, Event,
    localStorage: { getItem: key => storage.get(key), setItem: (key, value) => storage.set(key, value) },
    require: name => name === 'react' ? {
      useState: initial => { const index = cursor++; if (!(index in state)) state[index] = initial; return [state[index], value => { state[index] = value }] },
      useRef: () => ({ current: null }), useCallback: callback => callback, useEffect: work => effects.push(work),
    } : name === '@/lib/usage-guide' ? guide : name === 'next/navigation' ? { usePathname: () => pathname }
      : name === 'lucide-react' ? { BookOpen: () => null, X: () => null } : require(name),
  })
  cursor = 0
  const tree = exports.UsageGuide()
  for (const effect of effects.splice(0)) effect()
  return { state, timers, storage, tree, reopen: () => exports.UsageGuideButton().props.onClick(),
    render: () => { cursor = 0; return exports.UsageGuide() } }
}

test('first visit opens once, closing persists completion, and capsule can reopen it', () => {
  const guide = mount()
  assert.equal(guide.timers.length, 1)
  guide.timers[0]()
  assert.equal(guide.state[0], true)
  const dialog = guide.render().props.children[1]
  dialog.props.onCancel()
  assert.equal(guide.state[0], false)
  const returnVisit = mount(guide.storage)
  assert.equal(returnVisit.timers.length, 0)
  assert.equal(returnVisit.state[0], false)
  returnVisit.reopen()
  assert.equal(returnVisit.state[0], true)
  assert.equal(returnVisit.state[1], 0)
})

test('public deep links receive the guide but admin pages do not auto-open it', () => {
  assert.equal(mount(new Map(), '/event/wrc-2026-1').timers.length, 1)
  const admin = mount(new Map(), '/admin')
  assert.equal(admin.timers.length, 0)
  assert.equal(admin.tree.props.children[0], false)
})

test('each public page has its own element targets and manual reopening starts the local tour', () => {
  const home = guide.getGuideSteps('/')
  assert.equal(home[0].selector, '#search-input')
  for (const page of ['/event/fixture', '/results', '/standings', '/wallpaper', '/circuits', '/about']) {
    const steps = guide.getGuideSteps(page)
    assert.ok(steps.length >= 2)
    assert.equal(steps.at(-1).selector, '[data-guide="usage-launcher"]')
    assert.notEqual(steps[0].selector, home[0].selector)
    const mounted = mount(new Map([['racecalendar:usage-guide-seen', '1']]), page)
    mounted.reopen()
    assert.equal(mounted.state[0], true)
    assert.equal(mounted.state[1], 0)
  }
})

test('guide panel stays within desktop and mobile viewports and moves above bottom targets', () => {
  for (const viewport of [{ width: 390, height: 700 }, { width: 1280, height: 800 }, { width: 320, height: 240 }]) {
    for (const rect of [null, { top: 24, left: 0, width: 120, height: 40 }, { top: viewport.height - 60, left: viewport.width - 140, width: 120, height: 40 }]) {
      const position = guide.guidePanelPosition(rect, viewport, 220)
      assert.ok(position.left >= 0)
      assert.ok(position.top >= 0)
      assert.ok(position.left + position.width <= viewport.width)
      assert.ok(position.top + Math.min(220, position.maxHeight) <= viewport.height)
      if (rect && rect.top > 400) assert.ok(position.top + 220 < rect.top)
    }
  }
})
