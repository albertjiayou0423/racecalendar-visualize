import { NextResponse } from "next/server"

export async function POST(request: Request) {
  const { password } = await request.json()
  const adminPassword = process.env.ADMIN_PASSWORD

  if (!adminPassword) {
    return NextResponse.json({ ok: false, message: "管理员密码未配置" }, { status: 500 })
  }

  if (password === adminPassword) {
    const response = NextResponse.json({ ok: true, message: "验证成功" })
    response.cookies.set("admin_auth", "true", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      maxAge: 3600,
      path: "/admin",
    })
    return response
  }

  return NextResponse.json({ ok: false, message: "密码错误" }, { status: 401 })
}

export async function GET(request: Request) {
  const auth = request.cookies.get("admin_auth")
  return NextResponse.json({ authenticated: auth?.value === "true" })
}