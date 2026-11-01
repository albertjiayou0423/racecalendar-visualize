import { NextResponse } from "next/server"
import { isSameOrigin } from "@/lib/admin-session"
import { getSql } from "@/lib/db"
import { readLimitedText, CLIENT_CRAWL_LIMIT } from "@/lib/client-crawl"
import { claimClientJobs, submitClientJob } from "@/lib/client-crawl-store"
import { logServerError, logServerWarn } from "@/lib/server-log"

export const dynamic = "force-dynamic"
const headers = { "Cache-Control": "no-store" }
export async function POST(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({ ok: false }, { status: 403, headers })
  if (!getSql()) {
    logServerWarn("api.client_crawl.database_unavailable", { phase: "request" })
    return NextResponse.json({ ok: false, saved: false, reason: "database-unavailable" }, { status: 503, headers })
  }
  if (Number(request.headers.get("content-length")) > CLIENT_CRAWL_LIMIT) return NextResponse.json({ ok: false }, { status: 413, headers })
  let input: any
  try { input = JSON.parse(await readLimitedText(request)) } catch { return NextResponse.json({ ok: false }, { status: 400, headers }) }
  if (!input || !["claim", "submit"].includes(input.action)) return NextResponse.json({ ok: false }, { status: 400, headers })
  try {
    if (input.action === "claim") return NextResponse.json({ ok: true, jobs: await claimClientJobs() }, { headers })
    if (typeof input.id !== "string" || !/^(F1|WRC)-\d{1,12}$/.test(input.id) || typeof input.token !== "string" || !/^[a-f0-9]{48}$/.test(input.token)
      || (input.failed !== true && typeof input.raw !== "string")) return NextResponse.json({ ok: false }, { status: 400, headers })
    const result = await submitClientJob(input)
    return NextResponse.json({ ok: true, ...result, published: result.saved }, { headers })
  } catch (error) {
    logServerError("api.client_crawl.job_failed", { action: input.action }, error)
    return NextResponse.json({ ok: false, saved: false }, { status: 503, headers })
  }
}
