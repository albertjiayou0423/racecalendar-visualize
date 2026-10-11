import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'
function fixture(primary, feed) {
  const calls = []
  const source = ts.transpileModule(fs.readFileSync('lib/wrc-puppeteer.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText
  const context = { exports: {}, require: () => ({}), calls, primary, feed, console, process: { env: {} } }
  vm.createContext(context)
  vm.runInContext(source + `
    scrapeOfficialItineraryPage = async () => { calls.push('official'); return { sessions: primary, homeHtml: 'cached-home' } }
    scrapeWrcItineraryV2 = async () => { calls.push('feed'); return feed }
    scrapeWrcItineraryLegacy = async (slug, tz, date, html) => { calls.push('legacy:' + html); return [{ id: 'legacy' }] }
    exports.scrape = scrapeWrcItinerary;
  `, context)
  return { calls, scrape: context.exports.scrape }
}
test('official page success skips every fallback', async () => {
  const f = fixture([{ id: 'official' }], [{ id: 'feed' }])
  assert.equal((await f.scrape('event', 'UTC', '2026-01-01'))[0].id, 'official')
  assert.deepEqual(f.calls, ['official'])
})
test('failed official page uses Feed API before other fallbacks', async () => {
  const f = fixture([], [{ id: 'feed' }])
  assert.equal((await f.scrape('event', 'UTC', '2026-01-01'))[0].id, 'feed')
  assert.deepEqual(f.calls, ['official', 'feed'])
})
test('failed Feed API continues legacy fallback and reuses homepage', async () => {
  const f = fixture([], null)
  assert.equal((await f.scrape('event', 'UTC', '2026-01-01'))[0].id, 'legacy')
  assert.deepEqual(f.calls, ['official', 'feed', 'legacy:cached-home'])
})

