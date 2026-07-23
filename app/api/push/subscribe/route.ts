import { NextRequest, NextResponse } from "next/server"
import { initDb, getSqlOrFail } from "@/lib/db"

// 保存/删除推送订阅

// POST：保存推送订阅到数据库
export async function POST(request: NextRequest) {
  try {
    await initDb()
    const sql = await getSqlOrFail()

    const body = await request.json()
    const { endpoint, keys } = body

    if (!endpoint || !keys?.p256dh || !keys?.auth) {
      return NextResponse.json(
        { error: "缺少必要的订阅参数" },
        { status: 400 }
      )
    }

    // 使用 ON CONFLICT 实现幂等插入（同一 endpoint 更新密钥）
    await sql`
      INSERT INTO push_subscriptions (endpoint, p256dh, auth)
      VALUES (${endpoint}, ${keys.p256dh}, ${keys.auth})
      ON CONFLICT (endpoint) DO UPDATE SET
        p256dh = EXCLUDED.p256dh,
        auth = EXCLUDED.auth
    `

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("保存推送订阅失败:", err)
    return NextResponse.json(
      { error: "保存订阅失败" },
      { status: 500 }
    )
  }
}

// DELETE：删除推送订阅
export async function DELETE(request: NextRequest) {
  try {
    await initDb()
    const sql = await getSqlOrFail()

    const body = await request.json()
    const { endpoint } = body

    if (!endpoint) {
      return NextResponse.json(
        { error: "缺少 endpoint 参数" },
        { status: 400 }
      )
    }

    await sql`
      DELETE FROM push_subscriptions WHERE endpoint = ${endpoint}
    `

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("删除推送订阅失败:", err)
    return NextResponse.json(
      { error: "删除订阅失败" },
      { status: 500 }
    )
  }
}
