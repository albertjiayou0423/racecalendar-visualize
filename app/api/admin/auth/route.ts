import { NextResponse } from "next/server"
import { isAdmin } from "@/lib/admin-auth"
import { ADMIN_COOKIE, SESSION_SECONDS, createAdminSession, isSameOrigin, passwordMatches } from "@/lib/admin-session"

export const dynamic = "force-dynamic"
const headers = { "Cache-Control": "private, no-store" }
const cookieOptions = { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict" as const, path: "/" }

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({ ok: false, message: "请求来源无效" }, { status: 403, headers })
  const secret = process.env.ADMIN_PASSWORD
  if (!secret) return NextResponse.json({ ok: false, message: "管理员密码未配置" }, { status: 503, headers })
  let password: unknown
  try { ;({ password } = await request.json()) }
  catch { return NextResponse.json({ ok: false, message: "请求体格式错误" }, { status: 400, headers }) }
  if (!passwordMatches(password, secret)) return NextResponse.json({ ok: false, message: "密码错误" }, { status: 401, headers })
  const response = NextResponse.json({ ok: true, message: "验证成功" }, { headers })
  response.cookies.set(ADMIN_COOKIE, createAdminSession(secret), { ...cookieOptions, maxAge: SESSION_SECONDS })
  return response
}

export async function GET(request: Request) {
  return NextResponse.json({ authenticated: isAdmin(request) }, { headers })
}

export async function DELETE(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({ ok: false, message: "请求来源无效" }, { status: 403, headers })
  const response = NextResponse.json({ ok: true }, { headers })
  response.cookies.set(ADMIN_COOKIE, "", { ...cookieOptions, maxAge: 0 })
  return response
}
