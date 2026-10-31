import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'
import { createRequire } from 'node:module'
import * as crawl from '../lib/client-crawl.ts'
import * as browserAbort from '../lib/browser-abort.ts'
import * as sessions from '../lib/admin-session.ts'
const require = createRequire(import.meta.url)
const next = require('next/server')
const fixture = { id: 'f1-2026-1', series: 'F1', round: 1, name: '服务器名称', circuit: '服务器赛道', locality: '城市', country: '国家', tz: 'UTC', sessions: [{ name: '正赛 (Race)', utc: '2026-03-08T05:00:00.000Z', isMain: true }] }
const raw = () => ({ MRData: { RaceTable: { season: '2026', Races: [{ season: '2026', round: '1', raceName: '不采用客户端名称', date: '2026-03-08', time: '05:00:00Z', FirstPractice: { date: '2026-03-06', time: '01:00:00Z' } }] } } })
const url = crawl.clientSourceUrl('F1', 2026)

test('client parser uses server identity and metadata, rejects wrong season, dates and unknown events', () => {
  const parsed = crawl.parseClientF1(raw(), [fixture], 2026)
  assert.equal(parsed[0].name, fixture.name)
  assert.equal(parsed[0].sessions.length, 2)
  assert.equal(parsed[0].sessions[0].utc, '2026-03-06T01:00:00.000Z')
  for (const mutate of [data => data.MRData.RaceTable.season = '2025', data => data.MRData.RaceTable.Races[0].round = '2', data => data.MRData.RaceTable.Races[0].time = '25:00:00Z', data => data.MRData.RaceTable.Races[0].date = '2026-09-08', data => data.MRData.RaceTable.Races.push(data.MRData.RaceTable.Races[0])]) {
    const data = raw(); mutate(data)
    assert.throws(() => crawl.parseClientF1(data, [fixture], 2026))
  }
})

test('automatic supplementation preserves every valid time including estimates and annotates only missing sessions', () => {
  const base = [{ ...fixture, sessions: [...fixture.sessions, { name: '第二次自由练习 (FP2)', utc: '2026-03-06T04:00:00Z', tentative: true }] }]
  const candidate = crawl.parseClientF1(raw(), base, 2026)
  candidate[0].sessions.find(session => session.isMain).utc = '2026-03-08T06:00:00Z'
  candidate[0].sessions.push({ name: '第二次自由练习 (FP2)', utc: '2026-03-06T07:00:00Z' })
  const merged = crawl.fillClientGaps(base, candidate, url, '2026-10-11T00:00:00Z')
  assert.equal(merged.filled, 1)
  assert.deepEqual(merged.events[0].sessions.find(session => session.isMain), fixture.sessions[0])
  assert.equal(merged.events[0].sessions.find(session => session.name.includes('FP2')).utc, '2026-03-06T04:00:00Z')
  const added = merged.events[0].sessions.find(session => session.name.includes('FP1'))
  assert.equal(added.tentative, true)
  assert.equal(added.clientUploadedAt, '2026-10-11T00:00:00Z')
  assert.deepEqual(merged.events[0].clientData.sessions, ['第一次自由练习 (FP1)'])
  assert.equal(base[0].sessions.length, 2)
  assert.equal(crawl.fillClientGaps(merged.events, candidate, url, '2026-10-12T00:00:00Z').filled, 0)
})

test('invalid existing UTC can be filled; duplicate WRC identities and unrelated event IDs are preserved', () => {
  const base = [{ ...fixture, series: 'WRC', id: 'wrc-2026-1', sessions: [{ name: 'SS1', utc: '' }, { name: 'SS2 A', utc: '' }, { name: 'SS2 B', utc: '' }] }]
  const candidate = [{ ...base[0], sessions: [{ name: 'SS1 示例', utc: '2026-01-22T12:00:00Z' }, { name: 'SS2', utc: '2026-01-22T13:00:00Z' }] }, { ...fixture, id: 'unknown' }]
  const result = crawl.fillClientGaps(base, candidate, 'https://www.wrc.com', '2026-10-11T00:00:00Z')
  assert.equal(result.filled, 1)
  assert.equal(result.events[0].sessions.length, 3)
  assert.equal(result.events[0].sessions.find(session => session.name === 'SS1').tentative, true)
  assert.equal(result.events[0].tentative, true)
})

test('browser fetch directly uses the allowlisted external source, omits credentials and bounds responses', async () => {
  const job = { id: 'fixture', token: 'fixture', series: 'F1', year: 2026, url }
  let received
  const body = await crawl.fetchClientCrawl(job, new AbortController().signal, async (target, options) => { received = { target, options }; return new Response(JSON.stringify(raw())) })
  assert.equal(JSON.parse(body).MRData.RaceTable.season, '2026')
  assert.equal(received.target, url)
  assert.equal(received.options.mode, 'cors')
  assert.equal(received.options.credentials, 'omit')
  await assert.rejects(() => crawl.fetchClientCrawl({ ...job, url: 'http://localhost/private' }, new AbortController().signal), /不允许/)
  await assert.rejects(() => crawl.fetchClientCrawl(job, new AbortController().signal, async () => { throw new Error('CORS') }))
  await assert.rejects(() => crawl.readLimitedText(new Response('123456'), 5), /过大/)
})

