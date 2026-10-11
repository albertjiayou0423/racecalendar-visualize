import test from 'node:test'
import assert from 'node:assert/strict'
import { mergeWrcSnapshotEvents } from '../lib/wrc-snapshot-merge.ts'
const session = (name, tentative, hour = '09') => ({ name, tentative, utc: `2026-07-10T${hour}:00:00Z` })
const event = (sessions, tentative = false, id = 'wrc-2026-1') => ({ id, series: 'WRC', sessions, tentative, eventSlug: 'current-slug' })
test('whole-rally estimates retain confirmed times but keep current event metadata', () => {
  const old = event([session('SS1 Road', false), session('SS2 Road', false)])
  const incoming = event([session('SS1', true), session('SS2', true), session('SS3', true)], true)
  const { events, retainedSessions } = mergeWrcSnapshotEvents([incoming], [{ ...old, eventSlug: 'old-slug' }])
  assert.equal(events[0].sessions.length, 2)
  assert.equal(events[0].eventSlug, 'current-slug')
  assert.equal(events[0].tentative, false)
  assert.equal(retainedSessions, 2)
  assert.equal(incoming.sessions.length, 3)
})
test('mixed-rally estimates recover matching confirmed stages while fresh official times win', () => {
  const old = event([session('SS1 Road', false), session('SS2 Road', false)])
  const incoming = event([session('SS1', true, '10'), session('SS2 Updated Road', false, '11'), session('SS3', true, '12')], true)
  const result = mergeWrcSnapshotEvents([incoming], [old])
  assert.equal(result.events[0].sessions[0].utc, old.sessions[0].utc)
  assert.equal(result.events[0].sessions[0].tentative, false)
  assert.equal(result.events[0].sessions[1].utc, incoming.sessions[1].utc)
  assert.equal(result.events[0].tentative, true)
  assert.equal(result.retainedSessions, 1)
})
test('partial old snapshots never promote estimated stages and never cross event IDs', () => {
  const old = event([session('SS1 Road', false), session('SS2', true)], true)
  const fresh = event([session('SS1', true, '10'), session('SS2', true, '11')], true)
  const result = mergeWrcSnapshotEvents([fresh, event([session('SS1', true)], true, 'other')], [old])
  assert.equal(result.events[0].sessions[0].tentative, false)
  assert.equal(result.events[0].sessions[1].tentative, true)
  assert.equal(result.events[1].sessions[0].tentative, true)
  assert.equal(result.retainedSessions, 1)
})
test('invalid historical times and ambiguous stage identities are not reused', () => {
  const old = event([session('SS1 Road', false), session('SS1 Duplicate', false), { ...session('SS2', false), utc: 'invalid' }])
  const fresh = event([session('SS1', true), session('SS2', true), session('SS3', false)], true)
  const result = mergeWrcSnapshotEvents([fresh], [old])
  assert.equal(result.retainedSessions, 0)
  assert.equal(result.events[0].sessions.filter(s => s.tentative).length, 2)
})

import fs from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'
test('snapshot write failure propagates once without repeating a database insert', async () => {
  let writes = 0
  const failure = new Error('database unavailable')
  const sql = async strings => {
    if (strings.join('?').includes('INSERT INTO crawl_snapshots')) {
      writes++
      throw failure
    }
    return []
  }
  const source = ts.transpileModule(fs.readFileSync('lib/crawl-store.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText
  const exports = {}
  vm.runInNewContext(source, { exports,
    require: name => name === './db' ? { getSql: () => sql } : { mergeWrcSnapshotEvents },
    console: { error() {} },
  })
  await assert.rejects(exports.saveWrcSnapshotMerged({ ok: true, events: [] }, 'fixture'), error => error === failure)
  assert.equal(writes, 1)
})
test('snapshot store persists merged confirmed sessions and updates response provenance', async () => {
  const old = event([session('SS1 Road', false)])
  const writes = []
  const sql = async (strings, ...values) => {
    const query = strings.join('?')
    if (query.includes('SELECT data')) return [{ data: { ok: true, events: [old] }, fetched_at: '2026-07-09T00:00:00Z' }]
    if (query.includes('INSERT INTO crawl_snapshots')) writes.push(JSON.parse(values[1]))
    return []
  }
  const source = ts.transpileModule(fs.readFileSync('lib/crawl-store.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText
  const exports = {}
  vm.runInNewContext(source, { exports,
    require: name => name === './db' ? { getSql: () => sql } : { mergeWrcSnapshotEvents },
    console: { error() {} },
  })
  const data = { ok: true, events: [event([session('SS1', true, '10')], true)], note: '1 场仍有待确认赛段' }
  await exports.saveWrcSnapshotMerged(data, 'fixture')
  assert.equal(writes.length, 1)
  assert.equal(writes[0].events[0].sessions[0].utc, old.sessions[0].utc)
  assert.equal(data.events[0].sessions[0].tentative, false)
  assert.match(data.note, /保留 1 个已确认赛段/)
  assert.doesNotMatch(data.note, /1 场仍有待确认赛段/)
})
