import { NextRequest, NextResponse } from "next/server"

function allowedImage(value: unknown) {
  if (!value || typeof value !== "object") return undefined
  const image = value as { source?: unknown; width?: unknown; height?: unknown }
  if (typeof image.source !== "string") return undefined
  try {
    const url = new URL(image.source)
    if (url.protocol !== "https:" || url.username || url.password || !["upload.wikimedia.org", "thumb.wikimedia.org"].includes(url.hostname)) return undefined
    return { source: url.href, width: Number(image.width) || 800, height: Number(image.height) || 600 }
  } catch { return undefined }
}
export async function GET(request: NextRequest) {
  const title = request.nextUrl.searchParams.get("title")?.trim()
  if (!title || title.length > 200 || /[\u0000-\u001f]/.test(title)) {
    return NextResponse.json({ ok: false, note: "条目标题无效" }, { status: 400, headers: { "Cache-Control": "no-store" } })
  }
  try {
    const response = await fetch("https://en.wikipedia.org/api/rest_v1/page/summary/" + encodeURIComponent(title), {
      next: { revalidate: 86400 }, signal: AbortSignal.timeout(8000), redirect: "error",
      headers: { "User-Agent": "RaceCalendar/1.0 (public circuit reference)" },
    })
    if (!response.ok) throw new Error("Summary unavailable")
    const summary = await response.json()
    return NextResponse.json({ ok: true, thumbnail: allowedImage(summary.thumbnail), originalimage: allowedImage(summary.originalimage) }, {
      headers: { "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800" },
    })
  } catch {
    return NextResponse.json({ ok: false, note: "参考图片暂不可用" }, { status: 502, headers: { "Cache-Control": "no-store" } })
  }
}
