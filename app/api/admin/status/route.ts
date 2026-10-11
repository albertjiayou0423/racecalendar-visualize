import { requireAdmin } from "@/lib/admin-auth"
import { NextResponse } from "next/server"
import { getLatestSnapshot } from "@/lib/crawl-store"

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  const authErr = requireAdmin(request)
  if (authErr) return authErr
  // Inspect persisted data without triggering another full-season crawl or consuming API quota.
  const snapshots = await Promise.all([getLatestSnapshot("F1"), getLatestSnapshot("FE"), getLatestSnapshot("WRC")])
  const [f1, fe, wrc] = snapshots.map(snapshot => ({
    ok: Boolean(snapshot),
    events: snapshot?.data.events ?? [],
    note: snapshot ? `最近成功快照：${new Date(snapshot.fetchedAt).toISOString()}；非实时上游检测` : "暂无成功快照，请在爬虫管理中获取数据",
  }))

  const result = {
    status: "ok",
    timestamp: new Date().toISOString(),
    services: {
      f1: { ok: f1.ok, eventCount: f1.events.length, note: f1.note, status: f1.ok ? "success" : "error" },
      fe: { ok: fe.ok, eventCount: fe.events.length, note: fe.note, status: fe.ok ? "success" : "error" },
      wrc: { ok: wrc.ok, eventCount: wrc.events.length, note: wrc.note, status: wrc.ok ? "success" : "error" },
    },
  }

  return NextResponse.json(result)
}
