import { NextRequest, NextResponse } from "next/server"

const ALLOWED_ORIGINS = new Set([
  "https://upload.wikimedia.org",
  "https://en.wikipedia.org",
])
const ALLOWED_IMAGE_TYPES = new Set([
  "image/avif",
  "image/gif",
  "image/jpeg",
  "image/png",
  "image/webp",
])
const MAX_REDIRECTS = 3
const MAX_IMAGE_BYTES = 8 * 1024 * 1024
const FETCH_TIMEOUT_MS = 10000
const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308])

class ImageProxyError extends Error {
  constructor(readonly status: number, message: string) {
    super(message)
  }
}

function isAllowedUrl(url: URL) {
  return url.protocol === "https:" && !url.username && !url.password && ALLOWED_ORIGINS.has(url.origin)
}

async function cancelBody(response: Response) {
  await response.body?.cancel().catch(() => {})
}

async function fetchAllowedImage(url: URL, signal: AbortSignal) {
  for (let redirectCount = 0; redirectCount <= MAX_REDIRECTS; redirectCount++) {
    const response = await fetch(url, {
      redirect: "manual",
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        Referer: "https://en.wikipedia.org/",
      },
      signal,
    })

    if (!REDIRECT_STATUSES.has(response.status)) return response

    const location = response.headers.get("location")
    await cancelBody(response)
    if (!location || redirectCount === MAX_REDIRECTS) {
      throw new ImageProxyError(502, "Image source redirect is unavailable")
    }

    let nextUrl: URL
    try {
      nextUrl = new URL(location, url)
    } catch {
      throw new ImageProxyError(502, "Image source redirect is invalid")
    }
    if (!isAllowedUrl(nextUrl)) {
      throw new ImageProxyError(502, "Image source redirect is not allowed")
    }
    url = nextUrl
  }

  throw new ImageProxyError(502, "Too many image source redirects")
}

async function readImageBody(response: Response) {
  const declaredLength = Number(response.headers.get("content-length"))
  if (Number.isFinite(declaredLength) && declaredLength > MAX_IMAGE_BYTES) {
    await cancelBody(response)
    throw new ImageProxyError(413, "Image is too large")
  }

  if (!response.body) return new Uint8Array()

  const reader = response.body.getReader()
  const chunks: Uint8Array[] = []
  let totalBytes = 0
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      totalBytes += value.byteLength
      if (totalBytes > MAX_IMAGE_BYTES) {
        await reader.cancel().catch(() => {})
        throw new ImageProxyError(413, "Image is too large")
      }
      chunks.push(value)
    }
  } finally {
    reader.releaseLock()
  }

  const image = new Uint8Array(totalBytes)
  let offset = 0
  for (const chunk of chunks) {
    image.set(chunk, offset)
    offset += chunk.byteLength
  }
  return image
}

export async function GET(request: NextRequest) {
  const rawUrl = request.nextUrl.searchParams.get("url")
  if (!rawUrl) {
    return NextResponse.json({ error: "Missing url parameter" }, { status: 400 })
  }
  if (rawUrl.length > 4096) {
    return NextResponse.json({ error: "URL is too long" }, { status: 400 })
  }

  let url: URL
  try {
    url = new URL(rawUrl)
  } catch {
    return NextResponse.json({ error: "Invalid URL" }, { status: 400 })
  }
  if (!isAllowedUrl(url)) {
    return NextResponse.json({ error: "Origin not allowed" }, { status: 403 })
  }

  try {
    const response = await fetchAllowedImage(url, AbortSignal.timeout(FETCH_TIMEOUT_MS))
    if (!response.ok) {
      await cancelBody(response)
      throw new ImageProxyError(502, "Image source is unavailable")
    }

    const contentType = response.headers.get("content-type")?.split(";")[0].trim().toLowerCase()
    if (!contentType || !ALLOWED_IMAGE_TYPES.has(contentType)) {
      await cancelBody(response)
      throw new ImageProxyError(415, "Image source returned an unsupported image type")
    }

    const image = await readImageBody(response)
    return new NextResponse(image, {
      headers: {
        "Content-Type": contentType,
        "X-Content-Type-Options": "nosniff",
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800",
      },
    })
  } catch (error) {
    const timeout = typeof error === "object" && error !== null && "name" in error && error.name === "TimeoutError"
    if (!(error instanceof ImageProxyError)) console.error("Image proxy error:", error)
    const status = error instanceof ImageProxyError ? error.status : timeout ? 504 : 502
    const message = error instanceof ImageProxyError ? error.message : timeout ? "Image source timed out" : "Image proxy request failed"
    return NextResponse.json({ error: message }, { status, headers: { "Cache-Control": "no-store" } })
  }
}
