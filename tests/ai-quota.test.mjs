import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'
import { createRequire } from 'node:module'
import { consumeAiQuotaSlot } from '../lib/ai-quota.ts'

const require = createRequire(import.meta.url)
const next = require('next/server')

test('concurrent quota reservations never exceed the daily limit', async () => {
  let count = 0
  const statements = []
  const sql = async (parts, ...values) => {
    const text = parts.join('?')
    statements.push({ text, values })
    if (text.includes('INSERT INTO ai_usage')) {
      if (count >= values[1]) return []
      count += 1
      return [{ count }]
    }
    assert.fail('unexpected SQL statement')
  }

  const results = await Promise.all(Array.from({ length: 80 }, () => consumeAiQuotaSlot(sql, '2026-10-12', 50)))
  assert.equal(results.filter(result => result.allowed).length, 50)
  assert.equal(results.filter(result => result.reason === 'limit').length, 30)
  assert.equal(count, 50)
  assert.ok(statements.every(({ text }) => /WHERE ai_usage\.count < \?\s+RETURNING count/.test(text)))
  assert.equal(results.find(result => result.allowed && result.remaining === 0).used, 50)
})

test('quota storage errors fail closed instead of sending an unmetered AI request', async () => {
  const result = await consumeAiQuotaSlot(async () => { throw new Error('database unavailable') }, '2026-10-12', 50)
  assert.deepEqual(result, { allowed: false, used: 0, remaining: 0, reason: 'unavailable' })
})

function loadRoute(quota, onFetch) {
  const source = ts.transpileModule(fs.readFileSync('app/api/predictions/route.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText
  const exports = {}
  vm.runInNewContext(source, {
    exports,
    require: name => name === 'next/server' ? next
      : name === '@/lib/db' ? { getSqlOrFail: async () => null, initDb: async () => {}, isDbAvailable: () => false, consumeAiQuotaSlot: async () => quota, AI_DAILY_LIMIT: 50 }
        : name === '@/lib/anonymous-voter' ? { anonymousVoterCookie() {}, resolveAnonymousVoterId() { return { id: '123e4567-e89b-12d3-a456-426614174000', isNew: false } } }
          : require(name),
    process: { env: { NVIDIA_NIM_API_KEY: 'fixture-key' } },
    fetch: (...args) => onFetch(...args),
    Response,
    URL,
    console: { error() {} },
  })
  return exports
}

test('prediction route returns the daily fallback without calling the provider at the limit', async () => {
  let calls = 0
  const route = loadRoute({ allowed: false, used: 50, remaining: 0, reason: 'limit' }, () => { calls += 1 })
  const response = await route.POST(new Request('https://racecalendar.test/api/predictions', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ eventId: 'f1-2026-17', series: 'F1' }),
  }))
  const body = await response.json()
  assert.equal(response.status, 200)
  assert.equal(calls, 0)
  assert.equal(body.quotaExceeded, true)
  assert.equal(body.quotaRemaining, 0)
})

test('prediction route fails closed when the quota database cannot be checked', async () => {
  let calls = 0
  const route = loadRoute({ allowed: false, used: 0, remaining: 0, reason: 'unavailable' }, () => { calls += 1 })
  const response = await route.POST(new Request('https://racecalendar.test/api/predictions', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ eventId: 'f1-2026-17', series: 'F1' }),
  }))
  const body = await response.json()
  assert.equal(calls, 0)
  assert.equal(body.quotaExceeded, false)
  assert.match(body.error, /额度暂时无法核验/)
})

test('successful provider calls report the quota remaining after their atomic reservation', async () => {
  let calls = 0
  const route = loadRoute({ allowed: true, used: 8, remaining: 42, reason: null }, async () => {
    calls += 1
    return Response.json({ choices: [{ message: { content: '1. Max Verstappen - Red Bull - strong pace' } }] })
  })
  const response = await route.POST(new Request('https://racecalendar.test/api/predictions', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ eventId: 'f1-2026-17', series: 'F1' }),
  }))
  const body = await response.json()
  assert.equal(response.status, 200)
  assert.equal(calls, 1)
  assert.equal(body.quotaRemaining, 42)
  assert.equal(body.modelUsed, 'nvidia-nim/llama-3.1-8b-instruct')
})
