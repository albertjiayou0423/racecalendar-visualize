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
    if (seconds <= 60) assert.match(html, new RegExp(`倒计时 ${seconds} 秒`))
    else assert.doesNotMatch(html, /倒计时/)
    assert.match(html, /23:59:59/)
    assert.match(html, /当地时间/)
    assert.match(html, /title="Asia\/Shanghai"/)
    assert.doesNotMatch(html, /<small|<time|rally-timer/)
    assert.doesNotMatch(html, /NaN|undefined|赛程时间已到/)
  }
})

test('countdown appears at sixty seconds with two digits and never moves either clock', () => {
  const variants = [120, 61, 60, 59, 9, 0].map(seconds => render({ seconds, started: seconds === 0 }))
  const boxes = variants.map(html => html.match(/viewBox="([^"]+)"/)[1])
  assert.equal(new Set(boxes).size, 1)
  for (let index = 0; index < variants.length; index++) {
    const html = variants[index]
    const count = (html.match(/data-digit=/g) ?? []).length
    assert.equal(count, index < 2 ? 6 : 8)
    assert.doesNotMatch(html, /width:\d+%|<polygon/)
  }
  const starts = variants.slice(2).map(html => html.match(/class="rally-countdown-digits"><g[^>]*transform="([^"]+)"/)[1])
  assert.equal(new Set(starts).size, 1)
})

test('rally release clearly means scheduled time reached, without claiming live car telemetry', () => {
  const html = render({ seconds: 0, started: true })
  assert.match(html, /赛程时间已到/)
  assert.match(html, /role="img"/)
  assert.doesNotMatch(html, /距赛段首车出发|倒计时单位|NaN|undefined/)
})

test('every digit is exactly thirteen squares arranged in rows of 3, 2, 3, 2, 3', () => {
  const html = render({ seconds: 8, started: false })
  const digits = [...html.matchAll(/<g[^>]*data-digit="(\d)"[^>]*>(.*?)<\/g>/g)]
  assert.equal(digits.length, 8)
  for (const [, digit, body] of digits) {
    const squares = [...body.matchAll(/<rect[^>]* y="(\d+)"[^>]* width="6" height="6"/g)]
    assert.equal(squares.length, 13)
    assert.deepEqual([0, 6, 12, 18, 24].map(y => squares.filter(square => Number(square[1]) === y).length), [3, 2, 3, 2, 3])
    if (digit === '8') assert.equal((body.match(/fill="currentColor"/g) ?? []).length, 13)
  }
  assert.doesNotMatch(html, /<polygon/)
  assert.doesNotMatch(html, /fill="#[0-9a-f]+"/)
  assert.match(html, /fill="none"/)
})
