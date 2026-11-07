"use client"

import { useEffect, useState, useRef } from "react"
import { usePlayground } from "./playground-context"
import { Bell, BellOff, Check, Settings, X } from "lucide-react"
import type { RaceEvent } from "@/lib/types"
import { firstSession, formatTime, SERIES_META } from "@/lib/format"
import { BEIJING_TZ } from "@/lib/format"
import { cn } from "@/lib/utils"

interface NotificationManagerProps {
  events: RaceEvent[]
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

type ScheduledNotification = {
  eventId: string
  sessionName: string
  time: string
  triggered: boolean
}

export function NotificationManager({ events }: NotificationManagerProps) {
  const playground = usePlayground()
  const [permission, setPermission] = useState<NotificationPermission>("default")
  const [enabled, setEnabled] = useState(false)
  const [settings, setSettings] = useState<NotificationSettings>(DEFAULT_SETTINGS)
  const [showSettings, setShowSettings] = useState(false)
  const timersRef = useRef<Map<string, number>>(new Map())
  const settingsDialogRef = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    if (playground) return
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
    const dialog = settingsDialogRef.current
    if (!dialog) return

    if (showSettings && !dialog.open) {
      dialog.showModal()
    } else if (!showSettings && dialog.open) {
      dialog.close()
    }
  }, [showSettings])

  useEffect(() => {
    if (playground || !enabled || permission !== "granted") {
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

  const toggleNotifications = async () => {
    if (playground) { setEnabled(value => !value); return }
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
    if (!playground) localStorage.setItem(SETTINGS_KEY, JSON.stringify(next))
  }

  if (typeof window === "undefined" || !("Notification" in window)) return null

  return (
    <div>
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
        <button
          type="button"
          onClick={() => setShowSettings(true)}
          className="inline-flex items-center justify-center rounded-full border border-border p-1.5 text-muted-foreground transition-colors hover:border-primary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          aria-label="打开设置"
          title="设置"
        >
          <Settings className="size-3.5" />
        </button>
      </div>

      <dialog
        ref={settingsDialogRef}
        aria-labelledby="racecalendar-settings-title"
        aria-describedby="racecalendar-settings-description"
        onClose={() => setShowSettings(false)}
        onClick={(event) => {
          if (event.target === event.currentTarget) event.currentTarget.close()
        }}
        className="fixed inset-0 m-auto max-h-[85dvh] w-[min(calc(100vw_-_2rem),28rem)] max-w-none overflow-y-auto rounded-2xl border border-border bg-card p-0 text-foreground shadow-2xl backdrop:bg-black/65 backdrop:backdrop-blur-sm"
      >
        <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-4 sm:px-6">
          <div>
            <h2 id="racecalendar-settings-title" className="text-base font-semibold">设置</h2>
            <p id="racecalendar-settings-description" className="mt-1 text-xs text-muted-foreground">
              管理赛前通知和提醒时间
            </p>
          </div>
          <button
            type="button"
            onClick={() => settingsDialogRef.current?.close()}
            className="flex size-8 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            aria-label="关闭设置"
          >
            <X className="size-4" aria-hidden="true" />
          </button>
        </div>

        <div className="space-y-5 p-5 sm:p-6">
          <section aria-labelledby="notification-preferences-title" className="space-y-3">
            <div>
              <h3 id="notification-preferences-title" className="text-sm font-medium">比赛提醒</h3>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                {permission === "denied"
                  ? "浏览器通知权限已关闭，请在浏览器的网站设置中允许通知。"
                  : enabled
                    ? "通知已开启；提醒会在此设备的浏览器中触发。"
                    : "开启上方的通知按钮后，将按选定时间提醒即将开始的赛事。"}
              </p>
            </div>

            <div className="rounded-xl border border-border bg-background/50 p-4">
              <div className="mb-3 text-xs font-medium text-muted-foreground">提醒时间</div>
              <div className="flex flex-col gap-3">
                {([
                  ["remind60", "赛前 1 小时"],
                  ["remind15", "赛前 15 分钟"],
                  ["remind5", "赛前 5 分钟"],
                ] as const).map(([key, label]) => (
                  <label key={key} className="flex min-h-8 items-center justify-between gap-3 text-sm">
                    <span>{label}</span>
                    <input
                      type="checkbox"
                      checked={settings[key]}
                      onChange={(event) => updateSettings(key, event.target.checked)}
                      className="size-4 accent-primary"
                    />
                  </label>
                ))}
              </div>
            </div>
          </section>

          <p className="text-[11px] leading-relaxed text-muted-foreground">
            提醒计划保存在当前浏览器中；浏览器关闭后是否送达取决于设备和浏览器能力。
          </p>
        </div>
      </dialog>
    </div>
  )
}
