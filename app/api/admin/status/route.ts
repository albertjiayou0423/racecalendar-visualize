import { NextResponse } from "next/server"
import { fetchF1, fetchFe, fetchWrc } from "@/lib/fetchers"

export const maxDuration = 300

export async function GET() {
  const [f1, fe, wrc] = await Promise.all([fetchF1(), fetchFe(), fetchWrc()])

  return NextResponse.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    services: {
      f1: {
        ok: f1.ok,
        eventCount: f1.events.length,
        note: f1.note,
        status: f1.ok ? "success" : "error",
      },
      fe: {
        ok: fe.ok,
        eventCount: fe.events.length,
        note: fe.note,
        status: fe.ok ? "success" : "error",
      },
      wrc: {
        ok: wrc.ok,
        eventCount: wrc.events.length,
        note: wrc.note,
        status: wrc.ok ? "success" : "error",
      },
    },
  })
}