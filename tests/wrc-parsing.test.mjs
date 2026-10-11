import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'
import * as timezone from '../lib/tz.ts'
const source = ts.transpileModule(fs.readFileSync('lib/wrc-puppeteer.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText
const exports = {}
vm.runInNewContext(source + '\nexports.convert = convertDaysToSessions; exports.date = parseDateText;', {
  exports, require: name => name === './tz' ? timezone : {}, process: { env: {} }, console: { log() {}, error() {} },
})
const stage = (time, name = 'SS1') => ({ time, name, isPowerStage: false })
test('official itinerary rejects rollover dates, invalid hours and minutes, and empty labels', () => {
  const sessions = exports.convert([
    { date: [2026, 2, 29], stages: [stage('09:00')] },
    { date: [2026, 1, 32], stages: [stage('09:00')] },
    { date: [2026, 3, 1], stages: [stage('25:61'), stage('24:00'), stage('09:60'), stage('9:00'), stage('09:00'), stage('10:00', '')] },
  ], 'UTC', 'fixture')
  assert.equal(sessions.length, 1)
  assert.equal(sessions[0].utc, '2026-03-01T09:00:00.000Z')
  assert.equal(sessions[0].tentative, false)
})
test('unknown FAQ dates are discarded instead of becoming confirmed rally start times', () => {
  const date = exports.date('To be confirmed', '2026-01-01')
  assert.equal(exports.convert([{ date, stages: [stage('09:00')] }], 'UTC', 'fixture').length, 0)
  assert.equal(exports.date('Friday, 23 January', '2026-01-22')[2], 23)
})
test('valid leap dates and European summer-time conversion remain supported', () => {
  const leap = exports.convert([{ date: [2024, 2, 29], stages: [stage('09:00')] }], 'UTC', 'fixture')
  assert.equal(leap[0].utc, '2024-02-29T09:00:00.000Z')
  const summer = exports.convert([{ date: [2026, 7, 10], stages: [stage('09:00')] }], 'Europe/Helsinki', 'fixture')
  assert.equal(summer[0].utc, '2026-07-10T06:00:00.000Z')
})
