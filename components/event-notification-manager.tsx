"use client"

import { useEffect, useState, useRef } from "react"
import { Bell, BellOff, Check, Settings, X } from "lucide-react"
import type { RaceEvent } from "@/lib/types"
import { mainSession, formatTime, SERIES_META } from "@/lib/format"
import { BEIJING_TZ } from "@/lib/format"
import { cn } from "@/lib/utils"

interface EventNotificationManagerProps {
  event: RaceEvent
  onClose: () => void
}

const STORAGE_KEY = "race-notifications-enabled"
const SETTINGS_KEY = "race-notification-settings"

type NotificationSettings = {
  remind60: boolean
  remind15: boolean
  remind5: boolean
}

const DEFAULT_SETTINGS: NotificationSettings = {
  remind60: true,
  remind15: true,
  remind5: true,
}

export function EventNotificationManager({ event, onClose }: EventNotificationManagerProps) {
  const [permission, setPermission] = useState<NotificationPermission>("default")
  const [enabled, setEnabled] = useState(false)
  const [settings, setSettings] = useState<NotificationSettings>(DEFAULT_SETTINGS)
  const [showSettings, setShowSettings] = useState(false)
  const timersRef = useRef<Map<string, number>>(new Map())

  useEffect(() => {
    if (typeof window !== "undefined" && "Notification" in window) {
      setPermission(Notification.permission)
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored === "true" && Notification.permission === "granted") {
        setEnabled(true)
      }
      const savedSettings = localStorage.getItem(SETTINGS_KEY)
      if (savedSettings) {
        try {
          setSettings({ ...DEFAULT_SETTINGS, ...JSON.parse(savedSettings) })
        } catch {
          // ignore
        }
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
  }, [enabled, permission, event, settings])

  const clearAllTimers = () => {
    timersRef.current.forEach((id) => clearTimeout(id))
    timersRef.current.clear()
  }

  const scheduleNotifications = () => {
    clearAllTimers()
    const now = Date.now()
    const main = mainSession(event)
    if (!main) return

    const eventTime = new Date(main.utc).getTime()
    const diff = eventTime - now

    const reminders: { minutes: number; label: string; key: keyof NotificationSettings }[] = [
      { minutes: 60, label: "赛前1小时", key: "remind60" },
      { minutes: 15, label: "赛前15分钟", key: "remind15" },
      { minutes: 5, label: "赛前5分钟", key: "remind5" },
    ]

    for (const reminder of reminders) {
      if (!settings[reminder.key]) continue
      const delay = diff - reminder.minutes * 60 * 1000
      if (delay > 0 && delay < 24 * 60 * 60 * 1000) {
        const timerId = window.setTimeout(() => {
          showNotification(event, main.name, reminder.label)
        }, delay)
        timersRef.current.set(`${event.id}-${reminder.minutes}`, timerId)
      }
    }
  }

  const showNotification = (event: RaceEvent, sessionName: string, reminderLabel: string) => {
    const meta = SERIES_META[event.series]
    const title = `${meta.label} · ${event.name}`
    const body = `${reminderLabel}提醒\n${sessionName} ${formatTime(mainSession(event)?.utc ?? "", BEIJING_TZ)} 开始`

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

  const updateSettings = (key: keyof NotificationSettings, value: boolean) => {
    const next = { ...settings, [key]: value }
    setSettings(next)
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(next))
  }

  if (typeof window === "undefined" || !("Notification" in window)) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-md overflow-hidden rounded-2xl border border-border bg-card shadow-2xl">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div className="flex items-center gap-2">
            <Bell className="size-5 text-primary" />
            <h3 className="text-sm font-semibold">设置比赛提醒</h3>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            aria-label="关闭"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div className="rounded-lg bg-secondary/30 p-3">
            <div className="text-xs text-muted-foreground">提醒赛事</div>
            <div className="mt-1 text-sm font-medium">{event.name}</div>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium">通知开关</div>
              <div className="mt-0.5 text-xs text-muted-foreground">
                {enabled
                  ? "将在正赛前发送浏览器通知"
                  : "开启后将在正赛前发送浏览器通知"}
              </div>
            </div>
            <button
              onClick={toggleNotifications}
              className={cn(
                "inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm transition-colors",
                enabled
                  ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-400"
                  : "border-border text-muted-foreground hover:border-primary hover:text-foreground"
              )}
              aria-pressed={enabled}
            >
              {enabled ? (
                <>
                  <Check className="size-4" />
                  已开启
                </>
              ) : (
                <>
                  <Bell className="size-4" />
                  开启
                </>
              )}
            </button>
          </div>

          {enabled && (
            <div className="space-y-3 rounded-lg border border-border bg-secondary/20 p-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium">提醒时间设置</span>
                <button
                  onClick={() => setShowSettings(!showSettings)}
                  className="inline-flex items-center gap-1 rounded-md bg-secondary px-2 py-1 text-xs text-muted-foreground hover:text-foreground"
                  aria-expanded={showSettings}
                >
                  <Settings className="size-3" />
                  {showSettings ? "收起" : "修改"}
                </button>
              </div>
              {showSettings && (
                <div className="flex flex-col gap-2 pt-2 border-t border-border">
                  <label className="flex items-center gap-2 text-xs">
                    <input
                      type="checkbox"
                      checked={settings.remind60}
                      onChange={(e) => updateSettings("remind60", e.target.checked)}
                      className="size-4 rounded border-border"
                    />
                    赛前 1 小时
                  </label>
                  <label className="flex items-center gap-2 text-xs">
                    <input
                      type="checkbox"
                      checked={settings.remind15}
                      onChange={(e) => updateSettings("remind15", e.target.checked)}
                      className="size-4 rounded border-border"
                    />
                    赛前 15 分钟
                  </label>
                  <label className="flex items-center gap-2 text-xs">
                    <input
                      type="checkbox"
                      checked={settings.remind5}
                      onChange={(e) => updateSettings("remind5", e.target.checked)}
                      className="size-4 rounded border-border"
                    />
                    赛前 5 分钟
                  </label>
                </div>
              )}
            </div>
          )}

          {permission === "denied" && (
            <div className="rounded-lg border border-red-500/30 bg-red-500/5 p-3 text-center">
              <BellOff className="mx-auto size-6 text-red-500" />
              <p className="mt-2 text-xs text-red-500">
                浏览器通知权限已被拒绝，请在浏览器设置中允许通知
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}