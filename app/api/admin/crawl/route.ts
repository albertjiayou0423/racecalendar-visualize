import { requireAdmin } from "@/lib/admin-auth"
import { NextResponse } from "next/server"
import {
  getLatestSnapshot,
  getCrawlQuota,
  initCrawlTables,
} from "@/lib/crawl-store"
import { refreshSeries } from "@/lib/schedule-fetch"
import { getSql } from "@/lib/db"
import type { Series } from "@/lib/types"

export const maxDuration = 300
export const dynamic = "force-dynamic"

/** 支持的系列列表 */
const ALL_SERIES: Series[] = ["F1", "FE", "WRC"]

/** 系列名到小写 key 的映射 */
const SERIES_KEY: Record<Series, string> = {
  F1: "f1",
  FE: "fe",
  WRC: "wrc",
}


/** 获取爬虫状态（各系列的最新快照时间、当日爬取配额使用情况） */
export async function GET(request: Request) {
  const authErr = requireAdmin(request)
  if (authErr) return authErr

  const result: Record<string, { lastFetch: string | null; quotaUsed: number; quotaLimit: number }> = {}

  for (const series of ALL_SERIES) {
    const key = SERIES_KEY[series]
    const [snapshot, quota] = await Promise.all([
      getLatestSnapshot(series),
      getCrawlQuota(series),
    ])
    result[key] = {
      lastFetch: snapshot?.fetchedAt ?? null,
      quotaUsed: quota.used,
      quotaLimit: quota.limit,
    }
  }

  return NextResponse.json({ ok: true, data: result })
}

/** 手动触发爬取（单个系列） */
export async function POST(request: Request) {
  const authErr = requireAdmin(request)
  if (authErr) return authErr

  let body: { series: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ ok: false, message: "请求体格式错误" }, { status: 400 })
  }

  const { series } = body
  if (!series || !ALL_SERIES.includes(series as Series)) {
    return NextResponse.json(
      { ok: false, message: "无效的系列，可选值：F1、FE、WRC" },
      { status: 400 }
    )
  }

  if (!getSql()) return NextResponse.json({ ok: false, message: "数据库不可用，无法保存抓取结果" }, { status: 503 })
  await initCrawlTables()

  // 检查配额
  const quota = await getCrawlQuota(series as Series)
  if (series !== "WRC" && quota.used >= quota.limit) {
    return NextResponse.json(
      { ok: false, message: `当日爬取配额已用尽（${quota.used}/${quota.limit}）` },
      { status: 429 }
    )
  }

  const result = await refreshSeries(series as Series, quota.used < quota.limit, "admin-manual")
  if (!result.fresh || result.persistenceError) {
    return NextResponse.json({
      ok: false, message: result.result.note || "获取失败，已有快照已保留",
      fromCache: result.fromCache,
      diagnostics: result.diagnostics,
    }, { status: 502 })
  }
  return NextResponse.json({
    ok: true,
    data: { series, eventCount: result.result.events.length, fetchedAt: new Date().toISOString(), note: result.result.note, diagnostics: result.diagnostics },
  })
}
