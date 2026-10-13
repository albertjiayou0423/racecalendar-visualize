import test from 'node:test'
import assert from 'node:assert/strict'
import { isEstimatedWrcSession } from '../lib/session-time.ts'
test('WRC estimates honor event defaults and explicit confirmed sessions', () => {
  const session = { name: 'SS1', utc: '2026-01-01T09:00:00Z' }
  assert.equal(isEstimatedWrcSession({ series: 'WRC', tentative: true }, session), true)
  assert.equal(isEstimatedWrcSession({ series: 'WRC', tentative: true }, { ...session, tentative: false }), false)
  assert.equal(isEstimatedWrcSession({ series: 'WRC' }, { ...session, tentative: true }), true)
  assert.equal(isEstimatedWrcSession({ series: 'WRC' }, session), false)
  assert.equal(isEstimatedWrcSession({ series: 'F1', tentative: true }, session), false)
  assert.equal(isEstimatedWrcSession({ series: 'FE' }, { ...session, tentative: true }), false)
})

import fs from 'node:fs'
import vm from 'node:vm'
import { createRequire } from 'node:module'
import ts from 'typescript'
import { renderToStaticMarkup } from 'react-dom/server'
import React from 'react'
const require = createRequire(import.meta.url)
function timeline(event) {
  const source = ts.transpileModule(fs.readFileSync('components/session-timeline.tsx', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText
  const exports = {}
  vm.runInNewContext(source, {
    exports, require: name => name === '@/lib/session-time' ? { isEstimatedWrcSession }
      : name === '@/lib/format' ? { BEIJING_TZ: 'Asia/Shanghai', formatDateTime: () => 'CONFIRMED_TIME' }
      : name === '@/lib/utils' ? { cn: (...args) => args.filter(Boolean).join(' ') }
      : name === '@/components/weather-strip' ? { WeatherStrip: () => null } : require(name),
  })
  return renderToStaticMarkup(React.createElement(exports.SessionTimeline, { event, now: 0 }))
}
test('estimated WRC timeline hides precise times and countdowns while retaining confirmed sessions', () => {
  const session = { name: 'SS1', utc: '2026-01-01T09:00:00Z', tentative: true }
  const event = { series: 'WRC', tz: 'UTC', tentative: true, sessions: [session] }
  const estimated = timeline(event)
  assert.match(estimated, /时间待确认/)
  assert.doesNotMatch(estimated, /CONFIRMED_TIME|09:00|LIVE|秒后开始/)
  const mixed = timeline({ ...event, sessions: [session, { ...session, name: 'SS2', tentative: false }] })
  assert.match(mixed, /时间待确认/)
  assert.match(mixed, /CONFIRMED_TIME/)
})
