import assert from "node:assert/strict"
import fs from "node:fs"
import test from "node:test"
import vm from "node:vm"
import ts from "typescript"
import { formatGap } from "../lib/live-timing.ts"

function loadRoute(fetchImpl) {
  const source = fs.readFileSync("app/api/live-timing/route.ts", "utf8")
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText
  const exports = {}
  vm.runInNewContext(output, {
    exports,
    require: (name) => name === "next/server"
      ? { NextResponse: { json: (body, init = {}) => ({ body, status: 200, ...init }) } }
      : name === "@/lib/live-timing" ? { formatGap } : assert.fail(`Unexpected import: ${name}`),
    fetch: fetchImpl,
    AbortSignal: { timeout: ms => ({ timeoutMs: ms }) },
    Date,
    URL,
    console: { error() {} },
  })
  return exports.GET
}

const request = (series) => ({ nextUrl: { searchParams: new URLSearchParams(series ? { series } : {}) } })

test("live timing shares an eight-second upstream deadline and caches active snapshots briefly", async () => {
  const calls = []
  const now = Date.now()
  const GET = loadRoute(async (input, init) => {
    const url = new URL(String(input))
    calls.push({ endpoint: url.pathname.split("/").at(-1), signal: init.signal })
    if (url.pathname.endsWith("/sessions")) {
      return Response.json([{ session_key: 99, date_start: new Date(now - 60000).toISOString(), date_end: new Date(now + 60000).toISOString(), session_name: "Race" }])
    }
    if (url.pathname.endsWith("/drivers")) return Response.json([
      { driver_number: 1, name_acronym: "ABC", full_name: "A Driver", team_name: "Team", team_colour: "FF0000" },
      { driver_number: 2, name_acronym: "XYZ", full_name: "B Driver", team_name: "Team B", team_colour: "0000FF" },
    ])
    if (url.pathname.endsWith("/position")) return Response.json([
      { driver_number: 1, position: 1, date: new Date(now).toISOString() },
      { driver_number: 2, position: 2, date: new Date(now).toISOString() },
    ])
    if (url.pathname.endsWith("/laps")) return Response.json([{ driver_number: 1, lap_number: 2, lap_duration: 90.234 }])
    if (url.pathname.endsWith("/intervals")) return Response.json([
      { driver_number: 1, gap_to_leader: null, interval: null, date: new Date(now).toISOString() },
      { driver_number: 2, gap_to_leader: 2.345, interval: 2.345, date: new Date(now).toISOString() },
    ])
    if (url.pathname.endsWith("/pit")) return Response.json([
      { driver_number: 2, lap_number: 1, date: new Date(now).toISOString() },
    ])
    if (url.pathname.endsWith("/race_control")) return Response.json([
      { category: "SafetyCar", date: "2026-10-13T10:00:00Z", flag: null, message: "SAFETY CAR DEPLOYED", scope: "Track", session_key: 99 },
      { category: "SafetyCar", date: "2026-10-13T10:05:00Z", flag: null, message: "SAFETY CAR IN THIS LAP", scope: "Track", session_key: 99 },
      { category: "SafetyCar", date: "2026-10-13T10:06:00Z", flag: null, message: "VIRTUAL SAFETY CAR DEPLOYED", scope: "Track", session_key: 99 },
      { category: "Flag", date: "2026-10-13T10:07:00Z", flag: "RED", message: "RED FLAG", scope: "Track", session_key: 99 },
      { category: "Flag", date: "2026-10-13T10:08:00Z", flag: "GREEN", message: "GREEN FLAG", scope: "Track", session_key: 99 },
    ])
    assert.fail(`Unexpected OpenF1 endpoint: ${url.pathname}`)
  })

  const response = await GET(request("F1"))
  assert.equal(response.body.series, "F1")
  assert.equal(response.body.drivers[0].driverCode, "ABC")
  assert.equal(response.body.currentLap, 2)
  assert.equal(response.body.drivers[0].gap, "—")
  assert.equal(response.body.drivers[0].interval, "—")
  assert.equal(response.body.drivers[1].gap, "+2.345")
  assert.equal(response.body.drivers[1].interval, "+2.345")
  assert.equal(response.body.drivers[1].pitStops, 1)
  assert.equal(response.body.drivers[1].retired, null)
  assert.equal(response.body.safetyCar, false)
  assert.equal(response.body.virtualSafetyCar, true)
  assert.equal(response.body.redFlag, false)
  assert.deepEqual(calls.map(call => call.endpoint).sort(), ["drivers", "intervals", "laps", "pit", "position", "race_control", "sessions"])
  assert.ok(calls.every(call => call.signal.timeoutMs === 8000))
  assert.match(response.headers["Cache-Control"], /s-maxage=5/)
})

test("missing optional timing feeds are shown as unknown instead of fabricated values", async () => {
  const now = Date.now()
  const GET = loadRoute(async input => {
    const url = new URL(String(input))
    if (url.pathname.endsWith("/sessions")) return Response.json([{ session_key: 99, date_start: new Date(now - 60000).toISOString(), date_end: new Date(now + 60000).toISOString(), session_name: "Race" }])
    if (url.pathname.endsWith("/drivers")) return Response.json([{ driver_number: 1, name_acronym: "ABC", full_name: "A Driver", team_name: "Team", team_colour: "FF0000" }])
    if (url.pathname.endsWith("/position")) return Response.json([{ driver_number: 1, position: 1, date: new Date(now).toISOString() }])
    if (url.pathname.endsWith("/laps")) return Response.json([{ driver_number: 1, lap_number: 1, lap_duration: 90 }])
    return new Response("unavailable", { status: 503 })
  })
  const response = await GET(request("F1"))
  const driver = response.body.drivers[0]
  assert.equal(driver.gap, "—")
  assert.equal(driver.interval, "—")
  assert.equal(driver.pitStops, null)
  assert.equal(driver.retired, null)
  assert.equal(response.body.safetyCar, null)
  assert.equal(response.body.virtualSafetyCar, null)
  assert.equal(response.body.redFlag, null)
})

test("gap formatting preserves lapped status and rejects non-finite values", () => {
  assert.equal(formatGap("+1 LAP"), "+1 LAP")
  assert.equal(formatGap(Number.NaN), "—")
  assert.equal(formatGap(null), "—")
})

test("no active session returns a short shared cache and a 30-second retry hint", async () => {
  let calls = 0
  const GET = loadRoute(async () => { calls++; return Response.json([]) })
  const response = await GET(request("F1"))
  assert.equal(response.status, 404)
  assert.equal(calls, 1)
  assert.equal(response.headers["Retry-After"], "30")
  assert.match(response.headers["Cache-Control"], /s-maxage=30/)
})

test("invalid series is rejected without contacting OpenF1", async () => {
  const GET = loadRoute(async () => assert.fail("Must not fetch for an invalid series"))
  const response = await GET(request("OTHER"))
  assert.equal(response.status, 400)
})
