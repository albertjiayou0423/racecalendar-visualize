import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'
import * as timezone from '../lib/tz.ts'
import * as budget from '../lib/wrc-request-budget.ts'
const source = ts.transpileModule(fs.readFileSync('lib/wrc-puppeteer.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText
const exports = {}
vm.runInNewContext(source + '\nexports.convert = convertDaysToSessions; exports.date = parseDateText; exports.cache = parseItineraryFromCache; exports.offset = itineraryUtcOffset; exports.stageTime = parseStageTime;', {
  exports, URL, require: name => name === './tz' ? timezone : {}, process: { env: {} }, console: { log() {}, error() {} },
})
const stage = (time, name = 'SS1') => ({ time, name, isPowerStage: false })

test('prerender cache extraction tolerates HTML attribute ordering and validates JSON object shape', () => {
  const context = { exports: {}, require: () => ({}), process: { env: {} }, console: { error() {} } }
  vm.runInNewContext(source + '\nexports.extract = extractPrerenderCache;', context)
  for (const attributes of [
    'type="application/json" id="rb3-prerender-data-cache"',
    "id = 'rb3-prerender-data-cache' nonce='fixture' type='application/json'",
    'ID="rb3-prerender-data-cache"\n type="application/json" defer',
  ]) assert.equal(context.exports.extract(`<SCRIPT ${attributes}>{"valid":true}</SCRIPT >`).valid, true)
  const script = content => `<script id="rb3-prerender-data-cache">${content}</script>`
  assert.equal(context.exports.extract(script('broken') + script('null') + script('[]') + script('{"valid":true}')).valid, true)
  assert.equal(context.exports.extract('<script data-id="rb3-prerender-data-cache">{"wrong":true}</script>'), null)
  assert.equal(context.exports.extract(script('[]')), null)
})

test('page tabs accept absolute official links and reject unrelated event or external links', () => {
  const context = { exports: {}, URL, require: () => ({}), process: { env: {} } }
  vm.runInNewContext(source + '\nexports.itinerary = extractItineraryUrlFromCache; exports.results = extractResultsItineraryUrl;', context)
  const cache = tabs => ({ pageTabs: { data: { data: { tabs } } } })
  const slug = 'fixture-2026'
  const valid = `https://www.wrc.com/en/events/${slug}/itinerary?version=2#top`
  assert.equal(context.exports.itinerary(cache([null, { label: 'Itinerary', url: 'https://other.invalid/x' }, { label: 'Itinerary', url: valid }]), slug), valid.split('#')[0])
  assert.equal(context.exports.itinerary(cache([{ label: 'Itinerary', url: '/en/events/other-2026/itinerary' }]), slug), null)
  const result = new URL(context.exports.results(cache([{ label: 'Results', url: `/en/events/${slug}/results?version=2&tab=old` }]), slug))
  assert.equal(result.searchParams.get('version'), '2')
  assert.equal(result.searchParams.get('page'), 'results')
  assert.equal(result.searchParams.get('tab'), 'itinerary')
})

test('local crawler dates agree with the fallback calendar for every season round', () => {
  const context = { exports: {}, require: () => ({}), process: { env: {} } }
  vm.runInNewContext(source + '\nexports.targets = WRC_RALLIES;', context)
  const dataSource = ts.transpileModule(fs.readFileSync('lib/wrc-data.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText
  const calendar = { exports: {}, require: () => timezone }
  vm.runInNewContext(dataSource + '\nexports.rallies = RALLIES;', calendar)
  assert.equal(context.exports.targets.length, calendar.exports.rallies.length)
  for (const rally of calendar.exports.rallies) {
    const target = context.exports.targets.find(item => item.round === rally.round)
    assert.ok(target)
    assert.equal(target.startDate, rally.start.map((value, index) => index ? String(value).padStart(2, '0') : String(value)).join('-'))
  }
})

test('direct HTML fetch retries body failures and preserves permanent HTTP rejection behavior', async () => {
  let calls = 0
  let mode = 'recover'
  const context = { exports: {}, AbortSignal, process: { env: {} },
    setTimeout: callback => { callback(); return 0 }, console: { log() {}, error() {} },
    require: name => name === './wrc-request-budget' ? {
      memoizeWrcData: budget.memoizeWrcData,
      wrcBudgetExpired: () => false,
      fetchWithinWrcBudget: async () => {
        calls++
        return { ok: mode !== 'forbidden', status: 403, text: async () => {
          if (mode === 'broken' || calls === 1) throw new Error('body disconnected')
          return 'valid HTML'
        } }
      },
    } : {},
  }
  vm.runInNewContext(source + '\nexports.direct = fetchDirect;', context)
  assert.equal(await context.exports.direct('fixture'), 'valid HTML')
  assert.equal(calls, 2)
  calls = 0; mode = 'broken'
  assert.equal(await context.exports.direct('fixture'), null)
  assert.equal(calls, 3)
  calls = 0; mode = 'forbidden'
  assert.equal(await context.exports.direct('fixture'), null)
  assert.equal(calls, 1)
})

test('HTML requests reuse successful content only within the current crawl and retry failed content', async () => {
  let calls = 0
  let blocked = false
  const context = { exports: {}, AbortSignal, process: { env: {} }, console: { log() {}, error() {} },
    require: name => name === './wrc-request-budget' ? { ...budget,
      fetchWithinWrcBudget: async () => { calls++; return new Response(blocked ? '' : 'valid HTML', { status: blocked ? 403 : 200 }) },
    } : {},
  }
  vm.runInNewContext(source + '\nexports.direct = fetchDirect;', context)
  await budget.withWrcRequestBudget(1000, async () => {
    const content = await Promise.all([context.exports.direct('fixture'), context.exports.direct('fixture')])
    assert.deepEqual(content, ['valid HTML', 'valid HTML'])
    assert.equal(await context.exports.direct('fixture'), 'valid HTML')
    assert.equal(calls, 1)
  })
  await budget.withWrcRequestBudget(1000, () => context.exports.direct('fixture'))
  assert.equal(calls, 2)
  blocked = true
  await budget.withWrcRequestBudget(1000, async () => {
    assert.equal(await context.exports.direct('unpublished'), null)
    assert.equal(await context.exports.direct('unpublished'), null)
  })
  assert.equal(calls, 4)
})
test('official itinerary rejects rollover dates, invalid hours and minutes, and empty labels', () => {
  const sessions = exports.convert([
    { date: [2026, 2, 29], stages: [stage('09:00')] },
    { date: [2026, 1, 32], stages: [stage('09:00')] },
    { date: [2026, 3, 1], stages: [stage('25:61'), stage('24:00'), stage('09:60'), stage('9:00'), stage('09:00'), stage('10:00', '')] },
  ], 'UTC', 'fixture')
  assert.equal(sessions.length, 1)
  assert.equal(sessions[0].utc, '2026-03-01T09:00:00.000Z')
  assert.equal(sessions[0].tentative, false)
})
test('unknown FAQ dates are discarded instead of becoming confirmed rally start times', () => {
  const date = exports.date('To be confirmed', '2026-01-01')
  assert.equal(exports.convert([{ date, stages: [stage('09:00')] }], 'UTC', 'fixture').length, 0)
  assert.equal(exports.date('Friday, 23 January', '2026-01-22')[2], 23)
})
test('valid leap dates and European summer-time conversion remain supported', () => {
  const leap = exports.convert([{ date: [2024, 2, 29], stages: [stage('09:00')] }], 'UTC', 'fixture')
  assert.equal(leap[0].utc, '2024-02-29T09:00:00.000Z')
  const summer = exports.convert([{ date: [2026, 7, 10], stages: [stage('09:00')] }], 'Europe/Helsinki', 'fixture')
  assert.equal(summer[0].utc, '2026-07-10T06:00:00.000Z')
})

test('invalid time in first feed candidate does not hide a valid later candidate', async () => {
  const context = { exports: {}, process: { env: {} }, console: { log() {}, error() {} },
    require: name => name === './tz' ? timezone : {} }
  vm.createContext(context)
  vm.runInContext(source + `
    fetchItineraryFromFeedApi = async slug => [{ date: [2026, 1, 1], stages: [{ name: 'SS1', time: slug === 'itinerary-fixture-2026' ? '25:61' : '09:00', isPowerStage: false }] }];
    exports.v2 = scrapeWrcItineraryV2;
  `, context)
  const sessions = await context.exports.v2('fixture-2026', 'UTC', '2026-01-01')
  assert.equal(sessions.length, 1)
  assert.equal(sessions[0].utc, '2026-01-01T09:00:00.000Z')
})

test('English ordinal dates and explicit years do not inherit the wrong rally year', () => {
  assert.deepEqual(Array.from(exports.date('Thursday 1st October 2026', '2025-12-31')), [2026, 10, 1])
  assert.deepEqual(Array.from(exports.date('Friday, 2 January 2027', '2026-12-31')), [2027, 1, 2])
  assert.deepEqual(Array.from(exports.date('2026-10-01', '2025-01-01')), [2026, 10, 1])
})

test('legacy HTML fallback continues after invalid SSR and itinerary page times', async () => {
  const calls = []
  const context = { exports: {}, calls, process: { env: {} }, console: { log() {}, error() {} },
    require: name => name === './tz' ? timezone : {} }
  vm.createContext(context)
  vm.runInContext(source + `
    extractPrerenderCache = () => ({});
    extractItineraryUriSlugFromCache = () => 'fixture-itinerary';
    fetchItineraryFromFeedApi = async () => null;
    parseItineraryFromCache = () => null;
    extractItineraryUrlFromCache = () => 'first-page';
    extractResultsItineraryUrl = () => 'second-page';
    fetchDirect = async url => { calls.push(url); return 'rb3-prerender-data-cache ' + url };
    parseItineraryFromHtml = html => [{ date: [2026, 7, 10], stages: [{ name: 'SS1', time: html.includes('second-page') ? '09:00' : '25:61', isPowerStage: false }] }];
    exports.legacy = scrapeWrcItineraryLegacy;
  `, context)
  const sessions = await context.exports.legacy('fixture-2026', 'UTC', '2026-07-10', 'rb3-prerender-data-cache home')
  assert.equal(sessions[0].utc, '2026-07-10T09:00:00.000Z')
  assert.deepEqual(calls.slice(-2), ['first-page', 'second-page'])
})
test('FAQ UTC and GMT offsets override rally timezone without double conversion', () => {
  const faq = title => ({ feed: { data: { data: { items: [{ type: 'faq', title, elements: [{
    question: [{ variant: 'text', text: 'Friday, 10 July 2026' }],
    answer: [{ type: 'list', items: [{ elements: [{ variant: 'text', text: '09:00: SS1' }] }] }],
  }] }] } } } })
  for (const [title, utc] of [
    ['Itinerary (UTC)', '2026-07-10T09:00:00.000Z'],
    ['Itinerary GMT+02:00', '2026-07-10T07:00:00.000Z'],
    ['Itinerary UTC-3', '2026-07-10T12:00:00.000Z'],
    ['Itinerary local time', '2026-07-10T06:00:00.000Z'],
  ]) {
    const days = exports.cache(faq(title), '2026-07-09')
    assert.equal(exports.convert(days, 'Europe/Helsinki', 'fixture')[0].utc, utc)
  }
  assert.equal(Number.isNaN(exports.offset('Itinerary UTC+25')), true)
  assert.equal(exports.cache(faq('Itinerary UTC+25'), '2026-07-09'), null)
})

test('cache and feed skip invalid FAQ versions before selecting a valid itinerary', async () => {
  const faq = (date, time, title = 'Itinerary UTC') => ({ type: 'faq', title, elements: [{
    question: [{ variant: 'text', text: date }],
    answer: [{ type: 'list', items: [{ elements: [{ variant: 'text', text: `${time}: SS1` }] }] }],
  }] })
  const valid = faq('10 July 2026', '11:00')
  valid.elements.unshift(null, { question: [null, { variant: 'text', text: 123 }], answer: [] })
  valid.elements[2].question.unshift(null)
  valid.elements[2].answer.unshift(null)
  valid.elements[2].answer[1].items.unshift(null, { elements: {} }, { elements: [null, { variant: 'text', text: 123 }] })
  const items = [null, { type: 'faq', title: 123 }, faq('10 July 2027', '08:00'), faq('TBC', '09:00'), faq('10 July 2026', '25:61'), faq('10 July 2026', '09:00', 'Itinerary UTC+25'), valid]
  const days = exports.cache({ feed: { data: { data: { items } } } }, '2026-07-09')
  assert.equal(exports.convert(days, 'UTC', 'fixture')[0].utc, '2026-07-10T11:00:00.000Z')
  const context = { exports: {}, process: { env: {} }, AbortSignal,
    console: { log() {}, error() {} },
    require: name => name === './tz' ? timezone : name === './wrc-request-budget' ? {
      fetchWithinWrcBudget: async () => ({ ok: true, json: async () => ({ data: { items } }) }),
    } : {},
  }
  vm.runInNewContext(source + '\nexports.feed = fetchItineraryFromFeedApiUncached;', context)
  const feed = await context.exports.feed('fixture-2026', '2026-07-09')
  assert.equal(exports.convert(feed, 'UTC', 'fixture')[0].utc, '2026-07-10T11:00:00.000Z')
  const newYear = exports.cache({ feed: { data: { data: { items: [faq('2 January 2027', '09:00')] } } } }, '2026-12-31')
  assert.equal(exports.convert(newYear, 'UTC', 'fixture')[0].utc, '2027-01-02T09:00:00.000Z')
})

// These regressions must never select another rally merely through generic words.
test('third-party rally matching rejects empty names and generic WRC rally overlap', () => {
  const context = { exports: {}, require: () => ({}), process: { env: {} } }
  vm.createContext(context)
  vm.runInContext(source + '\nexports.match = rallyNameMatches;', context)
  const match = context.exports.match
  assert.equal(match('WRC Rally Monte Carlo', '芬兰拉力赛'), false)
  assert.equal(match('WRC Rally Monte Carlo', 'wrc-rally-finland-2026'), false)
  assert.equal(match('Rally', 'WRC Rally'), false)
  assert.equal(match('WRC Rally Chile Bio Bío', 'wrc-rally-chile-bio-bio-2026'), true)
  assert.equal(match('WRC Secto Rally Finland', 'wrc-secto-rally-finland-2026'), true)
})

test('third-party timestamps distinguish explicit UTC, offset ISO and local wall time', () => {
  const tz = 'Europe/Helsinki'
  assert.equal(exports.stageTime({ scheduledStartTimeUtc: '2026-07-10T09:00:00' }, tz).utc, '2026-07-10T09:00:00.000Z')
  assert.equal(exports.stageTime({ scheduledStartTime: '2026-07-10T09:00:00' }, tz).utc, '2026-07-10T06:00:00.000Z')
  assert.equal(exports.stageTime({ startTime: '2026-07-10T09:00:00+02:00' }, tz).utc, '2026-07-10T07:00:00.000Z')
  assert.equal(exports.stageTime({ startTime: '2026-07-10T9:00:12.125z' }, tz).utc, '2026-07-10T09:00:12.125Z')
  assert.equal(exports.stageTime({ startTime: '2026-07-10T00:00:00+14:00' }, tz).utc, '2026-07-09T10:00:00.000Z')
  assert.equal(exports.stageTime({ startTime: '2026-07-10T23:00:00-14:00' }, tz).utc, '2026-07-11T13:00:00.000Z')
  assert.equal(exports.stageTime({ date: '2026-07-10', time: '09:00:12.125' }, tz).utc, '2026-07-10T06:00:12.125Z')
  for (const stage of [
    { date: '2026-02-29', time: '09:00' },
    { date: '2026-07-10', time: '25:61' },
    { startTime: '2026-02-30T09:00:00Z' },
    { startTime: '2026-07-10' },
    { startTime: '2026-07-10T09:00:00+14:01' },
    { startTime: '2026-07-10T09:00:00-15:00' },
    { startTime: '2026-07-10T09:00:00+02:60' },
  ]) assert.equal(exports.stageTime(stage, tz), null)
})
test('ambiguous and wrong-year third-party rallies do not request detail data', async () => {
  const calls = []
  const context = { exports: {}, calls, require: () => ({}), process: { env: {} }, console: { log() {} } }
  vm.createContext(context)
  vm.runInContext(source + `
    fetchOcblacktopRallyDetail = async id => { calls.push(id); return null };
    exports.fallback = tryOcblacktopFallback;
  `, context)
  const rally = { name: '芬兰拉力赛', eventSlug: 'wrc-secto-rally-finland-2026', startDate: '2026-08-07' }
  await context.exports.fallback(rally, [{ id: 'old', name: 'Rally Finland', dateStart: '2025-08-07' }])
  await context.exports.fallback(rally, [{ id: 'named-old', name: 'Rally Finland 2025' }])
  await context.exports.fallback(rally, [{ id: 'a', name: 'Rally Finland' }, { id: 'b', name: 'WRC Rally Finland' }])
  assert.equal(calls.length, 0)
  await context.exports.fallback(rally, [{ id: 'current', name: 'Rally Finland', dateStart: '2026-08-06' }])
  assert.deepEqual(calls, ['current'])
})
