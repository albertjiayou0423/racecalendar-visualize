import { NextResponse } from "next/server"
import { getLatestSnapshot, getEventOverride } from "@/lib/crawl-store"
import type { Series, RaceEvent } from "@/lib/types"

/** 支持的系列列表 */
const VALID_SERIES: Series[] = ["F1", "FE", "WRC"]

/** 认证校验：验证 admin_auth cookie */
function checkAuth(request: Request): NextResponse | null {
  if (request.cookies.get("admin_auth")?.value !== "true") {
    return NextResponse.json({ ok: false, message: "未授权" }, { status: 401 })
  }
  return null
}

/** 合并预览：爬虫快照 + 手动覆盖后的最终数据 */
export async function GET(request: Request) {
  const authErr = checkAuth(request)
  if (authErr) return authErr

  const { searchParams } = new URL(request.url)
  const series = searchParams.get("series")?.toUpperCase()

  if (!series || !VALID_SERIES.includes(series as Series)) {
    return NextResponse.json(
      { ok: false, message: "无效的系列参数，可选值：F1、FE、WRC" },
      { status: 400 }
    )
  }

  // 获取最新快照
  const snapshot = await getLatestSnapshot(series as Series)

  if (!snapshot) {
    return NextResponse.json(
      { ok: false, message: "暂无快照数据" },
      { status: 404 }
    )
  }

  // 对每个事件应用覆盖，生成最终数据
  const mergedEvents: RaceEvent[] = await Promise.all(
    snapshot.events.map(async (event: RaceEvent) => {
      const override = await getEventOverride(event.id)
      if (override) {
        return { ...event, ...override } as RaceEvent
      }
      return event
    })
  )

  return NextResponse.json({
    ok: true,
    data: {
      series,
      fetchedAt: snapshot.fetchedAt,
      events: mergedEvents,
    },
  })
}
