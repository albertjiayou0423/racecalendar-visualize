import { NextRequest, NextResponse } from "next/server"
import { initDb, getSqlOrFail } from "@/lib/db"
import { fetchF1, fetchFe, fetchWrc } from "@/lib/fetchers"
import { buildWrcEvents } from "@/lib/wrc-data"
import type { RaceEvent } from "@/lib/types"
import { SERIES_META, firstSession, formatTime } from "@/lib/format"

// 发送赛前推送通知
// 此端点会被 Vercel Cron 每小时调用一次

export const maxDuration = 300

// 检查即将开始的赛事，向所有订阅者发送推送
export async function GET() {
  return sendPushNotifications()
}

export async function POST() {
  return sendPushNotifications()
}

async function sendPushNotifications() {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  const privateKey = process.env.VAPID_PRIVATE_KEY

  // 如果没有 VAPID keys，返回 501 表示功能不可用
  if (!publicKey || !privateKey) {
    return NextResponse.json(
      { error: "VAPID keys 未配置，Web Push 功能不可用" },
      { status: 501 }
    )
  }

  try {
    // 动态导入 web-push
    const webPush = await import("web-push")
    webPush.default.setVapidDetails(
      "mailto:noreply@race-calendar.app",
      publicKey,
      privateKey
    )

    // 获取即将开始的赛事
    const upcomingEvents = await getUpcomingEvents()
    if (upcomingEvents.length === 0) {
      return NextResponse.json({ message: "没有即将开始的赛事", sent: 0 })
    }

    // 获取所有推送订阅
    await initDb()
    const sql = await getSqlOrFail()
    const subscriptions = await sql`
      SELECT endpoint, p256dh, auth FROM push_subscriptions
    `

    if (subscriptions.length === 0) {
      return NextResponse.json({ message: "没有推送订阅者", sent: 0 })
    }

    let sentCount = 0
    let failedCount = 0
    const endpointsToRemove: string[] = []

    // 向所有订阅者发送推送
    for (const event of upcomingEvents) {
      const first = firstSession(event)
      if (!first) continue

      const meta = SERIES_META[event.series]
      const payload = JSON.stringify({
        title: `${meta.label} · ${event.name}`,
        body: `即将开始！${first.name} ${formatTime(first.utc, "Asia/Shanghai")} 开赛`,
        icon: "/icon.svg",
        tag: `race-upcoming-${event.id}`,
        url: `/event/${event.id}`,
      })

      for (const sub of subscriptions) {
        const pushSubscription = {
          endpoint: sub.endpoint,
          keys: {
            p256dh: sub.p256dh,
            auth: sub.auth,
          },
        }

        try {
          await webPush.default.sendNotification(pushSubscription, payload)
          sentCount++
        } catch (err: unknown) {
          failedCount++
          // 如果订阅已过期或无效（410 Gone），标记删除
          if (
            err instanceof Error &&
            "statusCode" in err &&
            (err as { statusCode: number }).statusCode === 410
          ) {
            endpointsToRemove.push(sub.endpoint)
          }
        }
      }
    }

    // 清理无效的订阅
    if (endpointsToRemove.length > 0) {
      try {
        for (const endpoint of endpointsToRemove) {
          await sql`
            DELETE FROM push_subscriptions WHERE endpoint = ${endpoint}
          `
        }
        console.log(`已清理 ${endpointsToRemove.length} 个无效订阅`)
      } catch (err) {
        console.error("清理无效订阅失败:", err)
      }
    }

    return NextResponse.json({
      message: "推送发送完成",
      events: upcomingEvents.length,
      sent: sentCount,
      failed: failedCount,
      removed: endpointsToRemove.length,
    })
  } catch (err) {
    console.error("推送发送失败:", err)
    return NextResponse.json(
      { error: "推送发送失败" },
      { status: 500 }
    )
  }
}

// 获取未来 1 小时内即将开始的赛事
async function getUpcomingEvents(): Promise<RaceEvent[]> {
  try {
    // 获取赛事数据
    const [f1Result, feResult, wrcResult] = await Promise.all([
      fetchF1().catch(() => ({ events: [], ok: false })),
      fetchFe().catch(() => ({ events: [], ok: false })),
      fetchWrc().catch(() => ({ events: [], ok: false, dataSource: "scraped" })),
    ])

    const wrcEvents = wrcResult.events.length > 0
      ? wrcResult.events
      : buildWrcEvents()

    const allEvents = [...f1Result.events, ...wrcEvents, ...feResult.events]

    const now = Date.now()
    const oneHourLater = now + 60 * 60 * 1000

    // 筛选未来 1 小时内即将开始的赛事
    return allEvents.filter((event) => {
      for (const session of event.sessions) {
        const sessionTime = new Date(session.utc).getTime()
        // 场次在未来 1 小时内开始（且尚未开始超过 5 分钟）
        if (sessionTime > now - 5 * 60 * 1000 && sessionTime <= oneHourLater) {
          return true
        }
      }
      return false
    })
  } catch (err) {
    console.error("获取即将开始的赛事失败:", err)
    return []
  }
}
