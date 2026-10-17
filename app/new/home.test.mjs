import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'
import * as cacheApi from '../../lib/client-schedule-cache.ts'

const now = Date.parse('2026-10-17T10:00:00Z')
const session = (offset, extra = {}) => ({ name: '正赛', utc: new Date(now + offset).toISOString(), ...extra })
const event = (id, sessions, extra = {}) => ({ id, series: 'F1', sessions, ...extra })
const response = events => ({ events, sources: [{ series: 'F1', ok: true, label: '测试数据' }], fetchedAt: new Date(now).toISOString() })

function load(file, options = {}) {
  const storage = new Map(), exports = {}
  const localStorage = {
    getItem: key => { if (options.blocked) throw new Error('blocked'); return storage.get(key) ?? null },
    setItem: (key, value) => { if (options.blocked) throw new Error('blocked'); storage.set(key, value) },
  }
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(`app/new/${file}.ts`, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText,
    { exports, localStorage, AbortSignal, fetch: options.fetch, require: () => cacheApi })
  return { api: exports, storage }
}

test('home choice persists both directions and gracefully tolerates blocked storage', () => {
  const { api } = load('home-preference')
  assert.equal(api.readHomePreference(), null)
  api.saveHomePreference('new'); assert.equal(api.readHomePreference(), 'new')
  api.saveHomePreference('classic'); assert.equal(api.readHomePreference(), 'classic')
  const blocked = load('home-preference', { blocked: true }).api
  assert.doesNotThrow(() => blocked.saveHomePreference('new'))
  assert.equal(blocked.readHomePreference(), null)
})

test('hero finds the earliest confirmed session and excludes pending, client and invalid times', () => {
  const { api } = load('schedule')
  const confirmed = event('confirmed', [session(3600000), session(1800000)])
  const events = [event('estimated', [session(1000)], { tentative: true }), event('client', [session(2000, { clientUploadedAt: 'today' })]), event('invalid', [{ name: 'TBD', utc: 'invalid' }]), event('past', [session(-1000)]), confirmed]
  assert.equal(api.nextConfirmed(events, now).event.id, 'confirmed')
  assert.equal(api.nextConfirmed(events, now).session.utc, session(1800000).utc)
  assert.equal(api.nextConfirmed(events.slice(0, 4), now), undefined)
  assert.equal(api.confirmed(event('wrc', [], { tentative: true }), session(1000, { tentative: false })), true)
})

test('Beijing date strip respects midnight and upcoming sessions ignore unsorted past entries', () => {
  const { api } = load('schedule')
  assert.equal(api.beijingDay(Date.parse('2026-10-17T15:59:59Z')), '2026-10-17')
  assert.equal(api.beijingDay(Date.parse('2026-10-17T16:00:00Z')), '2026-10-18')
  assert.equal(api.upcomingSession(event('e', [session(4000), session(-1000), session(2000)]), now).utc, session(2000).utc)
})

test('fresh schedule persists and failed series reuses the last good cache with provenance', async () => {
  let payload = response([event('e', [session(3600000)])])
  const { api, storage } = load('schedule', { fetch: async () => ({ ok: true, json: async () => payload }) })
  assert.equal((await api.fetchNewHomeSchedule('/api/schedule')).events[0].id, 'e')
  assert.ok(storage.has('schedule-cache-v2'))
  payload = { ...payload, events: [], sources: [{ series: 'F1', ok: false, label: '不可用' }] }
  const fallback = await api.fetchNewHomeSchedule('/api/schedule')
  assert.equal(fallback.events[0].id, 'e')
  assert.equal(fallback.sources[0].cached, true)
})

test('offline fallback is explicit; empty/error without cache and read-only storage remain honest', async () => {
  const { api, storage } = load('schedule', { fetch: async () => { throw new Error('offline') } })
  await assert.rejects(api.fetchNewHomeSchedule('/api/schedule'), /offline/)
  storage.set('schedule-cache-v2', JSON.stringify({ version: 1, series: {} }))
  await assert.rejects(api.fetchNewHomeSchedule('/api/schedule'), /offline/)
  const saved = cacheApi.mergeScheduleWithClientCache(response([event('saved', [session(1000)])]), null).cache
  storage.set('schedule-cache-v2', JSON.stringify(saved))
  const fallback = await api.fetchNewHomeSchedule('/api/schedule')
  assert.equal(fallback.offline, true)
  assert.equal(fallback.events[0].id, 'saved')
  const readonly = load('schedule', { blocked: true, fetch: async () => ({ ok: true, json: async () => response([]) }) }).api
  assert.equal((await readonly.fetchNewHomeSchedule('/api/schedule')).events.length, 0)
})
