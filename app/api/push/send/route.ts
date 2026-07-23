import { NextResponse } from "next/server"
import webpush from "web-push"
import { getSql } from "@/lib/db"

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || ""
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || ""
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || "mailto:admin@racecalendar-visualize.vercel.app"

function getBaseUrl() {
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`
  return "http://localhost:3000"
}

export async function GET() {
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    return NextResponse.json({ ok: false, message: "VAPID 未配置" }, { status: 501 })
  }

  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY)

  const sql = getSql()
  if (!sql) {
    return NextResponse.json({ ok: false, message: "数据库不可用" }, { status: 503 })
  }

  // 获取赛程数据
  let events: any[] = []
  try {
    const res = await fetch(`${getBaseUrl()}/api/schedule`, { next: { revalidate: 0 } })
    const data = await res.json()
    events = data.events || []
  } catch (err) {
    console.error("Failed to fetch schedule for push:", err)
    return NextResponse.json({ ok: false, message: "获取赛程失败" }, { status: 500 })
  }

  const now = Date.now()
  const oneHourLater = now + 60 * 60 * 1000

  // 找到未来1小时内有场次开始的赛事
  const upcomingEvents = events.filter((e: any) => {
    if (!e.sessions) return false
    return e.sessions.some((s: any) => {
      const t = new Date(s.utc).getTime()
      return t > now && t <= oneHourLater
    })
  })

  if (upcomingEvents.length === 0) {
    return NextResponse.json({ ok: true, sent: 0, message: "未来1小时内无赛事" })
  }

  const subs = await sql`SELECT endpoint, p256dh, auth FROM push_subscriptions`
  if (!subs || subs.length === 0) {
    return NextResponse.json({ ok: true, sent: 0, message: "无订阅者" })
  }

  let totalSent = 0
  const deadEndpoints: string[] = []

  for (const event of upcomingEvents) {
    const main = event.sessions.find((s: any) => s.isMain) || event.sessions[0]
    if (!main) continue

    const beijingTime = new Date(new Date(main.utc).getTime() + 8 * 60 * 60 * 1000)
    const timeStr = `${String(beijingTime.getHours()).padStart(2, "0")}:${String(beijingTime.getMinutes()).padStart(2, "0")}`

    for (const sub of subs) {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          JSON.stringify({
            title: `${event.series} · ${event.name}`,
            body: `${main.name} ${timeStr} 即将开始`,
            icon: "/icon.svg",
            tag: event.id,
            url: `/event/${event.id}`,
          })
        )
        totalSent++
      } catch (err: any) {
        if (err.statusCode === 410) deadEndpoints.push(sub.endpoint)
      }
    }
  }

  for (const ep of deadEndpoints) {
    await sql`DELETE FROM push_subscriptions WHERE endpoint = ${ep}`
  }

  return NextResponse.json({ ok: true, sent: totalSent, cleaned: deadEndpoints.length })
}

export const maxDuration = 300
