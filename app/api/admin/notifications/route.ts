import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/admin-auth"
import { getNotificationMonitorSnapshot, sendAdminTestEmail } from "@/lib/notification-mail"
import { logServerError } from "@/lib/server-log"

export const dynamic = "force-dynamic"

const PRIVATE_HEADERS = { "Cache-Control": "private, no-store" }

export async function GET(request: Request) {
  const authError = requireAdmin(request)
  if (authError) return authError

  try {
    const data = await getNotificationMonitorSnapshot()
    return NextResponse.json({ ok: true, data }, { headers: PRIVATE_HEADERS })
  } catch (error) {
    logServerError("api.admin.notifications.read_failed", {}, error)
    return NextResponse.json({ ok: false, message: "读取邮件监控失败，请检查数据库连接" }, { status: 503, headers: PRIVATE_HEADERS })
  }
}

export async function POST(request: Request) {
  const authError = requireAdmin(request)
  if (authError) return authError

  try {
    await sendAdminTestEmail()
    return NextResponse.json({ ok: true, message: "Resend 已接受测试邮件，请检查收件箱" }, { headers: PRIVATE_HEADERS })
  } catch (error) {
    const message = error instanceof Error ? error.message : "测试邮件发送失败"
    logServerError("api.admin.notifications.test_failed", {}, error)
    const status = message.includes("一分钟后再试") ? 429 : message.includes("environment is incomplete") ? 503 : 502
    return NextResponse.json({ ok: false, message: status === 502 ? "测试邮件发送失败，请查看运行日志" : message }, { status, headers: PRIVATE_HEADERS })
  }
}
