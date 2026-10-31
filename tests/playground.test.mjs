import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'
import { createRequire } from 'node:module'
import { playgroundData } from '../lib/playground-data.ts'
const require = createRequire(import.meta.url)
test('preview fixtures preserve valid UTC and known series, with isolated IDs and estimated WRC flags', () => {
  const now = Date.parse('2026-12-31T16:00:00Z')
  const normal = playgroundData('normal', now)
  assert.equal(normal.events.length, 3)
  assert.ok(normal.events.every(e => e.id.startsWith('playground-') && e.sessions.every(s => Number.isFinite(Date.parse(s.utc)))))
  const estimated = playgroundData('tentative', now).events.find(e => e.series === 'WRC')
  assert.equal(estimated.tentative, true)
  assert.ok(estimated.sessions.every(s => s.tentative))
  assert.deepEqual(playgroundData('empty', now).events, [])
  assert.equal(playgroundData('offline', now).offline, true)
  assert.ok(playgroundData('busy', now).events.every(e => e.sessions.length === 12))
})
test('real feedback form validates in preview without sending any HTTP request', async () => {
  const source = ts.transpileModule(fs.readFileSync('components/feedback-form.tsx', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText
  const exports = {}, updates = []
  let index = 0, calls = 0
  const values = ['bug', '测试反馈', '测试描述', '', false, 'idle', '']
  vm.runInNewContext(source, { exports, fetch: () => { calls++; throw Error('production request forbidden') }, require: name => name === 'react' ? { useState: () => { const i = index++; return [values[i], v => updates.push([i, v])] }, useRef: () => ({ current: null }), useEffect() {} } : name === './playground-context' ? { usePlayground: () => ({ scenario: 'normal' }) } : name === '@/lib/use-focus-trap' ? { useFocusTrap() {} } : name === '@/components/interface-motion' ? { useShake: () => () => {} } : name === '@/lib/utils' ? { cn: (...args) => args.join(' ') } : name === 'lucide-react' ? new Proxy({}, { get: () => () => null }) : require(name) })
  const tree = exports.FeedbackForm({ onClose() {} })
  const find = node => { if (!node || typeof node !== 'object') return; if (node.type === 'form') return node; for (const child of [node.props?.children].flat()) { const match = find(child); if (match) return match } }
  await find(tree).props.onSubmit({ preventDefault() {} })
  assert.equal(calls, 0)
  assert.ok(updates.some(([, value]) => String(value).includes('未提交任何反馈')))
})
