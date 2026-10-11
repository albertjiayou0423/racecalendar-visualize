import * as targets from "../lib/wrc-targets.ts"
import * as crawlOrder from "../lib/wrc-crawl-order.ts"
import * as requestBudget from "../lib/wrc-request-budget.ts"
import test from 'node:test'
import assert from 'node:assert/strict'
import { mapSettledWithConcurrency } from '../lib/wrc-concurrency.ts'
import fs from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'

test('bounded rally workers preserve order, isolate failure and never exceed limit', async () => {
  let active = 0, peak = 0
  const results = await mapSettledWithConcurrency([0, 1, 2, 3, 4], 2, async value => {
    active++; peak = Math.max(peak, active)
    await new Promise(resolve => setTimeout(resolve, value % 2 ? 1 : 5))
    active--
    if (value === 2) throw new Error('one rally failed')
    return value * 10
  })
  assert.equal(peak, 2)
  assert.equal(results[0].value, 0)
  assert.equal(results[1].value, 10)
  assert.equal(results[2].status, 'rejected')
  assert.equal(results[3].value, 30)
  assert.equal(results[4].value, 40)
  assert.deepEqual(await mapSettledWithConcurrency([], 4, async () => 1), [])
  await assert.rejects(mapSettledWithConcurrency([1], 0, async () => 1), RangeError)
})
function crawl({ fail = false, allow = true } = {}) {
  const calls = []
  const rallies = [1, 2, 3].map(round => ({ round, name: `R${round}`, eventSlug: `rally-${round}`, startDate: '2026-01-01', tz: 'UTC' }))
  const events = rallies.map(r => ({ id: `wrc-${r.round}`, round: r.round, sessions: [], tentative: true }))
  const source = ts.transpileModule(fs.readFileSync('lib/wrc-puppeteer.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText
  const exports = {}
  const context = {
    exports, calls, rallies, fail,
    process: { env: { OCBLACKTOP_API_KEY: 'fixture-only' } },
    console: { log() {}, error() {} },
    require: name => name === "./wrc-targets" ? targets : name === "./wrc-crawl-order" ? crawlOrder : name === './wrc-request-budget' ? requestBudget : name === './wrc-concurrency' ? { mapSettledWithConcurrency }
      : name === './wrc-data' ? { buildWrcEvents: () => events, buildWrcLiveTimingUrl: () => 'fixture' } : {},
  }
  vm.createContext(context)
  vm.runInContext(source + `
    WRC_RALLIES.splice(0, WRC_RALLIES.length, ...rallies);
    fetchWrcCalendar = async () => rallies;
    scrapeWrcItinerary = async slug => { calls.push('official:' + slug); return fail ? null : [{ name: 'SS1', utc: '2026-01-01T09:00:00Z' }] };
    fetchOcblacktopRallies = async () => { calls.push('index'); return [{ id: 'fixture' }] };
    tryOcblacktopFallback = async () => { calls.push('detail'); return null };
  `, context)
  return { calls, result: exports.fetchWrc({ allowApiFallback: allow }) }
}
test('successful official crawl makes no third-party requests', async () => {
  const f = crawl()
  assert.equal((await f.result).ok, true)
  assert.equal(f.calls.filter(c => c === 'index').length, 0)
  assert.equal(f.calls.length, 3)
})
test('concurrent official failures load one shared third-party index and do not restart chains', async () => {
  const f = crawl({ fail: true })
  assert.equal((await f.result).ok, false)
  assert.equal(f.calls.filter(c => c === 'index').length, 1)
  assert.equal(f.calls.filter(c => c.startsWith('official:')).length, 3)
  assert.equal(f.calls.filter(c => c === 'detail').length, 3)
})
test('exhausted third-party quota suppresses index and detail requests', async () => {
  const f = crawl({ fail: true, allow: false })
  await f.result
  assert.equal(f.calls.length, 3)
})
