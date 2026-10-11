import test from "node:test"
import assert from "node:assert/strict"
import fs from "node:fs"
import vm from "node:vm"
import ts from "typescript"
import { normalizeF1Metadata } from "../lib/f1-metadata.ts"

function fixture({ stale = false, missing = false, exhausted = false } = {}) {
  const tasks = [], calls = [], overrides = []
  const source = ts.transpileModule(fs.readFileSync("app/api/schedule/route.ts", "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText
  const modules = {
    "@/lib/f1-metadata": { normalizeF1Metadata },
    "next/server": { connection: async () => {}, after: fn => tasks.push(fn), NextResponse: { json: body => body } },
    "@/lib/schedule-fetch": { refreshSeries: async (series, allowed) => {
      calls.push({ series, allowed })
      return { result: { events: [{ id: series, series, circuit: "test" }], ok: true }, fromCache: false }
    } },
    "@/lib/wrc-data": { buildWrcEvents: () => [] },
    "@/lib/fetchers": { CIRCUIT_IMAGES: {} },
    "@/lib/crawl-store": {
      initCrawlTables: async () => {},
      getLatestSnapshot: async series => missing ? null : ({
        data: { events: [{ id: series, series, circuit: "test" }], ok: true },
        fetchedAt: new Date(Date.now() - (stale ? 7200000 : 1000)).toISOString(),
      }),
      getAllOverrides: async () => { overrides.push(1); return [{ eventId: "F1", data: { title: "manual" } }] },
      getCrawlQuota: async () => ({ used: exhausted ? 10 : 0, limit: 10 }),
    },
  }
  const exports = {}
  vm.runInNewContext(source, { exports, require: name => modules[name], Date, Map, console })
  return { get: exports.GET, tasks, calls, overrides }
}
test("fresh snapshots return without upstream calls and use one override query", async () => {
  const f = fixture(), body = await f.get()
  assert.equal(body.events.length, 3)
  assert.equal(body.events[0].title, "manual")
  assert.equal(f.overrides.length, 1)
  assert.equal(f.calls.length, 0)
  assert.equal(f.tasks.length, 0)
})
test("stale snapshots return before upstream work starts; refreshes run after response", async () => {
  const f = fixture({ stale: true })
  await f.get()
  assert.equal(f.calls.length, 0)
  assert.equal(f.tasks.length, 3)
  await Promise.all(f.tasks.map(fn => fn()))
  assert.equal(f.calls.length, 3)
})
test("background refresh respects exhausted quota while WRC official remains allowed", async () => {
  const f = fixture({ stale: true, exhausted: true })
  await f.get()
  await Promise.all(f.tasks.map(fn => fn()))
  assert.equal(f.calls.length, 1)
  assert.equal(f.calls[0].series, "WRC")
  assert.equal(f.calls[0].allowed, false)
})
test("missing snapshots fetch initial data instead of returning a blank calendar", async () => {
  const f = fixture({ missing: true })
  const body = await f.get()
  assert.equal(body.events.length, 3)
  assert.equal(f.calls.length, 3)
})
