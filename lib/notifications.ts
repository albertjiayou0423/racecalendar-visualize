import type { RaceEvent } from "./types"

export interface RaceNotification {
  id: string
  eventId: string
  eventName: string
  series: string
  type: "1h-before" | "30m-before" | "10m-before" | "live"
  scheduledTime: number // UTC 时间戳
  delivered: boolean
  createdAt: number
}

/**
 * 生成该赛事的标准提醒时间点
 * 返回需要创建的通知列表
 */
export function generateNotificationsForEvent(event: RaceEvent): RaceNotification[] {
  const main = event.sessions.find((s) => s.isMain) ?? event.sessions[event.sessions.length - 1]
  if (!main) return []

  const mainTimeMs = new Date(main.utc).getTime()
  const now = Date.now()

  // 只生成未来的提醒
  const reminders = [
    { type: "1h-before" as const, offsetMs: 3600000 },
    { type: "30m-before" as const, offsetMs: 1800000 },
    { type: "10m-before" as const, offsetMs: 600000 },
    { type: "live" as const, offsetMs: 0 },
  ]

  return reminders
    .map((r) => ({
      id: `${event.id}-${r.type}`,
      eventId: event.id,
      eventName: event.name,
      series: event.series,
      type: r.type,
      scheduledTime: mainTimeMs - r.offsetMs,
      delivered: false,
      createdAt: now,
    }))
    .filter((n) => n.scheduledTime > now)
}

/**
 * 获取待发送的通知（已到达时间但未发送）
 */
export function getPendingNotifications(
  notifications: RaceNotification[],
  now: number,
): RaceNotification[] {
  return notifications.filter((n) => !n.delivered && n.scheduledTime <= now)
}

/**
 * 获取下一个通知（最近的待发送通知）
 */
export function getNextNotification(
  notifications: RaceNotification[],
  now: number,
): RaceNotification | null {
  const pending = notifications.filter((n) => !n.delivered && n.scheduledTime > now)
  if (pending.length === 0) return null
  return pending.reduce((a, b) => (a.scheduledTime < b.scheduledTime ? a : b))
}

/** 通知类型的友好显示名称 */
export function notificationTypeLabel(type: RaceNotification["type"]): string {
  const labels: Record<RaceNotification["type"], string> = {
    "1h-before": "1小时前",
    "30m-before": "30分钟前",
    "10m-before": "10分钟前",
    live: "开始直播",
  }
  return labels[type]
}
