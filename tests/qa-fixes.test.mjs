import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'
import { fetchJolpicaResults } from '../lib/jolpica-results.ts'
import { fetchFeStandings, parseFeStandings, parseFeRaceResults, parseFeRounds, parseFeSeason } from '../lib/fe-results.ts'
import { beijingWeek, isoWeek, weekMonday } from '../lib/iso-week.ts'
import { normalizeF1Metadata, eventSourceLabel } from '../lib/f1-metadata.ts'
import { isTimeUnconfirmed } from '../lib/session-time.ts'

const race = (round, positions) => ({ season: '2026', round, Results: positions.map(position => ({ position })) })
test('result-row pagination merges split races and includes the final round', async () => {
  const pages = [[race('1', ['1', '2']), race('2', ['1'])], [race('2', ['2']), race('3', ['1', '2'])]]
  const offsets = []
  const results = await fetchJolpicaResults('2026', async url => {
    offsets.push(Number(new URL(url).searchParams.get('offset')))
    return Response.json({ MRData: { offset: offsets.at(-1), total: '6', RaceTable: { Races: pages[offsets.length - 1] } } })
  })
  assert.deepEqual(offsets, [0, 3])
  assert.deepEqual(results.map(race => [race.round, race.Results.length]), [['1', 2], ['2', 2], ['3', 2]])
})
test('incomplete or failed pagination cannot look like a complete season', async () => {
  await assert.rejects(fetchJolpicaResults('2026', async () => Response.json({ MRData: { offset: 0, total: 20, RaceTable: { Races: [] } } })), /提前结束/)
  let calls = 0
  await assert.rejects(fetchJolpicaResults('2026', async () => ++calls === 1 ? Response.json({ MRData: { offset: 0, total: 2, RaceTable: { Races: [race('1', ['1'])] } } }) : new Response('', { status: 503 })), /503/)
})
test('FE official markup separates championship totals from round points', () => {
  const drivers = parseFeStandings(fs.readFileSync('tests/fixtures/fe-standings.html', 'utf8'))
  assert.equal(drivers[0].name, 'Pascal Wehrlein')
  assert.equal(drivers[0].points, 169)
  assert.equal(drivers[0].code, 'pascal-wehrlein')
  const results = parseFeRaceResults(fs.readFileSync('tests/fixtures/fe-race.html', 'utf8'))
  assert.equal(results[0].driver, 'Taylor Barnard')
  assert.equal(results[0].points, 25)
  assert.equal(results.length, 2)
  const unclassified = fs.readFileSync('tests/fixtures/fe-race.html', 'utf8').replace('>1<span', '>—<span')
  assert.equal(parseFeRaceResults(unclassified)[0].position, '—')
  assert.throws(() => parseFeStandings('<html>unavailable</html>'), /未返回/)
})
test('download link stays connected and blob stays alive while the browser starts', () => {
  const output = ts.transpileModule(fs.readFileSync('lib/download.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText
  const exports = {}, revoked = [], timers = []
  let attached = false
  const link = { style: {}, click: () => assert.equal(attached, true), remove: () => { attached = false } }
  vm.runInNewContext(output, { exports, document: { createElement: () => link, body: { appendChild: () => { attached = true } } }, URL: { revokeObjectURL: url => revoked.push(url) }, setTimeout: (fn, delay) => timers.push({ fn, delay }) })
  exports.downloadFile('blob:calendar', 'race.ics', true)
  assert.equal(link.download, 'race.ics')
  assert.equal(attached, true)
  assert.deepEqual(revoked, [])
  assert.equal(timers[0].delay, 60000)
  timers[0].fn()
  assert.deepEqual(revoked, ['blob:calendar'])
  assert.equal(attached, false)
})
test('FE calendar reads split JSON frames without executing scripts', () => {
  const frame = 'a:' + JSON.stringify(['$', 'component', null, { rounds: [{ key: '1-sao-paulo', roundNum: 1, raceDate: '2025-12-06', location: 'São Paulo', countryCode: 'BR' }], selectedRound: '1-sao-paulo' }]) + '\n'
  const html = [frame.slice(0, 20), frame.slice(20)].map(part => '<script>self.__next_f.push(' + JSON.stringify([1, part]) + ')</script>').join('')
  assert.equal(parseFeRounds(html).rounds[0].date, '2025-12-06')
  assert.equal(parseFeRounds(html).selectedRound, '1-sao-paulo')
  assert.throws(() => parseFeRounds('<script>throw Error()</script>'), /未返回/)
})
test('FE historical season uses the selected option rather than stale SEO metadata', () => {
  const frame = 'a:' + JSON.stringify({ items: [{ id: '12', text: 'Season 12', active: false }, { id: '11', text: 'Season 11', active: true }] }) + '\n'
  const html = '<title>Season 12 - 2025-26</title><script>self.__next_f.push(' + JSON.stringify([1, frame]) + ')</script>'
  assert.equal(parseFeSeason(html), 11)
  assert.throws(() => parseFeSeason('<title>Season 12</title>'), /未返回/)
})
test('FE prediction roster requests and verifies the selected official season', async () => {
  const frame = 'a:' + JSON.stringify({ items: [{ id: '12', text: 'Season 12', active: true }] }) + '\n'
  const html = fs.readFileSync('tests/fixtures/fe-standings.html', 'utf8') + '<script>self.__next_f.push(' + JSON.stringify([1, frame]) + ')</script>'
  const originalFetch = globalThis.fetch
  let requestedUrl = ''
  globalThis.fetch = async (input) => {
    requestedUrl = String(input)
    return new Response(html, { status: 200 })
  }
  try {
    const drivers = await fetchFeStandings(12)
    assert.match(requestedUrl, /\?season=12&tab=drivers$/)
    assert.equal(drivers[0].code, 'pascal-wehrlein')
  } finally {
    globalThis.fetch = originalFetch
  }
})
test('Beijing ISO weeks handle Sunday UTC, New Year and week 53 navigation', () => {
  assert.deepEqual(beijingWeek(Date.parse('2026-10-11T16:01:00Z')), { y: 2026, w: 42 })
  assert.deepEqual(beijingWeek(Date.parse('2026-10-11T07:00:00Z')), { y: 2026, w: 41 })
  assert.deepEqual(isoWeek(new Date('2027-01-01T00:00:00Z')), { y: 2026, w: 53 })
  const monday = weekMonday({ y: 2026, w: 53 }); monday.setUTCDate(monday.getUTCDate() + 7)
  assert.deepEqual(isoWeek(monday), { y: 2027, w: 1 })
  assert.equal(weekMonday({ y: 2026, w: 1 }).toISOString().slice(0, 10), '2025-12-29')
})
test('old snapshots receive metadata fixes without changing IDs or sessions', () => {
  const event = { id: 'f1-2026-17', series: 'F1', name: 'Singapore Grand Prix', circuit: 'Marina Bay Street Circuit', sessions: [] }
  const corrected = normalizeF1Metadata(event)
  assert.equal(corrected.circuitInfo.length, '4.927 km')
  assert.equal(corrected.id, event.id)
  assert.equal(corrected.sessions, event.sessions)
  assert.equal(normalizeF1Metadata({ ...event, circuit: 'Las Vegas Strip Street Circuit', circuitType: 'permanent' }).circuitType, 'street')
  assert.equal(eventSourceLabel('https://en.wikipedia.org/wiki/Race'), '赛事百科')
})
test('calendar has UTC, stable UID, escaped text, UTF-8 folding and excludes estimates', () => {
  const output = ts.transpileModule(fs.readFileSync('lib/calendar.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
  const exports = {}
  vm.runInNewContext(output, { exports, require: () => ({ isTimeUnconfirmed }), TextEncoder, Date })
  const event = { id: 'f1-2026-17', series: 'F1', name: '赛事,分号;\n' + '中文'.repeat(50), circuit: 'Singapore', locality: 'Marina Bay', country: 'Singapore', round: 17, sessions: [{ isMain: true, utc: '2026-10-11T12:00:00Z', name: 'Race' }] }
  const ics = exports.buildRaceCalendar(event, new Date('2026-10-11T00:00:00Z'))
  assert.match(ics, /UID:f1-2026-17@racecalendar/)
  assert.match(ics, /DTSTART:20261011T120000Z/)
  assert.match(ics, /DTSTAMP:20261011T000000Z/)
  assert.match(ics.replace(/\r\n /g, ''), /赛事\\,分号\\;\\n/)
  assert.ok(ics.split('\r\n').every(line => Buffer.byteLength(line) <= 75))
  assert.equal(exports.buildRaceCalendar({ ...event, series: 'WRC', tentative: true }), null)
})
test('calendar export returns an attachment and rejects invalid dates or filename injection', async () => {
  const compilerOptions = { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
  const calendar = {}, route = {}
  vm.runInNewContext(ts.transpileModule(fs.readFileSync('lib/calendar.ts', 'utf8'), { compilerOptions }).outputText, { exports: calendar, require: () => ({ isTimeUnconfirmed }), TextEncoder, Date })
  vm.runInNewContext(ts.transpileModule(fs.readFileSync('app/api/calendar/route.ts', 'utf8'), { compilerOptions }).outputText, { exports: route, require: () => calendar, Response, Date })
  const url = new URL('https://example.com/api/calendar?id=f1-2026-17&series=F1&round=17&name=Singapore&utc=2026-10-11T12:00:00Z')
  const response = await route.GET({ nextUrl: url })
  assert.equal(response.status, 200)
  assert.equal(response.headers.get('Content-Disposition'), 'attachment; filename="f1-2026-17.ics"')
  assert.equal(response.headers.get('Cache-Control'), 'no-store')
  assert.match(await response.text(), /DTSTART:20261011T120000Z/)
  url.searchParams.set('utc', '2026-02-30T12:00:00Z')
  assert.equal((await route.GET({ nextUrl: url })).status, 400)
  url.searchParams.set('utc', '2026-10-11T12:00:00Z')
  url.searchParams.set('id', 'file"\r\nInjected: true')
  assert.equal((await route.GET({ nextUrl: url })).status, 400)
})
