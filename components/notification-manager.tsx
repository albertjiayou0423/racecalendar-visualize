"use client"

import { useEffect, useState, useRef, useCallback } from "react"
import { Bell, BellOff, Check, Settings } from "lucide-react"
import type { RaceEvent } from "@/lib/types"
import { firstSession, formatTime, SERIES_META } from "@/lib/format"
import { BEIJING_TZ } from "@/lib/format"
import { cn } from "@/lib/utils"

interface NotificationManagerProps {
  events: RaceEvent[]
}

const STORAGE_KEY = "race-notifications-enabled"
const SETTINGS_KEY = "race-notification-settings"
const PUSH_SUB_KEY = "race-push-subscription"

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

type ScheduledNotification = {
  eventId: string
  sessionName: string
  time: string
  triggered: boolean
}

export function NotificationManager({ events }: NotificationManagerProps) {
  const [permission, setPermission] = useState<NotificationPermission>("default")
  const [enabled, setEnabled] = useState(false)
  const [settings, setSettings] = useState<NotificationSettings>(DEFAULT_SETTINGS)
  const [showSettings, setShowSettings] = useState(false)
  const [pushSupported, setPushSupported] = useState(false)
  const timersRef = useRef<Map<string, number>>(new Map())
  const panelRef = useRef<HTMLDivElement>(null)
  const swRegistrationRef = useRef<ServiceWorkerRegistration | null>(null)

  // 注册 Service Worker
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return

    navigator.serviceWorker
      .register("/sw.js")
      .then((registration) => {
        swRegistrationRef.current = registration
        // 检查是否支持 PushManager
        if ("PushManager" in window) {
          setPushSupported(true)
        }
      })
      .catch((err) => {
        console.error("Service Worker 注册失败:", err)
      })

    // 监听 Service Worker 发来的订阅变更消息
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === "PUSH_SUBSCRIPTION_CHANGED") {
        // 订阅变更，将新订阅发送到服务器
        savePushSubscription(event.data.subscription)
      }
    }
    navigator.serviceWorker.addEventListener("message", handleMessage)
    return () => {
      navigator.serviceWorker.removeEventListener("message", handleMessage)
    }
  }, [])

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

  // 点击外部关闭设置面板
  useEffect(() => {
    if (!showSettings) return
    const handleClick = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setShowSettings(false)
      }
    }
    document.addEventListener("click", handleClick)
    return () => document.removeEventListener("click", handleClick)
  }, [showSettings])

  useEffect(() => {
    if (!enabled || permission !== "granted") {
      clearAllTimers()
      return
    }
    scheduleNotifications()
    return () => clearAllTimers()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, permission, events, settings])

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

  // 保存推送订阅到服务器
  const savePushSubscription = useCallback(async (subscription: PushSubscription | { endpoint: string; keys: { p256dh: string; auth: string } }) => {
    try {
      const subJson = subscription.toJSON ? subscription.toJSON() : subscription
      await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          endpoint: subJson.endpoint,
          keys: subJson.keys,
        }),
      })
      // 缓存订阅信息到 localStorage
      localStorage.setItem(PUSH_SUB_KEY, JSON.stringify(subJson))
    } catch (err) {
      console.error("保存推送订阅失败:", err)
    }
  }, [])

  // 删除推送订阅
  const deletePushSubscription = useCallback(async () => {
    try {
      const cached = localStorage.getItem(PUSH_SUB_KEY)
      if (cached) {
        const subJson = JSON.parse(cached)
        await fetch("/api/push/subscribe", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: subJson.endpoint }),
        })
        localStorage.removeItem(PUSH_SUB_KEY)
      }
    } catch (err) {
      console.error("删除推送订阅失败:", err)
    }
  }, [])

  // 注册 Web Push 订阅
  const registerPushSubscription = useCallback(async () => {
    if (!pushSupported || !swRegistrationRef.current) return

    try {
      // 获取 VAPID 公钥
      const vapidRes = await fetch("/api/push/vapid")
      const vapidData = await vapidRes.json()

      if (!vapidData.available) {
        // VAPID keys 未配置，Web Push 不可用，优雅降级
        console.info("Web Push 不可用（VAPID keys 未配置），仅使用浏览器即时通知")
        return
      }

      const registration = swRegistrationRef.current
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: vapidData.publicKey,
      })

      await savePushSubscription(subscription)
    } catch (err) {
      // Web Push 注册失败，优雅降级，不影响原有通知功能
      console.error("Web Push 注册失败，将使用浏览器即时通知作为 fallback:", err)
    }
  }, [pushSupported, savePushSubscription])

  // 取消 Web Push 订阅
  const unregisterPushSubscription = useCallback(async () => {
    if (!swRegistrationRef.current) return

    try {
      const subscription = await swRegistrationRef.current.pushManager.getSubscription()
      if (subscription) {
        await subscription.unsubscribe()
      }
      await deletePushSubscription()
    } catch (err) {
      console.error("取消 Web Push 订阅失败:", err)
    }
  }, [deletePushSubscription])

  const toggleNotifications = async () => {
    if (enabled) {
      setEnabled(false)
      localStorage.setItem(STORAGE_KEY, "false")
      clearAllTimers()
      // 取消 Web Push 订阅
      await unregisterPushSubscription()
      return
    }

    if (permission === "default") {
      const result = await Notification.requestPermission()
      setPermission(result)
      if (result === "granted") {
        setEnabled(true)
        localStorage.setItem(STORAGE_KEY, "true")
        // 注册 Web Push 订阅
        await registerPushSubscription()
      }
    } else if (permission === "granted") {
      setEnabled(true)
      localStorage.setItem(STORAGE_KEY, "true")
      // 注册 Web Push 订阅
      await registerPushSubscription()
    }
  }

  const updateSettings = (key: keyof NotificationSettings, value: boolean) => {
    const next = { ...settings, [key]: value }
    setSettings(next)
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(next))
  }

  if (typeof window === "undefined" || !("Notification" in window)) return null

  return (
    <div className="relative" ref={panelRef}>
      <div className="flex items-center gap-1">
        <button
          onClick={toggleNotifications}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-xs transition-colors sm:gap-2 sm:px-4",
            enabled
              ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-400"
              : "border-border text-muted-foreground hover:border-primary hover:text-foreground"
          )}
          aria-pressed={enabled}
        >
          {enabled ? (
            <>
              <Check className="size-3.5" />
              <span className="hidden sm:inline">通知已开启</span>
            </>
          ) : (
            <>
              <Bell className="size-3.5" />
              <span className="hidden sm:inline">开启比赛提醒</span>
            </>
          )}
        </button>
        {enabled ? (
          <button
            onClick={(e) => {
              e.stopPropagation()
              setShowSettings((v) => !v)
            }}
            className="inline-flex items-center justify-center rounded-full border border-border p-1.5 text-muted-foreground transition-colors hover:border-primary hover:text-foreground"
            aria-label="通知设置"
          >
            <Settings className="size-3.5" />
          </button>
        ) : null}
      </div>

      {showSettings ? (
        <div className="absolute right-0 top-full z-20 mt-2 w-56 rounded-lg border border-border bg-card p-3 shadow-lg">
          <div className="mb-2 text-xs font-medium text-foreground">提醒时间</div>
          <div className="flex flex-col gap-2">
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
        </div>
      ) : null}
    </div>
  )
}
