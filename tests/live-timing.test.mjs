import assert from "node:assert/strict"
import fs from "node:fs"
import test from "node:test"
import vm from "node:vm"
import ts from "typescript"

function loadRoute(fetchImpl) {
  const source = fs.readFileSync("app/api/live-timing/route.ts", "utf8")
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText
  const exports = {}
  vm.runInNewContext(output, {
    exports,
    require: (name) => {
      assert.equal(name, "next/server")
      return { NextResponse: { json: (body, init = {}) => ({ body, status: 200, ...init }) } }
    },
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
    if (url.pathname.endsWith("/drivers")) return Response.json([{ driver_number: 1, name_acronym: "ABC", full_name: "A Driver", team_name: "Team", team_colour: "FF0000" }])
    if (url.pathname.endsWith("/position")) return Response.json([{ driver_number: 1, position: 1, date: new Date(now).toISOString() }])
    if (url.pathname.endsWith("/laps")) return Response.json([{ driver_number: 1, lap_number: 2, lap_duration: 90.234 }])
    assert.fail(`Unexpected OpenF1 endpoint: ${url.pathname}`)
  })

  const response = await GET(request("F1"))
  assert.equal(response.body.series, "F1")
  assert.equal(response.body.drivers[0].driverCode, "ABC")
  assert.equal(response.body.currentLap, 2)
  assert.deepEqual(calls.map(call => call.endpoint).sort(), ["drivers", "laps", "position", "sessions"])
  assert.ok(calls.every(call => call.signal.timeoutMs === 8000))
  assert.match(response.headers["Cache-Control"], /s-maxage=5/)
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
