import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'

function load(file, modules) {
  const output = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
  const exports = {}
  vm.runInNewContext(output, { exports, URL, require: name => modules[name] }, { filename: file })
  return exports
}
const tz = {
  zonedWallTimeToUtc: (year, month, day, hour, minute) => new Date(Date.UTC(year, month - 1, day, hour, minute)),
  COUNTRY_MAP: { Australia: { zh: '澳大利亚', code: 'AU' } },
  COUNTRY_CODE_MAP: {},
  F1_CIRCUIT_TZ: { australia: 'Australia/Melbourne' },
}
const fallback = load('lib/official-calendar-fallback.ts', { './tz': tz })
const scrapers = load('lib/official-calendar-scrapers.ts', { './tz': tz, './types': {} })

test('annual fallback covers the full announced 2027 F1, WRC and FE rounds with tentative times', () => {
  const result = fallback.addOfficialCalendarFallbacks([], 2027)
  assert.deepEqual({ ...result.added }, { F1: 24, WRC: 14, FE: 19 })
  assert.equal(result.events.length, 57)
  assert.ok(result.events.every(event => event.sessions.length > 0 && event.sessions.every(session => session.tentative)))
  assert.ok(result.events.every(event => event.sessions[0].utc.startsWith('2027-')))
})

test('official F1 calendar parser extracts round, date and event identity without a key', () => {
  const html = '<a href="/en/racing/2028/australia"><b>ROUND 1</b><p>Australia</p><svg><title>Flag of Australia</title></svg><span>FORMULA 1 AUSTRALIAN GRAND PRIX 2028</span><span>03 - 05 Mar</span></a>'
  const [event] = scrapers.parseOfficialF1Calendar(html, 2028)
  assert.equal(event.id, 'f1-2028-1')
  assert.equal(event.round, 1)
  assert.equal(event.sessions[0].utc.slice(0, 10), '2028-03-05')
  assert.equal(event.sessions[0].tentative, true)
  assert.equal(event.country, '澳大利亚')
  assert.equal(event.tz, 'Australia/Melbourne')
})

test('official Formula E parser handles cross-year season rounds and published dates', () => {
  const html = '<article data-testid="round-card"><span aria-label="16 January 2027"></span><h3>Mexico City</h3><p>R03 · 16 January 2027</p></article>'
  const [event] = scrapers.parseOfficialFeCalendar(html)
  assert.equal(event.id, 'fe-2027-3')
  assert.equal(event.sessions[0].utc.slice(0, 10), '2027-01-16')
  assert.equal(event.tz, 'America/Mexico_City')
})

test('official calendar fills missing rounds but keeps detailed API sessions and stable IDs', () => {
  const detailed = { id: 'fe-api-abc', series: 'FE', round: 3, name: 'API title', circuit: 'API circuit', locality: 'Mexico City', country: 'Mexico', tz: 'UTC', sessions: [{ name: 'Race', utc: '2027-01-16T20:00:00Z', isMain: true }] }
  const dateOnly = { ...detailed, id: 'fe-2027-3', tz: 'America/Mexico_City', sessions: [{ name: 'Race date', utc: '2027-01-17T05:59:00Z', isMain: true, tentative: true }] }
  const missing = { ...dateOnly, round: 4, id: 'fe-2027-4' }
  const merged = scrapers.mergeCalendarEvents([detailed], [dateOnly, missing], [2027])
  assert.equal(merged.length, 2)
  assert.equal(merged[0].id, 'fe-api-abc')
  assert.equal(merged[0].sessions[0].tentative, undefined)
  assert.equal(merged[1].id, 'fe-2027-4')
})
