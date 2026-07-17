import { NextResponse } from "next/server"
import { getLatestSnapshot } from "@/lib/crawl-store"
import type { Series } from "@/lib/types"

/** 支持的系列列表 */
const VALID_SERIES: Series[] = ["F1", "FE", "WRC"]

/** 认证校验：验证 admin_auth cookie */
function checkAuth(request: Request): NextResponse | null {
  if (request.cookies.get("admin_auth")?.value !== "true") {
    return NextResponse.json({ ok: false, message: "未授权" }, { status: 401 })
  }
  return null
}

/** 获取指定系列的最新快照数据 */
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

  const snapshot = await getLatestSnapshot(series as Series)

  if (!snapshot) {
    return NextResponse.json(
      { ok: false, message: "暂无快照数据" },
      { status: 404 }
    )
  }

  return NextResponse.json({ ok: true, data: snapshot })
}
