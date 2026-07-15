"use client"

import { useEffect, useState, useRef } from "react"
import { Bell, BellOff, Check } from "lucide-react"
import type { RaceEvent } from "@/lib/types"
import { firstSession, formatTime, SERIES_META } from "@/lib/format"
import { BEIJING_TZ } from "@/lib/format"
import { cn } from "@/lib/utils"

interface NotificationManagerProps {
  events: RaceEvent[]
}

const STORAGE_KEY = "race-notifications-enabled"
const SCHEDULED_KEY = "race-notifications-scheduled"

type ScheduledNotification = {
  eventId: string
  sessionName: string
  time: string
  triggered: boolean
}

export function NotificationManager({ events }: NotificationManagerProps) {
  const [permission, setPermission] = useState<NotificationPermission>("default")
  const [enabled, setEnabled] = useState(false)
  const timersRef = useRef<Map<string, number>>(new Map())

  useEffect(() => {
    if (typeof window !== "undefined" && "Notification" in window) {
      setPermission(Notification.permission)
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored === "true" && Notification.permission === "granted") {
        setEnabled(true)
      }
    }
  }, [])

  useEffect(() => {
    if (!enabled || permission !== "granted") {
      clearAllTimers()
      return
    }
    scheduleNotifications()
    return () => clearAllTimers()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, permission, events])

  const clearAllTimers = () => {
    timersRef.current.forEach((id) => clearTimeout(id))
    timersRef.current.clear()
  }

  const scheduleNotifications = () => {
    clearAllTimers()

    const now = Date.now()
    const upcoming = events
      .filter((e) => {
        const first = firstSession(e)
        return first && new Date(first.utc).getTime() > now
      })
      .sort((a, b) => {
        const fa = firstSession(a)?.utc ?? ""
        const fb = firstSession(b)?.utc ?? ""
        return fa.localeCompare(fb)
      })

    const scheduled: ScheduledNotification[] = []

    for (const event of upcoming.slice(0, 5)) {
      const first = firstSession(event)
      if (!first) continue

      const eventTime = new Date(first.utc).getTime()
      const diff = eventTime - now

      const reminders = [
        { minutes: 60, label: "赛前1小时" },
        { minutes: 15, label: "赛前15分钟" },
        { minutes: 5, label: "赛前5分钟" },
      ]

      for (const reminder of reminders) {
        const delay = diff - reminder.minutes * 60 * 1000
        if (delay > 0 && delay < 24 * 60 * 60 * 1000) {
          const timerId = window.setTimeout(() => {
            showNotification(event, first.name, reminder.label)
          }, delay)
          timersRef.current.set(`${event.id}-${reminder.minutes}`, timerId)
          scheduled.push({
            eventId: event.id,
            sessionName: first.name,
            time: first.utc,
            triggered: false,
          })
        }
      }
    }
  }

  const showNotification = (event: RaceEvent, sessionName: string, reminderLabel: string) => {
    const meta = SERIES_META[event.series]
    const title = `${meta.label} · ${event.name}`
    const body = `${reminderLabel}提醒\n${sessionName} ${formatTime(firstSession(event)?.utc ?? "", BEIJING_TZ)} 开始`

    new Notification(title, {
      body,
      icon: "/icon.svg",
      tag: event.id,
    })
  }

  const toggleNotifications = async () => {
    if (enabled) {
      setEnabled(false)
      localStorage.setItem(STORAGE_KEY, "false")
      clearAllTimers()
      return
    }

    if (permission === "default") {
      const result = await Notification.requestPermission()
      setPermission(result)
      if (result === "granted") {
        setEnabled(true)
        localStorage.setItem(STORAGE_KEY, "true")
      }
    } else if (permission === "granted") {
      setEnabled(true)
      localStorage.setItem(STORAGE_KEY, "true")
    }
  }

  if (typeof window === "undefined" || !("Notification" in window)) return null

  return (
    <button
      onClick={toggleNotifications}
      className={cn(
        "inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-xs transition-colors",
        enabled
          ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-400"
          : "border-border text-muted-foreground hover:border-primary hover:text-foreground"
      )}
      aria-pressed={enabled}
    >
      {enabled ? (
        <>
          <Check className="size-3.5" />
          通知已开启
        </>
      ) : (
        <>
          <Bell className="size-3.5" />
          开启比赛提醒
        </>
      )}
    </button>
  )
}
