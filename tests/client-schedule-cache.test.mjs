import test from "node:test"
import assert from "node:assert/strict"
import {
  mergeScheduleWithClientCache,
  parseClientScheduleCache,
  scheduleFromClientCache,
} from "../lib/client-schedule-cache.ts"

const event = (id, series, tentative = false) => ({ id, series, tentative })
const source = (series, ok, label = `${series} source`) => ({ series, ok, label })
const response = (events, sources, fetchedAt = "2026-10-13T00:00:00.000Z") => ({ events, sources, fetchedAt })

test("partial refresh keeps successful series cached and never replaces failed data with estimates", () => {
  const first = mergeScheduleWithClientCache(response(
    [event("f1-old", "F1"), event("wrc-estimate", "WRC", true), event("fe-old", "FE")],
    [source("F1", true), source("WRC", false), source("FE", true)],
  ), null)

  assert.deepEqual(Object.keys(first.cache.series).sort(), ["F1", "FE"])
  assert.equal(first.response.events.find(item => item.series === "WRC").id, "wrc-estimate")
  assert.equal(first.response.sources.find(item => item.series === "WRC").cached, false)

  const next = mergeScheduleWithClientCache(response(
    [event("f1-estimate", "F1", true), event("wrc-estimate-2", "WRC", true), event("fe-new", "FE")],
    [source("F1", false), source("WRC", false), source("FE", true)],
    "2026-10-13T01:00:00.000Z",
  ), first.cache)

  assert.deepEqual(next.response.events.map(item => item.id), ["f1-old", "wrc-estimate-2", "fe-new"])
  assert.equal(next.response.events.some(item => item.id === "f1-estimate"), false)
  assert.equal(next.response.sources.find(item => item.series === "F1").cached, true)
  assert.equal(next.response.sources.find(item => item.series === "F1").ok, false)
  assert.equal(next.response.sources.find(item => item.series === "WRC").cached, false)
  assert.equal(next.cache.series.F1.events[0].id, "f1-old")
  assert.equal(next.cache.series.FE.events[0].id, "fe-new")
})

test("an empty successful response cannot erase a prior non-empty series cache", () => {
  const initial = mergeScheduleWithClientCache(response([event("f1-known", "F1")], [source("F1", true)]), null)
  const next = mergeScheduleWithClientCache(response([], [source("F1", true)], "2026-10-13T01:00:00.000Z"), initial.cache)
  assert.deepEqual(next.response.events.map(item => item.id), ["f1-known"])
  assert.equal(next.response.sources[0].cached, true)
  assert.match(next.response.sources[0].note, /暂未返回赛事数据/)
  assert.equal(next.cache.series.F1.fetchedAt, initial.cache.series.F1.fetchedAt)
})

test("offline data is composed from per-series last-known-good entries and marked cached", () => {
  const cache = mergeScheduleWithClientCache(response(
    [event("f1", "F1"), event("fe", "FE")],
    [source("F1", true), source("FE", true)],
  ), null).cache
  const offline = scheduleFromClientCache(cache, true)
  assert.equal(offline.offline, true)
  assert.deepEqual(offline.events.map(item => item.id), ["f1", "fe"])
  assert.ok(offline.sources.every(item => item.cached))
})

test("legacy whole-response cache migrates only source-verified series", () => {
  const legacy = response(
    [event("f1", "F1"), event("wrc-estimate", "WRC", true)],
    [source("F1", true), source("WRC", false)],
  )
  const migrated = parseClientScheduleCache(JSON.stringify(legacy))
  assert.deepEqual(Object.keys(migrated.series), ["F1"])
  assert.equal(parseClientScheduleCache("not json"), null)
})
