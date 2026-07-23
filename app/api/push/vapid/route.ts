import { NextRequest, NextResponse } from "next/server"
import { initDb, getSqlOrFail } from "@/lib/db"

// 返回 VAPID 公钥，供前端注册推送时使用

export async function GET() {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  const privateKey = process.env.VAPID_PRIVATE_KEY

  // 如果没有配置 VAPID keys，返回 501 表示功能不可用
  if (!publicKey || !privateKey) {
    // 尝试动态生成一对 VAPID keys 供参考
    try {
      const webPush = await import("web-push")
      const vapidKeys = webPush.default.generateVAPIDKeys()
      return NextResponse.json(
        {
          available: false,
          message: "VAPID keys 未配置，Web Push 功能不可用。请在环境变量中配置以下 key：",
          hint: {
            NEXT_PUBLIC_VAPID_PUBLIC_KEY: vapidKeys.publicKey,
            VAPID_PRIVATE_KEY: vapidKeys.privateKey,
          },
        },
        { status: 501 }
      )
    } catch {
      return NextResponse.json(
        {
          available: false,
          message: "VAPID keys 未配置，Web Push 功能不可用",
        },
        { status: 501 }
      )
    }
  }

  return NextResponse.json({
    available: true,
    publicKey,
  })
}
