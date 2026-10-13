import assert from "node:assert/strict"
import fs from "node:fs"
import test from "node:test"
import vm from "node:vm"
import ts from "typescript"

test("WRC standings share a bounded upstream deadline and return an uncached error on timeout", async () => {
  const source = fs.readFileSync("app/api/wrc-standings/route.ts", "utf8")
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText
  const signal = { sharedDeadline: true }
  const requests = []
  let timeoutMs = 0
  const exports = {}

  vm.runInNewContext(output, {
    exports,
    require: (name) => {
      assert.equal(name, "next/server")
      return { NextResponse: { json: (body, init = {}) => ({ body, ...init }) } }
    },
    AbortSignal: { timeout: (ms) => { timeoutMs = ms; return signal } },
    Response,
    fetch: async (url, init) => {
      requests.push(String(url))
      assert.equal(init.signal, signal)

      if (url.endsWith("/seasons.json")) {
        return Response.json([{ seasonId: 26, name: "World Rally Championship", year: 2026 }])
      }
      if (url.includes("/season-detail.json")) {
        return Response.json({ championships: [{ championshipId: 33, name: "Drivers", type: "Drivers" }] })
      }
      if (url.includes("/championship-detail.json")) return Response.json({ championshipEntries: [] })
      throw new Error("Upstream deadline exceeded")
    },
    console: { error() {} },
  })

  const response = await exports.GET({ nextUrl: { searchParams: new URLSearchParams() } })

  assert.equal(timeoutMs, 9000)
  assert.equal(requests.length, 4)
  assert.equal(response.status, 502)
  assert.equal(response.headers["Cache-Control"], "no-store")
  assert.equal(response.body.ok, false)
})
