import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import { createRequire } from 'node:module'
import ts from 'typescript'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

const exports = {}
vm.runInNewContext(ts.transpileModule(fs.readFileSync('components/start-clock.tsx', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
}).outputText, { exports, require: createRequire(import.meta.url) })
const render = props => renderToStaticMarkup(React.createElement(exports.StartClock, {
  now: Date.parse('2026-10-15T15:59:59Z'), timeZone: 'Asia/Shanghai', ...props,
}))

test('rally countdown retains an accessible duration and explicit clock timezone across minute rollover', () => {
  for (const seconds of [61, 60, 59, 1]) {
    const html = render({ seconds, started: false })
    assert.match(html, new RegExp(`aria-label="倒计时 ${seconds} 秒"`))
    assert.match(html, /23:59:59/)
    assert.match(html, /当地时间/)
    assert.match(html, /title="Asia\/Shanghai"/)
    assert.match(html, seconds >= 60 ? /分钟 \/ 秒/ : />秒</)
    assert.doesNotMatch(html, /NaN|undefined|赛程时间已到/)
  }
})

test('rally release clearly means scheduled time reached, without claiming live car telemetry', () => {
  const html = render({ seconds: 0, started: true })
  assert.match(html, /aria-label="赛程时间已到"/)
  assert.match(html, /已到达计划发车时间/)
  assert.doesNotMatch(html, /距赛段首车出发|倒计时单位|NaN|undefined/)
})
