import { NextResponse } from "next/server"
import { getSql } from "@/lib/db"

export async function POST(request: Request) {
  const sql = getSql()
  if (!sql) {
    return NextResponse.json({ ok: false, message: "数据库不可用" }, { status: 503 })
  }

  try {
    const body = await request.json()
    const { endpoint, keys } = body
    if (!endpoint || !keys?.p256dh || !keys?.auth) {
      return NextResponse.json({ ok: false, message: "参数不完整" }, { status: 400 })
    }

    await sql`
      INSERT INTO push_subscriptions (endpoint, p256dh, auth)
      VALUES (${endpoint}, ${keys.p256dh}, ${keys.auth})
      ON CONFLICT (endpoint) DO UPDATE SET p256dh = EXCLUDED.p256dh, auth = EXCLUDED.auth
    `

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error("Push subscribe error:", err)
    return NextResponse.json({ ok: false, message: "订阅保存失败" }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  const sql = getSql()
  if (!sql) {
    return NextResponse.json({ ok: false, message: "数据库不可用" }, { status: 503 })
  }

  try {
    const body = await request.json()
    const { endpoint } = body
    if (!endpoint) {
      return NextResponse.json({ ok: false, message: "缺少 endpoint" }, { status: 400 })
    }

    await sql`DELETE FROM push_subscriptions WHERE endpoint = ${endpoint}`
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error("Push unsubscribe error:", err)
    return NextResponse.json({ ok: false, message: "取消订阅失败" }, { status: 500 })
  }
}
