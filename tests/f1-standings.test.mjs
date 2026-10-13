import assert from "node:assert/strict"
import fs from "node:fs"
import test from "node:test"
import vm from "node:vm"
import ts from "typescript"

function loadRoute(fetchImpl, timeoutImpl = ms => ({ ms })) {
  const source = fs.readFileSync("app/api/f1-standings/route.ts", "utf8")
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText
  const exports = {}
  vm.runInNewContext(output, {
    exports,
    require: name => {
      assert.equal(name, "next/server")
      return { NextResponse: { json: (body, init = {}) => ({ body, ...init }) } }
    },
    AbortSignal: { timeout: timeoutImpl },
    fetch: fetchImpl,
    console: { error() {} },
    Date,
  })
  return exports.GET
}

const request = (query = "") => ({ nextUrl: { searchParams: new URLSearchParams(query) } })

test("F1 standings proxy validates inputs and only requests fixed Jolpica endpoints", async () => {
  const urls = []
  const signals = []
  const GET = loadRoute(async (url, init) => {
    urls.push(String(url))
    signals.push(init.signal)
    return Response.json({ MRData: { StandingsTable: { season: "2026", StandingsLists: [{ round: "18", DriverStandings: [{ position: "1" }] }] } } })
  })

  const invalidType = await GET(request("type=teams"))
  const invalidSeason = await GET(request("season=9999"))
  assert.equal(invalidType.status, 400)
  assert.equal(invalidSeason.status, 400)

  const response = await GET(request("type=drivers"))
  assert.equal(response.status, undefined)
  assert.equal(response.body.ok, true)
  assert.equal(response.body.drivers[0].position, "1")
  assert.match(urls[0], /\/current\/driverStandings\.json\?limit=50$/)
  assert.equal(signals[0].ms, 10000)
  assert.match(response.headers["Cache-Control"], /stale-while-revalidate=86400/)
})

test("F1 standings proxy reports invalid upstream data and disables caching", async () => {
  const GET = loadRoute(async () => Response.json({ MRData: { StandingsTable: { StandingsLists: [] } } }))
  const response = await GET(request("type=constructors"))
  assert.equal(response.status, 502)
  assert.equal(response.body.ok, false)
  assert.equal(response.headers["Cache-Control"], "no-store")
})

test("F1 standings proxy reports upstream timeouts distinctly", async () => {
  const timeout = Object.assign(new Error("timed out"), { name: "TimeoutError" })
  const GET = loadRoute(async () => { throw timeout })
  const response = await GET(request())
  assert.equal(response.status, 502)
  assert.match(response.body.note, /请求超时/)
})
