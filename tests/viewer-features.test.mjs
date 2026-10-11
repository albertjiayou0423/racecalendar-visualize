import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import path from 'node:path'
import ts from 'typescript'
import { createRequire } from 'node:module'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
const require = createRequire(import.meta.url)
function load(file, mocks = {}, cache = new Map()) {
  const absolute = path.resolve(file)
  if (cache.has(absolute)) return cache.get(absolute)
  const exports = {}; cache.set(absolute, exports)
  const source = ts.transpileModule(fs.readFileSync(absolute, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText
  vm.runInNewContext(source, { exports, Date, Map, Set, TextEncoder, URL, URLSearchParams, Request, Response, console,
    require: name => name in mocks ? mocks[name] : name.startsWith('.') ? load(path.join(path.dirname(absolute), name + '.ts'), mocks, cache) : require(name),
  })
  return exports
}
const { weekendRange, weekendSessions } = load('lib/weekend.ts')
const { buildSubscriptionCalendar } = load('lib/subscription-calendar.ts')
const { observeSessions, compareSchedules } = load('lib/schedule-changes.ts')
const { weekendShareSvg, SHARE_ROWS_PER_PAGE } = load('lib/weekend-share.ts')
const event = (id = 'f1-2026-17', series = 'F1') => ({ id, series, round: 17, name: '测试,大奖赛;\n下一行', circuit: '赛道', locality: '城市', sessions: [{ name: '练习', utc: '2026-10-09T08:00:00Z' }, { name: '正赛', utc: '2026-10-11T12:00:00Z', isMain: true }] })
test('Beijing weekend spans Fri midnight through Mon exclusive, including UTC Thursday', () => {
  const range = weekendRange(Date.parse('2026-10-08T16:01:00Z'))
  assert.equal(new Date(range.start).toISOString(), '2026-10-08T16:00:00.000Z')
  assert.equal(new Date(range.end).toISOString(), '2026-10-11T16:00:00.000Z')
  assert.equal(weekendRange(Date.parse('2026-10-11T15:59:00Z')).start, range.start)
  assert.equal(weekendRange(Date.parse('2026-10-11T16:00:00Z')).start, range.start + 7 * 86400000)
})
test('weekend navigation crosses years and preserves exclusive end', () => {
  const range = weekendRange(Date.parse('2026-12-31T12:00:00Z'), 1)
  assert.equal(new Date(range.start).toISOString(), '2027-01-07T16:00:00.000Z')
  const e = event(); e.sessions = [{ name: '边界', utc: new Date(range.end).toISOString() }]
  assert.equal(weekendSessions([e], Date.parse('2026-12-31T12:00:00Z'), ['F1'], 1).length, 0)
})
test('weekend includes followed series, all sessions, sorts and rejects invalid dates', () => {
  const e = event(); e.sessions.reverse(); e.sessions.push({ name: 'bad', utc: 'invalid' })
  const rows = weekendSessions([e, event('fe', 'FE')], Date.parse('2026-10-10T00:00:00Z'), ['F1'])
  assert.equal(rows.length, 2); assert.equal(rows[0].session.name, '练习')
  assert.equal(weekendSessions([e], Date.now(), []).length, 0)
})
test('conflicts span different events and exclude estimated sessions', () => {
  const a = event(), b = event('fe', 'FE'), c = event('wrc', 'WRC')
  b.sessions = [{ name: '正赛', utc: '2026-10-11T13:00:00Z', isMain: true }]
  c.tentative = true
  const rows = weekendSessions([a, b, c], Date.parse('2026-10-11T00:00:00Z'), ['F1', 'FE', 'WRC'])
  assert.equal(rows.find(row => row.event.id === a.id && row.session.isMain).conflicts.length, 1)
  assert.ok(rows.filter(row => row.estimated).every(row => !row.conflicts.length))
})
test('subscriptions separate main/all, exclude estimates and malformed timestamps', () => {
  const e = event(), wrc = event('wrc', 'WRC'); wrc.tentative = true
  const modified = new Date('2026-10-10T00:00:00Z')
  assert.equal((buildSubscriptionCalendar([e, wrc], false, modified).match(/BEGIN:VEVENT/g) || []).length, 1)
  assert.equal((buildSubscriptionCalendar([e], true, modified).match(/BEGIN:VEVENT/g) || []).length, 2)
  e.sessions[0].tentative = true; e.sessions[1].utc = 'invalid'
  assert.equal((buildSubscriptionCalendar([e], true, modified).match(/BEGIN:VEVENT/g) || []).length, 0)
})
test('subscription UID survives UTC corrections; Unicode lines fold and escape', () => {
  const e = event(); e.name += '中文'.repeat(100)
  const before = buildSubscriptionCalendar([e], true, new Date('2026-10-10T00:00:00Z'))
  e.sessions[0].utc = '2026-10-09T09:00:00Z'
  const after = buildSubscriptionCalendar([e], true, new Date('2026-10-11T00:00:00Z'))
  assert.deepEqual(before.match(/UID:.*/g), after.match(/UID:.*/g))
  assert.ok(before.includes('测试\\,大奖赛\\;\\n下一行'))
  assert.ok(before.split('\r\n').every(line => Buffer.byteLength(line) <= 75))
  assert.ok(after.includes('LAST-MODIFIED:20261011T000000Z'))
})
test('subscription route applies manual overrides without crawling and fails closed on missing series', async () => {
  let missing = false, writes = 0
  const route = load('app/api/calendar/subscribe/route.ts', {
    'next/server': { NextResponse: class extends Response { static json(body, options) { return Response.json(body, options) } } },
    '@/lib/crawl-store': { initCrawlTables: async () => {}, getLatestSnapshot: async () => missing ? null : { fetchedAt: '2026-10-10T00:00:00Z', data: { events: [event()] } }, getAllOverrides: async () => [{ eventId: 'f1-2026-17', data: { name: '人工修正' }, updatedAt: '2026-10-11T00:00:00Z' }], saveSnapshot: () => writes++ },
    '@/lib/f1-metadata': { normalizeF1Metadata: e => e }, '@/lib/subscription-calendar': { buildSubscriptionCalendar },
  })
  let response = await route.GET(new Request('https://test/api/calendar/subscribe?series=F1'))
  assert.equal(response.status, 200); assert.match(await response.text(), /人工修正/); assert.equal(writes, 0)
  missing = true; response = await route.GET(new Request('https://test/api/calendar/subscribe?series=F1'))
  assert.equal(response.status, 503); assert.equal(response.headers.get('Cache-Control'), 'no-store')
  assert.equal((await route.GET(new Request('https://test/api/calendar/subscribe?series=invalid'))).status, 400)
})
test('spoiler gate never renders protected child before preferences hydrate', () => {
  const { SpoilerGate } = load('components/viewer-preferences.tsx', { '@/lib/types': {} })
  const html = renderToStaticMarkup(React.createElement(SpoilerGate, { label: '测试赛果' }, React.createElement('span', null, 'SECRET_WINNER')))
  assert.ok(!html.includes('SECRET_WINNER')); assert.ok(html.includes('测试赛果已收起'))
})
test('changes compare stable sessions across reorder and normalize equivalent UTC', () => {
  const e = event(); const previous = { sessions: observeSessions([e]) }
  e.sessions.reverse(); e.sessions[0].utc = '2026-10-11T12:00:00.000Z'
  assert.equal(compareSchedules(observeSessions([e]), previous).length, 0)
  e.sessions[0].utc = '2026-10-11T13:00:00Z'
  const changes = compareSchedules(observeSessions([e]), previous)
  assert.equal(changes.length, 1); assert.equal(changes[0].before, '2026-10-11T12:00:00.000Z'); assert.equal(changes[0].after, '2026-10-11T13:00:00.000Z')
})
test('changes never expose estimated time and reject malformed history', () => {
  const e = event('wrc', 'WRC'); e.tentative = true
  const sessions = observeSessions([e]); assert.ok(sessions.every(s => s.time === '时间待确认'))
  e.sessions[1].tentative = false
  const changes = compareSchedules(observeSessions([e]), { sessions, changes: [null, {}, 4] })
  assert.equal(changes.length, 1); assert.equal(changes[0].before, '时间待确认')
  assert.equal(compareSchedules(sessions, null).length, 0)
})
test('share pages include every row without inventing times and escape names', () => {
  const e = event(); e.name = '<script>&unsafe'
  e.sessions = Array.from({ length: 19 }, (_, i) => ({ name: `SS${i + 1}`, utc: '2026-10-10T08:00:00Z', tentative: true }))
  const rows = weekendSessions([e], Date.parse('2026-10-10T00:00:00Z'), ['F1'])
  const svg = Array.from({ length: Math.ceil(rows.length / SHARE_ROWS_PER_PAGE) }, (_, page) => weekendShareSvg(rows, '10/9 — 10/11', page)).join('')
  assert.equal((svg.match(/待确认/g) || []).length, rows.length + 3)
  assert.ok(svg.includes('SS19')); assert.ok(!svg.includes('<script>')); assert.ok(svg.includes('&lt;script&gt;'))
  assert.ok(!svg.includes('16:00')); assert.ok(svg.includes('width="1080" height="1440"'))
})