function evaluate(path, modules) {
  const source = ts.transpileModule(fs.readFileSync(path, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
  const exports = {}
  vm.runInNewContext(source, { exports, require: name => modules[name], URL, TextDecoder, Date, JSON, console })
  return exports
}
test('public upload requires same origin, configured database, bounded valid payload and one-use lease result', async () => {
  let calls = 0, database = true
  const route = evaluate('app/api/client-crawl/route.ts', { 'next/server': next, '@/lib/admin-session': sessions, '@/lib/db': { getSql: () => database ? {} : null }, '@/lib/client-crawl': crawl, '@/lib/client-crawl-store': {
    claimClientJobs: async () => { calls++; return [] }, submitClientJob: async () => { calls++; return { saved: false, status: 'expired-or-used', filled: 0 } },
  } }).POST
  const request = (input, origin = 'https://localhost') => new Request('https://localhost/api/client-crawl', { method: 'POST', headers: { origin, 'content-type': 'application/json' }, body: JSON.stringify(input) })
  assert.equal((await route(request({ action: 'claim' }, 'https://evil.example'))).status, 403)
  assert.equal(calls, 0)
  database = false
  assert.equal((await route(request({ action: 'claim' }))).status, 503)
  database = true
  assert.equal((await route(request({ action: 'submit', id: 'arbitrary', token: 'bad' }))).status, 400)
  assert.equal((await route(request({ action: 'submit', id: 'F1-1', token: 'a'.repeat(48), raw: 'x'.repeat(crawl.CLIENT_CRAWL_LIMIT) }))).status, 400)
  const replay = await route(request({ action: 'submit', id: 'F1-1', token: 'a'.repeat(48), raw: '{}' }))
  assert.equal((await replay.json()).published, false)
  assert.equal(calls, 1)
})

function storeHarness({ saveFails = false, superseded = false, quotaExhausted = false } = {}) {
  const records = new Map(), snapshots = [], queries = []
  const sql = async (strings, ...values) => {
    const query = strings.join('?'); queries.push(query)
    if (query.includes('pg_advisory_xact_lock')) return []
    if (query.includes('CREATE TABLE')) return []
    if (query.includes('INSERT INTO client_crawl_jobs')) {
      const [id, series, tokenHash, sourceUrl, eventId, expiresAt] = values
      if (records.has(id)) return []
      records.set(id, { id, series, tokenHash, sourceUrl, eventId, expiresAt, status: 'assigned' })
      return [{ id }]
    }
    if (query.includes("SET status = 'processing'")) {
      const [id, tokenHash] = values, job = records.get(id)
      if (!job || job.tokenHash !== tokenHash || job.status !== 'assigned' || Date.parse(job.expiresAt) < Date.now()) return []
      job.status = 'processing'
      return [{ id, series: job.series, event_id: job.eventId, source_url: job.sourceUrl }]
    }
    if (query.includes('WITH accepted')) {
      if (saveFails) throw new Error('database unavailable')
      if (superseded) return []
      const record = [...records.values()].find(record => record.status === 'processing')
      const data = values.map(value => { try { return JSON.parse(value) } catch { return null } }).find(value => value?.events)
      record.status = 'saved'; snapshots.push(data)
      return [{ id: 1 }]
    }
    if (query.includes('SET status = ?')) {
      const [status, id] = values
      const record = records.get(id)
      if (record?.status === 'processing') record.status = status
      return []
    }
    throw new Error(`Unexpected SQL: ${query}`)
  }
  sql.transaction = async (queries, options) => { assert.equal(options.isolationLevel, 'ReadCommitted'); return Promise.all(queries) }
  const store = evaluate('lib/client-crawl-store.ts', {
    'node:crypto': require('node:crypto'), './db': { getSql: () => sql }, './client-crawl': crawl,
    './crawl-store': { getLatestSnapshot: async series => series === 'F1' ? { data: { events: [fixture] }, fetchedAt: '2026-10-10T00:00:00Z' } : null, getCrawlQuota: async () => ({ used: quotaExhausted ? 10 : 0, limit: 10 }), initCrawlTables: async () => {} },
    './wrc-data': { buildWrcEvents: () => [] }, './wrc-puppeteer': { parseClientWrcFeed: () => [] },
  })
  return { store, records, snapshots, queries }
}
test('global lease is allocated once per three-hour bucket and valid gaps publish automatically with provenance', async () => {
  const harness = storeHarness()
  const jobs = await harness.store.claimClientJobs()
  assert.equal(jobs.length, 1)
  assert.equal((await harness.store.claimClientJobs()).length, 0)
  const result = await harness.store.submitClientJob({ ...jobs[0], raw: JSON.stringify(raw()) })
  assert.equal(result.saved, true)
  assert.equal(result.filled, 1)
  assert.equal(harness.snapshots.length, 1)
  assert.equal(harness.snapshots[0].events[0].clientData.sourceUrl, url)
  const replay = await harness.store.submitClientJob({ ...jobs[0], raw: JSON.stringify(raw()) })
  assert.equal(replay.status, 'expired-or-used')
  assert.equal(harness.snapshots.length, 1)
  assert.ok(harness.queries.some(query => query.includes('WITH accepted') && query.includes('INSERT INTO crawl_snapshots') && query.includes('INSERT INTO crawl_quota')))
  assert.ok(harness.queries.some(query => query.includes('pg_advisory_xact_lock')))
})
test('forged leases, failed upstreams, stale writes and database failures never report successful persistence', async () => {
  const harness = storeHarness()
  const [job] = await harness.store.claimClientJobs()
  assert.equal((await harness.store.submitClientJob({ ...job, token: 'b'.repeat(48), raw: '{}' })).status, 'expired-or-used')
  assert.equal((await harness.store.submitClientJob({ ...job, failed: true })).saved, false)
  assert.equal(harness.snapshots.length, 0)
  const stale = storeHarness({ superseded: true })
  const [oldJob] = await stale.store.claimClientJobs()
  assert.equal((await stale.store.submitClientJob({ ...oldJob, raw: JSON.stringify(raw()) })).status, 'superseded-or-quota')
  assert.equal(stale.snapshots.length, 0)
  const broken = storeHarness({ saveFails: true })
  const [brokenJob] = await broken.store.claimClientJobs()
  await assert.rejects(() => broken.store.submitClientJob({ ...brokenJob, raw: JSON.stringify(raw()) }))
  assert.equal(broken.snapshots.length, 0)
})
test('exhausted quota, expired leases, invalid JSON and unchanged data do not create new snapshots', async () => {
  assert.equal((await storeHarness({ quotaExhausted: true }).store.claimClientJobs()).length, 0)
  const expired = storeHarness()
  const [old] = await expired.store.claimClientJobs()
  expired.records.get(old.id).expiresAt = '2020-01-01T00:00:00Z'
  assert.equal((await expired.store.submitClientJob({ ...old, raw: '{}' })).status, 'expired-or-used')
  for (const [body, status] of [['not-json', 'invalid'], [JSON.stringify({ MRData: { RaceTable: { season: '2026', Races: [{ season: '2026', round: '1', date: '2026-03-08', time: '05:00:00Z' }] } } }), 'unchanged']]) {
    const harness = storeHarness(), [job] = await harness.store.claimClientJobs()
    assert.equal((await harness.store.submitClientJob({ ...job, raw: body })).status, status)
    assert.equal(harness.snapshots.length, 0)
  }
})

function browserHarness({ pathname = '/', hidden = false, saveData = false } = {}) {
  const timers = [], effects = [], calls = [], updates = [], storage = new Map()
  const job = { id: 'F1-1', token: 'a'.repeat(48), series: 'F1', year: 2026, url }
  const fetcher = async (target, options) => {
    calls.push({ target, options })
    if (target === url) return new Response(JSON.stringify(raw()))
    const input = JSON.parse(options.body)
    return new Response(JSON.stringify(input.action === 'claim' ? { jobs: [job] } : { saved: true }))
  }
  const source = ts.transpileModule(fs.readFileSync('components/client-crawl.tsx', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
  const exports = {}
  vm.runInNewContext(source, { exports, require: name => name === '@/lib/browser-abort' ? browserAbort : name === 'react' ? { useEffect: work => effects.push(work) } : name === 'next/navigation' ? { usePathname: () => pathname } : name === 'swr' ? { useSWRConfig: () => ({ mutate: key => updates.push(key) }) } : { ...crawl, fetchClientCrawl: (job, signal) => crawl.fetchClientCrawl(job, signal, fetcher) },
    window: { setTimeout: (work, delay) => { timers.push({ work, delay }); return timers.length }, clearTimeout() {}, addEventListener() {}, removeEventListener() {} },
    document: { hidden, addEventListener() {}, removeEventListener() {} }, navigator: { onLine: true, connection: { saveData } },
    localStorage: { getItem: key => storage.get(key), setItem: (key, value) => storage.set(key, value) },
    fetch: fetcher, AbortController, AbortSignal, Date, JSON,
  })
  exports.ClientCrawl()
  const cleanup = effects[0]()
  return { timers, calls, updates, cleanup }
}
test('client waits for first render, skips hidden/save-data/admin pages and refreshes schedule only after persistence', async () => {
  for (const options of [{ hidden: true }, { saveData: true }, { pathname: '/admin' }]) {
    const browser = browserHarness(options)
    if (browser.timers.length) await browser.timers[0].work()
    assert.equal(browser.calls.length, 0)
    browser.cleanup?.()
  }
  const browser = browserHarness()
  assert.equal(browser.timers[0].delay, 6000)
  await browser.timers[0].work()
  assert.equal(browser.calls.length, 3)
  assert.equal(browser.calls[1].target, url)
  assert.deepEqual(browser.updates, ['/api/schedule'])
  await browser.timers[0].work()
  assert.equal(browser.calls.length, 3)
  browser.cleanup()
})
