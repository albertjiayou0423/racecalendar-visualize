import { NextResponse } from "next/server"
import {
  getLatestSnapshot,
  getCrawlQuota,
  incrementCrawlCount,
  saveCrawlSnapshot,
} from "@/lib/crawl-store"
import { fetchF1, fetchFe, fetchWrc } from "@/lib/fetchers"
import type { Series } from "@/lib/types"

/** 支持的系列列表 */
const ALL_SERIES: Series[] = ["F1", "FE", "WRC"]

/** 系列名到小写 key 的映射 */
const SERIES_KEY: Record<Series, string> = {
  F1: "f1",
  FE: "fe",
  WRC: "wrc",
}

/** 认证校验：验证 admin_auth cookie */
function checkAuth(request: Request): NextResponse | null {
  if (request.cookies.get("admin_auth")?.value !== "true") {
    return NextResponse.json({ ok: false, message: "未授权" }, { status: 401 })
  }
  return null
}

/** 获取爬虫状态（各系列的最新快照时间、当日爬取配额使用情况） */
export async function GET(request: Request) {
  const authErr = checkAuth(request)
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
  const authErr = checkAuth(request)
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

  // 检查配额
  const quota = await getCrawlQuota(series as Series)
  if (quota.used >= quota.limit) {
    return NextResponse.json(
      { ok: false, message: `当日爬取配额已用尽（${quota.used}/${quota.limit}）` },
      { status: 429 }
    )
  }

  // 执行爬取
  let fetchResult: { events: unknown[]; ok: boolean; note?: string }
  try {
    switch (series) {
      case "F1":
        fetchResult = await fetchF1()
        break
      case "FE":
        fetchResult = await fetchFe()
        break
      case "WRC":
        fetchResult = await fetchWrc()
        break
      default:
        return NextResponse.json({ ok: false, message: "不支持的系列" }, { status: 400 })
    }
  } catch (err) {
    return NextResponse.json(
      { ok: false, message: `爬取失败：${err instanceof Error ? err.message : "未知错误"}` },
      { status: 500 }
    )
  }

  // 递增配额计数
  await incrementCrawlCount(series as Series)

  // 保存快照
  await saveCrawlSnapshot(series as Series, fetchResult)

  return NextResponse.json({
    ok: true,
    data: {
      series,
      eventCount: fetchResult.events.length,
      fetchedAt: new Date().toISOString(),
      note: fetchResult.note,
    },
  })
}
