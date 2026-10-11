import test from "node:test"
import assert from "node:assert/strict"
import { createAdminSession, verifyAdminSession, passwordMatches, readAdminCookie, isSameOrigin } from "../lib/admin-session.ts"
import { fetchWithSnapshot, consumesQuota } from "../lib/fetch-with-snapshot.ts"
import { isInspectableTable, quoteIdentifier, pageNumber, HIDDEN_COLUMNS } from "../lib/database-browser.ts"

const now = 1700000000000
const secret = "test-only-admin-password"
test("admin session rejects forged, tampered, expired and rotated credentials", () => {
  const token = createAdminSession(secret, now)
  assert.equal(verifyAdminSession(token, secret, now), true)
  assert.equal(verifyAdminSession("true", secret, now), false)
  assert.equal(verifyAdminSession(token.replace(/^\d/, "9"), secret, now), false)
  assert.equal(verifyAdminSession(token.slice(0, -1) + "!", secret, now), false)
  assert.equal(verifyAdminSession(token, secret, now + 3600000), false)
  assert.equal(verifyAdminSession(token, "rotated-password", now), false)
  assert.equal(verifyAdminSession(token, undefined, now), false)
  assert.notEqual(createAdminSession(secret, now), token)
})
test("login input and cross-site mutation validation", () => {
  assert.equal(passwordMatches(secret, secret), true)
  for (const value of [undefined, {}, 123, "wrong"]) assert.equal(passwordMatches(value, secret), false)
  const request = new Request("https://example.com/api/admin/auth", { headers: { cookie: "other=1; admin_auth=signed-value", origin: "https://example.com" } })
  assert.equal(readAdminCookie(request), "signed-value")
  assert.equal(isSameOrigin(request), true)
  assert.equal(isSameOrigin(new Request(request.url, { headers: { origin: "https://evil.example" } })), false)
  assert.equal(isSameOrigin(new Request(request.url, { headers: { "sec-fetch-site": "cross-site" } })), false)
})

const snapshot = { data: { events: [{ id: "old" }], ok: true }, fetchedAt: "2026-10-10T00:00:00Z" }
for (const scenario of ["throws", "failure", "empty-success"]) {
  test(`upstream ${scenario} uses last successful snapshot without saving failed data`, async () => {
    let writes = 0
    const result = await fetchWithSnapshot({
      fetcher: async () => {
        if (scenario === "throws") throw new Error("offline")
        return { events: [], ok: scenario === "empty-success" }
      }, load: async () => snapshot, save: async () => { writes++ },
    })
    assert.equal(result.fromCache, true)
    assert.equal(result.fresh, false)
    assert.equal(result.result.events[0].id, "old")
    assert.equal(writes, 0)
  })
}
test("no database/no snapshot preserves WRC estimates as unconfirmed", async () => {
  const result = await fetchWithSnapshot({
    fetcher: async () => ({ events: [{ tentative: true }], ok: false }),
    load: async () => null, save: async () => assert.fail("failed data must not be saved"),
  })
  assert.equal(result.result.ok, false)
  assert.equal(result.result.events[0].tentative, true)
})
test("failed historical snapshot is never presented as success", async () => {
  const result = await fetchWithSnapshot({ fetcher: async () => ({ events: [], ok: false }),
    load: async () => ({ ...snapshot, data: { events: [{ id: "bad" }], ok: false } }), save: async () => {},
  })
  assert.equal(result.fromCache, false)
  assert.equal(result.result.ok, false)
})
test("fresh partial success is saved and persistence failure remains explicit", async () => {
  let saved
  const fresh = { events: [{ id: "real" }, { id: "estimate", tentative: true }], ok: true, dataSource: "mixed" }
  const first = await fetchWithSnapshot({ fetcher: async () => fresh, load: async () => snapshot, save: async value => { saved = value } })
  assert.equal(first.fresh, true)
  assert.equal(saved, fresh)
  const failed = await fetchWithSnapshot({ fetcher: async () => fresh, load: async () => snapshot, save: async () => { throw new Error("db offline") } })
  assert.equal(failed.persistenceError, true)
  assert.equal(failed.result.events[0].id, "real")
})
test("WRC official refreshes do not consume third-party quota", () => {
  assert.equal(consumesQuota("WRC", { dataSource: "scraped" }), false)
  assert.equal(consumesQuota("WRC", { dataSource: "api" }), true)
  assert.equal(consumesQuota("WRC", { dataSource: "mixed" }), true)
  assert.equal(consumesQuota("F1", {}), true)
  assert.equal(consumesQuota("FE", {}), true)
})
test("database inspector prevents arbitrary tables and invalid pagination", () => {
  assert.equal(isInspectableTable("crawl_snapshots"), true)
  for (const table of ["users", "pg_authid", "crawl_snapshots; DROP TABLE feedbacks", "public.crawl_snapshots", ""]) assert.equal(isInspectableTable(table), false)
  assert.equal(quoteIdentifier('x"y'), '"x""y"')
  assert.equal(pageNumber(null, 10, 50), 10)
  assert.equal(pageNumber("50", 10, 50), 50)
  for (const value of ["0", "-1", "1.5", "NaN", "51", "1e2"]) assert.equal(pageNumber(value, 10, 50), null)
  assert.equal(HIDDEN_COLUMNS.has("auth"), true)
  assert.equal(HIDDEN_COLUMNS.has("p256dh"), true)
})
