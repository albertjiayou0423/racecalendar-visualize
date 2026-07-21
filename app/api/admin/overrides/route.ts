import { NextResponse } from "next/server"
import {
  getAllOverrides,
  saveEventOverride,
  deleteEventOverride,
} from "@/lib/crawl-store"

/** 认证校验：验证 admin_auth cookie */
function checkAuth(request: Request): NextResponse | null {
  if (request.cookies.get("admin_auth")?.value !== "true") {
    return NextResponse.json({ ok: false, message: "未授权" }, { status: 401 })
  }
  return null
}

/** 获取所有覆盖列表 */
export async function GET(request: Request) {
  const authErr = checkAuth(request)
  if (authErr) return authErr

  const overrides = await getAllOverrides()
  return NextResponse.json({ ok: true, data: overrides })
}

/** 创建/更新覆盖 */
export async function POST(request: Request) {
  const authErr = checkAuth(request)
  if (authErr) return authErr

  let body: { eventId: string; data: Record<string, unknown> }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ ok: false, message: "请求体格式错误" }, { status: 400 })
  }

  const { eventId, data } = body
  if (!eventId || !data) {
    return NextResponse.json(
      { ok: false, message: "缺少必要字段：eventId、data" },
      { status: 400 }
    )
  }

  await saveEventOverride(eventId, data)
  return NextResponse.json({ ok: true, message: "覆盖已保存" })
}

/** 删除覆盖 */
export async function DELETE(request: Request) {
  const authErr = checkAuth(request)
  if (authErr) return authErr

  let body: { eventId: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ ok: false, message: "请求体格式错误" }, { status: 400 })
  }

  const { eventId } = body
  if (!eventId) {
    return NextResponse.json(
      { ok: false, message: "缺少必要字段：eventId" },
      { status: 400 }
    )
  }

  await deleteEventOverride(eventId)
  return NextResponse.json({ ok: true, message: "覆盖已删除" })
}
