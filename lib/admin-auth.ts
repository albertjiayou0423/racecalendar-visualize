import { NextResponse } from "next/server"
import { isSameOrigin, readAdminCookie, verifyAdminSession } from "./admin-session"

export function isAdmin(request: Request): boolean {
  return verifyAdminSession(readAdminCookie(request), process.env.ADMIN_PASSWORD)
}

export function requireAdmin(request: Request): NextResponse | null {
  if (!isAdmin(request)) {
    return NextResponse.json({ ok: false, message: "登录已过期，请重新登录" }, {
      status: 401, headers: { "Cache-Control": "private, no-store" },
    })
  }
  if (!["GET", "HEAD"].includes(request.method) && !isSameOrigin(request)) {
    return NextResponse.json({ ok: false, message: "请求来源无效" }, { status: 403 })
  }
  return null
}
