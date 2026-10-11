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
vm.runInNewContext(source + '\nexports.convert = convertDaysToSessions; exports.date = parseDateText; exports.cache = parseItineraryFromCache; exports.offset = itineraryUtcOffset;', {
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

test('invalid time in first feed candidate does not hide a valid later candidate', async () => {
  const context = { exports: {}, process: { env: {} }, console: { log() {}, error() {} },
    require: name => name === './tz' ? timezone : {} }
  vm.createContext(context)
  vm.runInContext(source + `
    fetchItineraryFromFeedApi = async slug => [{ date: [2026, 1, 1], stages: [{ name: 'SS1', time: slug === 'itinerary-fixture-2026' ? '25:61' : '09:00', isPowerStage: false }] }];
    exports.v2 = scrapeWrcItineraryV2;
  `, context)
  const sessions = await context.exports.v2('fixture-2026', 'UTC', '2026-01-01')
  assert.equal(sessions.length, 1)
  assert.equal(sessions[0].utc, '2026-01-01T09:00:00.000Z')
})

test('English ordinal dates and explicit years do not inherit the wrong rally year', () => {
  assert.deepEqual(Array.from(exports.date('Thursday 1st October 2026', '2025-12-31')), [2026, 10, 1])
  assert.deepEqual(Array.from(exports.date('Friday, 2 January 2027', '2026-12-31')), [2027, 1, 2])
  assert.deepEqual(Array.from(exports.date('2026-10-01', '2025-01-01')), [2026, 10, 1])
})
test('FAQ UTC and GMT offsets override rally timezone without double conversion', () => {
  const faq = title => ({ feed: { data: { data: { items: [{ type: 'faq', title, elements: [{
    question: [{ variant: 'text', text: 'Friday, 10 July 2026' }],
    answer: [{ type: 'list', items: [{ elements: [{ variant: 'text', text: '09:00: SS1' }] }] }],
  }] }] } } } })
  for (const [title, utc] of [
    ['Itinerary (UTC)', '2026-07-10T09:00:00.000Z'],
    ['Itinerary GMT+02:00', '2026-07-10T07:00:00.000Z'],
    ['Itinerary UTC-3', '2026-07-10T12:00:00.000Z'],
    ['Itinerary local time', '2026-07-10T06:00:00.000Z'],
  ]) {
    const days = exports.cache(faq(title), '2026-07-09')
    assert.equal(exports.convert(days, 'Europe/Helsinki', 'fixture')[0].utc, utc)
  }
  assert.equal(Number.isNaN(exports.offset('Itinerary UTC+25')), true)
  assert.equal(exports.convert(exports.cache(faq('Itinerary UTC+25'), '2026-07-09'), 'UTC', 'fixture').length, 0)
})
