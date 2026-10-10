import test from "node:test"
import assert from "node:assert/strict"
import fs from "node:fs"
import vm from "node:vm"
import { createRequire } from "node:module"
import ts from "typescript"
import * as session from "../lib/admin-session.ts"
import * as browser from "../lib/database-browser.ts"

const require = createRequire(import.meta.url)
const next = require("next/server")
const secret = "local-fixture-admin-password"
function evaluate(path, modules) {
  const source = ts.transpileModule(fs.readFileSync(path, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText
  const exports = {}
  vm.runInNewContext(source, {
    exports, require: name => modules[name], process: { env: { ADMIN_PASSWORD: secret } },
    Buffer, URL, console: { error() {} },
  })
  return exports
}
const auth = evaluate("lib/admin-auth.ts", { "next/server": next, "./admin-session": session })
function route(sql) {
  return evaluate("app/api/admin/database/route.ts", {
    "next/server": next, "@/lib/admin-auth": auth,
    "@/lib/db": { getSql: () => sql }, "@/lib/database-browser": browser,
  }).GET
}
const request = (params = "", cookie = session.createAdminSession(secret)) => new Request(`https://localhost/api/admin/database${params}`, { headers: { cookie: `admin_auth=${cookie}` } })
const login = evaluate("app/api/admin/auth/route.ts", {
  "next/server": next, "@/lib/admin-auth": auth, "@/lib/admin-session": session,
})
test("login issues signed HttpOnly SameSite session and logout expires it", async () => {
  const res = await login.POST(new Request("https://localhost/api/admin/auth", {
    method: "POST", headers: { origin: "https://localhost", "content-type": "application/json" }, body: JSON.stringify({ password: secret }),
  }))
  assert.equal(res.status, 200)
  const cookie = res.headers.get("set-cookie")
  assert.match(cookie, /HttpOnly/i)
  assert.match(cookie, /SameSite=strict/i)
  assert.doesNotMatch(cookie, /admin_auth=true/)
  const token = cookie.match(/admin_auth=([^;]+)/)[1]
  const status = await login.GET(request("", token))
  assert.equal((await status.json()).authenticated, true)
  const logout = await login.DELETE(new Request("https://localhost/api/admin/auth", { method: "DELETE", headers: { origin: "https://localhost" } }))
  assert.match(logout.headers.get("set-cookie"), /Max-Age=0/i)
})
test("login rejects invalid bodies, wrong passwords and cross-origin submissions", async () => {
  assert.equal((await login.POST(new Request("https://localhost/api/admin/auth", { method: "POST", body: "invalid-json" }))).status, 400)
  assert.equal((await login.POST(new Request("https://localhost/api/admin/auth", { method: "POST", body: JSON.stringify({ password: "wrong" }) }))).status, 401)
  assert.equal((await login.POST(new Request("https://localhost/api/admin/auth", { method: "POST", headers: { origin: "https://evil.example" }, body: JSON.stringify({ password: secret }) }))).status, 403)
})
test("database API rejects unauthenticated and forged sessions before any SQL", async () => {
  const sql = () => assert.fail("must authenticate before SQL")
  assert.equal((await route(sql)(request("", "true"))).status, 401)
  assert.equal((await route(sql)(request("", ""))).status, 401)
})
test("missing database returns clear 503", async () => {
  const res = await route(null)(request())
  assert.equal(res.status, 503)
  assert.match((await res.json()).message, /DATABASE_URL/)
})
test("catalog only exposes allowlisted business tables", async () => {
  const sql = async () => [{ name: "crawl_snapshots" }, { name: "private_users" }]
  const res = await route(sql)(request())
  const body = await res.json()
  assert.equal(body.tables.find(table => table.name === "crawl_snapshots").exists, true)
  assert.equal(body.tables.find(table => table.name === "feedbacks").exists, false)
  assert.equal(body.tables.some(table => table.name === "private_users"), false)
  assert.match(res.headers.get("cache-control"), /no-store/)
})
test("table injection and invalid pages are rejected without SQL", async () => {
  const sql = () => assert.fail("invalid parameters must not reach SQL")
  for (const params of ["?table=pg_authid", "?table=crawl_snapshots%3BDELETE", "?table=crawl_snapshots&page=-1", "?pageSize=1000"]) {
    assert.equal((await route(sql)(request(params))).status, 400)
  }
})
test("selected table returns schema, count and parameterized stable pagination", async () => {
  const calls = []
  const sql = async (parts, ...values) => {
    assert.deepEqual(values, ["crawl_snapshots"])
    return parts.join("").includes("information_schema.columns")
      ? [{ name: "id", type: "integer", nullable: "NO" }, { name: "data", type: "jsonb", nullable: "NO" }]
      : [{ name: "id" }]
  }
  sql.query = async (text, values) => {
    calls.push({ text, values })
    return text.includes("count(*)") ? [{ count: "26" }] : [{ id: "25", data: '{"events":[]}' }]
  }
  const res = await route(sql)(request("?table=crawl_snapshots&page=2&pageSize=10"))
  const body = await res.json()
  assert.equal(res.status, 200)
  assert.equal(body.total, 26)
  assert.equal(body.page, 2)
  assert.equal(body.columns.length, 2)
  const rows = calls.find(call => !call.text.includes("count(*)"))
  assert.deepEqual(Array.from(rows.values), [10, 10])
  assert.match(rows.text, /ORDER BY "id" DESC LIMIT \$1 OFFSET \$2/)
  assert.match(rows.text, /left\("data"::text, 16000\)/)
})
test("subscription secrets are excluded by SQL projection, and empty tables work", async () => {
  const sql = async parts => parts.join("").includes("information_schema.columns")
    ? ["id", "endpoint", "p256dh", "auth"].map(name => ({ name, type: "text", nullable: "NO" })) : [{ name: "id" }]
  sql.query = async text => {
    if (text.includes("count(*)")) return [{ count: "0" }]
    for (const field of ["endpoint", "p256dh", "auth"]) assert.ok(text.includes(`'[已隐藏]' AS "${field}"`))
    return []
  }
  const body = await (await route(sql)(request("?table=push_subscriptions"))).json()
  assert.equal(body.total, 0)
  assert.equal(body.rows.length, 0)
})
test("missing tables return 404 and database errors do not leak details", async () => {
  assert.equal((await route(async () => [])(request("?table=feedbacks"))).status, 404)
  const res = await route(async () => { throw new Error("postgres://secret-host/password") })(request())
  assert.equal(res.status, 503)
  assert.doesNotMatch(JSON.stringify(await res.json()), /password|secret-host/)
})
