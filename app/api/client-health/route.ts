import { NextResponse } from "next/server"
import { isSameOrigin } from "@/lib/admin-session"
import { logServerWarn } from "@/lib/server-log"
import { recordClientScheduleFailure } from "@/lib/notification-mail"

export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({ ok: false }, { status: 403 })

  let rawBody: string
  try {
    rawBody = await request.text()
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 })
  }
  if (new TextEncoder().encode(rawBody).byteLength > 256) return NextResponse.json({ ok: false }, { status: 413 })

  let body: unknown
  try {
    body = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 })
  }
  if (!body || typeof body !== "object" || (body as { kind?: unknown }).kind !== "schedule-load-failed") {
    return NextResponse.json({ ok: false }, { status: 400 })
  }

  await recordClientScheduleFailure()
  logServerWarn("api.client_health.schedule_load_failed")
  return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } })
}
