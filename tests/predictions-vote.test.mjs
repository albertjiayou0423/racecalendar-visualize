import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'
import { createRequire } from 'node:module'
import { anonymousVoterCookie, resolveAnonymousVoterId } from '../lib/anonymous-voter.ts'

const require = createRequire(import.meta.url)
const next = require('next/server')
const knownId = '123e4567-e89b-12d3-a456-426614174000'

function loadRoute(sql) {
  const source = ts.transpileModule(fs.readFileSync('app/api/predictions/route.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText
  const exports = {}
  vm.runInNewContext(source, {
    exports,
    require: name => name === 'next/server' ? next
      : name === '@/lib/db' ? { getSqlOrFail: async () => sql, initDb: async () => {}, isDbAvailable: () => true, consumeAiQuotaSlot: async () => ({ allowed: true, remaining: 49, used: 1, reason: null }), AI_DAILY_LIMIT: 50 }
        : name === '@/lib/anonymous-voter' ? { anonymousVoterCookie, resolveAnonymousVoterId }
          : require(name),
    process: { env: {} },
    URL,
    console: { error() {} },
  })
  return exports
}

function fakeSql() {
  const calls = []
  const sql = async (parts, ...values) => {
    const text = parts.join('?')
    calls.push({ text, values })
    if (text.includes('GROUP BY driver_code')) return [{ driver_code: 'VER', count: '2', is_mine: true }, { driver_code: 'HAM', count: '1', is_mine: false }]
    return []
  }
  return { sql, calls }
}

test('anonymous voter cookie reuses valid IDs and replaces malformed IDs', () => {
  assert.deepEqual(resolveAnonymousVoterId(`other=x; racecalendar_voter=${knownId}`, () => 'new-id'), { id: knownId, isNew: false })
  assert.deepEqual(resolveAnonymousVoterId('racecalendar_voter=anonymous-old-format', () => 'new-id'), { id: 'new-id', isNew: true })
  assert.deepEqual(resolveAnonymousVoterId('racecalendar_voter=%E0%A4%A', () => 'new-id'), { id: 'new-id', isNew: true })
  assert.match(anonymousVoterCookie(knownId, true), /HttpOnly; SameSite=Lax; Secure/)
  assert.match(anonymousVoterCookie(knownId, false), /Max-Age=31536000/)
})

test('repeated anonymous votes upsert under one voter ID and GET restores the vote', async () => {
  const { sql, calls } = fakeSql()
  const route = loadRoute(sql)
  const first = await route.POST(new Request('https://racecalendar.test/api/predictions', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ eventId: 'f1-2026-17', driverCode: 'HAM' }),
  }))
  assert.equal(first.status, 200)
  const firstCookie = first.headers.get('set-cookie')
  assert.match(firstCookie, /HttpOnly/)
  assert.match(firstCookie, /SameSite=Lax/)
  assert.match(first.headers.get('cache-control'), /private, no-store/)
  const storedId = firstCookie.match(/racecalendar_voter=([^;]+)/)[1]
  assert.equal(calls[0].values[2], storedId)

  const second = await route.POST(new Request('https://racecalendar.test/api/predictions', {
    method: 'POST', headers: { 'content-type': 'application/json', cookie: firstCookie.split(';')[0] },
    body: JSON.stringify({ eventId: 'f1-2026-17', driverCode: 'VER' }),
  }))
  assert.equal(second.status, 200)
  assert.equal(second.headers.get('set-cookie'), null)
  assert.equal(calls[2].values[2], storedId)
  assert.match(calls[2].text, /ON CONFLICT \(event_id, voter_id\) DO UPDATE/)

  const loaded = await route.GET(new Request('https://racecalendar.test/api/predictions?eventId=f1-2026-17', {
    headers: { cookie: firstCookie.split(';')[0] },
  }))
  const body = await loaded.json()
  assert.equal(body.myVote, 'VER', JSON.stringify(body))
  assert.equal(body.total, 3)
  assert.match(calls.at(-1).text, /BOOL_OR\(voter_id = \?\) as is_mine/)
  assert.equal(calls.at(-1).values[0], storedId)
  assert.match(loaded.headers.get('cache-control'), /private, no-store/)
})

test('prediction endpoint rejects malformed, wrong-shaped and oversized request data', async () => {
  const { sql, calls } = fakeSql()
  const route = loadRoute(sql)
  const bodies = [
    '{',
    'null',
    '[]',
    JSON.stringify({ eventId: 42, driverCode: 'HAM' }),
    JSON.stringify({ eventId: 'f1-2026-17', driverCode: 42 }),
    JSON.stringify({ eventId: 'f1-2026-17', series: 'INDYCAR' }),
    JSON.stringify({ eventId: 'f1-2026-17', series: 'F1', eventName: 'x'.repeat(201) }),
    JSON.stringify({ eventId: 'x'.repeat(161), driverCode: 'HAM' }),
  ]

  for (const body of bodies) {
    const response = await route.POST(new Request('https://racecalendar.test/api/predictions', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body,
    }))
    assert.equal(response.status, 400, `${body.slice(0, 80)} should be rejected with 400`)
  }

  assert.equal(calls.length, 0, 'invalid input must not reach the database')
})
