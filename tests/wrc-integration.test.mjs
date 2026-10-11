import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'
import * as timezone from '../lib/tz.ts'
import * as budget from '../lib/wrc-request-budget.ts'
import * as concurrency from '../lib/wrc-concurrency.ts'
import * as order from '../lib/wrc-crawl-order.ts'

const faq = { type: 'faq', title: 'Itinerary (UTC)', elements: [{
  question: [{ variant: 'text', text: 'Friday, 10 July 2026' }],
  answer: [{ type: 'list', items: [{ elements: [{ variant: 'text', text: '09:00: SS1' }] }] }],
}] }
const html = cache => `<script type="application/json" id="rb3-prerender-data-cache">${JSON.stringify(cache)}</script>`
function fixture({ feed = false, round = 1 } = {}) {
  const requests = [], slug = 'wrc-fixture-rally-2026'
  const source = ts.transpileModule(fs.readFileSync('lib/wrc-puppeteer.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText
  const events = [1, 2].map(round => ({ id: `wrc-2026-${round}`, series: 'WRC', round, sessions: [{ name: 'Estimated SS', utc: '2026-01-01T09:00:00Z', tentative: true }], tentative: true }))
  const fakeFetch = async input => {
    const url = String(input); requests.push(url)
    if (url.includes('event-series:')) return Response.json({ data: { events: [{ id: 'fixture-card' }] } })
    if (url.includes('/content/fixture-card')) return Response.json({ data: {
      content: { standfirst: `Round ${round}`, title: 'Fixture' }, reference: { uriSlug: slug },
      event: { startDate: '2026-07-09' }, location: { countryName: 'Finland' },
    } })
    if (url.endsWith(`/en/events/${slug}`)) return feed ? new Response('', { status: 403 }) : new Response(html({ pageTabs: { data: { data: { tabs: [{ label: 'Itinerary', url: `/en/events/${slug}/known-itinerary` }] } } } }))
    if (url.endsWith('/known-itinerary')) return new Response(html({ feed: { data: { data: { items: [faq] } } } }))
    if (url.includes('/feed/') && new URL(url).searchParams.get('filter[uriSlug]') === `itinerary-${slug}`) return Response.json({ data: { items: [faq] } })
    return new Response('', { status: 404 })
  }
  const exports = {}
  vm.runInNewContext(source, {
    exports, process: { env: {} }, URL, AbortSignal, setTimeout,
    console: { log() {}, error() {} },
    require: name => name === './tz' ? timezone : name === './wrc-request-budget' ? { ...budget, fetchWithinWrcBudget: fakeFetch }
      : name === './wrc-concurrency' ? concurrency : name === './wrc-crawl-order' ? order
      : name === './wrc-data' ? { buildWrcEvents: () => events, buildWrcLiveTimingUrl: slug => `https://fixture/${slug}` } : {},
  })
  return { requests, get: () => exports.fetchWrc({ allowApiFallback: false }) }
}
for (const feed of [false, true]) test(`full WRC crawler parses ${feed ? 'feed fallback' : 'official HTML'} and preserves stable IDs and estimates`, async () => {
  const f = fixture({ feed }), result = await f.get()
  assert.equal(result.ok, true)
  assert.equal(result.events[0].id, 'wrc-2026-1')
  assert.equal(result.events[0].sessions[0].utc, '2026-07-10T09:00:00.000Z')
  assert.equal(result.events[0].sessions[0].tentative, false)
  assert.equal(result.events[0].tentative, false)
  assert.equal(result.events[1].tentative, true)
  assert.match(result.note, /1 场仍有待确认赛段/)
  if (!feed) assert.equal(f.requests.some(url => url.includes('/feed/')), false)
  assert.equal(f.requests.some(url => url.includes('ocblacktop')), false)
})
test('unknown official round cannot report successful data absent from output calendar', async () => {
  const f = fixture({ round: 99 })
  const result = await f.get()
  assert.equal(result.ok, false)
  assert.equal(result.events.every(event => event.tentative), true)
})
