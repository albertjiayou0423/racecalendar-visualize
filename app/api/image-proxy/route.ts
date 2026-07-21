import { NextRequest, NextResponse } from "next/server"

const ALLOWED_ORIGINS = [
  "https://upload.wikimedia.org",
  "https://en.wikipedia.org",
]

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  let url = searchParams.get("url")

  if (!url) {
    return NextResponse.json({ error: "Missing url parameter" }, { status: 400 })
  }

  try {
    url = decodeURIComponent(url)
  } catch {
  }

  let parsedUrl: URL
  try {
    parsedUrl = new URL(url)
  } catch {
    return NextResponse.json({ error: "Invalid URL" }, { status: 400 })
  }

  if (!ALLOWED_ORIGINS.includes(parsedUrl.origin)) {
    return NextResponse.json({ error: "Origin not allowed" }, { status: 403 })
  }

  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
      },
    })

    if (!res.ok) {
      return NextResponse.json({ error: `HTTP ${res.status}` }, { status: res.status })
    }

    const contentType = res.headers.get("content-type") || "image/png"
    const buffer = await res.arrayBuffer()

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": contentType,
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "public, max-age=86400",
      },
    })
  } catch (err) {
    console.error("Image proxy error:", err)
    return NextResponse.json({ error: "Proxy request failed" }, { status: 500 })
  }
}