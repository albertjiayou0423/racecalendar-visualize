import { NextRequest, NextResponse } from "next/server"

const ALLOWED_ORIGINS = ["https://www.wrc.com"]

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const url = searchParams.get("url")

  if (!url) {
    return NextResponse.json({ error: "Missing url parameter" }, { status: 400 })
  }

  const parsedUrl = new URL(url)
  if (!ALLOWED_ORIGINS.includes(parsedUrl.origin)) {
    return NextResponse.json({ error: "Origin not allowed" }, { status: 403 })
  }

  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
      },
    })

    if (!res.ok) {
      return NextResponse.json({ error: `HTTP ${res.status}` }, { status: res.status })
    }

    const html = await res.text()

    const response = new NextResponse(html, {
      headers: {
        "Content-Type": "text/html",
        "Access-Control-Allow-Origin": "*",
      },
    })

    return response
  } catch (err) {
    console.error("Proxy error:", err)
    return NextResponse.json({ error: "Proxy request failed" }, { status: 500 })
  }
}