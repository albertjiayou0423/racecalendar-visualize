import assert from "node:assert/strict"
import fs from "node:fs"
import test from "node:test"
import vm from "node:vm"
import ts from "typescript"

function loadRoute(fetcher) {
  const source = fs.readFileSync("app/api/image-proxy/route.ts", "utf8")
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText
  const exports = {}
  class FakeNextResponse extends Response {
    static json(body, init) {
      return Response.json(body, init)
    }
  }
  vm.runInNewContext(output, {
    exports,
    require: (name) => {
      assert.equal(name, "next/server")
      return { NextResponse: FakeNextResponse }
    },
    AbortSignal: { timeout: () => new AbortController().signal },
    Response,
    URL,
    fetch: fetcher,
    console: { error() {} },
  })
  return exports.GET
}

function request(url) {
  return { nextUrl: { searchParams: new URLSearchParams(url ? `url=${encodeURIComponent(url)}` : "") } }
}

test("image proxy validates input before making an upstream request", async () => {
  let fetches = 0
  const get = loadRoute(async () => { fetches++; throw new Error("unexpected fetch") })

  assert.equal((await get(request(null))).status, 400)
  assert.equal((await get(request("not a url"))).status, 400)
  assert.equal((await get(request("https://example.com/image.jpg"))).status, 403)
  assert.equal((await get(request("https://user:pass@upload.wikimedia.org/image.jpg"))).status, 403)
  assert.equal(fetches, 0)
})

test("image proxy allows official thumbnail URLs and only follows allowlisted HTTPS redirects", async () => {
  const requested = []
  const get = loadRoute(async (url, init) => {
    requested.push({ url: String(url), redirect: init.redirect })
    if (requested.length === 1) {
      return new Response(null, { status: 302, headers: { location: "https://upload.wikimedia.org/image.png" } })
    }
    return new Response(new Uint8Array([1, 2, 3]), { headers: { "content-type": "image/png; charset=binary" } })
  })

  const response = await get(request("https://thumb.wikimedia.org/wikipedia/commons/thumb/example.png"))
  assert.equal(response.status, 200)
  assert.deepEqual(requested.map((entry) => entry.redirect), ["manual", "manual"])
  assert.equal(new URL(requested[1].url).origin, "https://upload.wikimedia.org")
  assert.equal(response.headers.get("content-type"), "image/png")
  assert.equal(response.headers.get("x-content-type-options"), "nosniff")
  assert.match(response.headers.get("cache-control"), /s-maxage=86400/)
  assert.deepEqual([...new Uint8Array(await response.arrayBuffer())], [1, 2, 3])
})

test("image proxy blocks cross-origin redirects and active or non-image content", async () => {
  let fetches = 0
  const redirectGet = loadRoute(async () => {
    fetches++
    return new Response(null, { status: 302, headers: { location: "https://example.com/internal" } })
  })
  const redirectResponse = await redirectGet(request("https://upload.wikimedia.org/image.jpg"))
  assert.equal(redirectResponse.status, 502)
  assert.equal(fetches, 1)

  const htmlGet = loadRoute(async () => new Response("not an image", { headers: { "content-type": "text/html" } }))
  const htmlResponse = await htmlGet(request("https://upload.wikimedia.org/image.jpg"))
  assert.equal(htmlResponse.status, 415)
  assert.equal(htmlResponse.headers.get("cache-control"), "no-store")

  const svgGet = loadRoute(async () => new Response("<svg><script>alert(1)</script></svg>", {
    headers: { "content-type": "image/svg+xml" },
  }))
  const svgResponse = await svgGet(request("https://upload.wikimedia.org/image.svg"))
  assert.equal(svgResponse.status, 415)
})

test("image proxy rejects oversized bodies before buffering them", async () => {
  let cancelled = false
  const get = loadRoute(async () => new Response(new ReadableStream({ cancel() { cancelled = true } }), {
    headers: { "content-type": "image/png", "content-length": String(8 * 1024 * 1024 + 1) },
  }))

  const response = await get(request("https://upload.wikimedia.org/image.png"))
  assert.equal(response.status, 413)
  assert.equal(cancelled, true)
})

test("image proxy turns upstream timeouts into a bounded gateway response", async () => {
  const get = loadRoute(async () => {
    const error = new Error("timeout")
    error.name = "TimeoutError"
    throw error
  })

  const response = await get(request("https://upload.wikimedia.org/image.jpg"))
  assert.equal(response.status, 504)
  assert.equal(response.headers.get("cache-control"), "no-store")
})
