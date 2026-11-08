"use client"

import { useEffect, useState, useRef } from "react"
import { usePlayground } from "./playground-context"
import { Bell, BellOff, Check, Settings, X } from "lucide-react"
import type { RaceEvent } from "@/lib/types"
import { firstSession, formatTime, SERIES_META } from "@/lib/format"
import { BEIJING_TZ } from "@/lib/format"
import { cn } from "@/lib/utils"
import { useAppPreferences, type HomeViewMode } from "@/lib/app-preferences"

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
  const { preferences, updatePreferences } = useAppPreferences()
  const [permission, setPermission] = useState<NotificationPermission>("default")
  const [enabled, setEnabled] = useState(false)
  const [supportsNotifications, setSupportsNotifications] = useState(false)
  const [settings, setSettings] = useState<NotificationSettings>(DEFAULT_SETTINGS)
  const [showSettings, setShowSettings] = useState(false)
  const [settingsTab, setSettingsTab] = useState<"display" | "experience" | "notifications">("display")
  const timersRef = useRef<Map<string, number>>(new Map())
  const settingsDialogRef = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    setSupportsNotifications(typeof window !== "undefined" && "Notification" in window)
  }, [])

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
      const previousHtmlOverflow = document.documentElement.style.overflow
      const previousBodyOverflow = document.body.style.overflow
      document.documentElement.style.overflow = "hidden"
      document.body.style.overflow = "hidden"
      dialog.showModal()
      return () => {
        if (dialog.open) dialog.close()
        document.documentElement.style.overflow = previousHtmlOverflow
        document.body.style.overflow = previousBodyOverflow
      }
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

  return (
    <div>
      <div className="flex items-center gap-1">
        {supportsNotifications && <button
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
        </button>}
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
        onWheelCapture={(event) => event.stopPropagation()}
        onTouchMoveCapture={(event) => event.stopPropagation()}
        className="fixed inset-0 m-auto max-h-[85dvh] w-[min(calc(100vw_-_2rem),32rem)] max-w-none touch-pan-y overscroll-contain overflow-y-auto rounded-2xl border border-border bg-card p-0 text-foreground shadow-2xl backdrop:bg-black/65 backdrop:backdrop-blur-sm"
      >
        <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-4 sm:px-6">
          <div>
            <h2 id="racecalendar-settings-title" className="text-base font-semibold">设置</h2>
            <p id="racecalendar-settings-description" className="mt-1 text-xs text-muted-foreground">
              管理赛历显示、沉浸体验与比赛提醒
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
          <div role="tablist" aria-label="设置类别" className="flex gap-1 rounded-xl bg-background p-1">
            {([
              ["display", "显示"],
              ["experience", "体验"],
              ["notifications", "提醒"],
            ] as const).map(([tab, label]) => (
              <button
                key={tab}
                type="button"
                role="tab"
                aria-selected={settingsTab === tab}
                onClick={() => setSettingsTab(tab)}
                className={cn(
                  "flex-1 rounded-lg px-3 py-2 text-sm transition-colors",
                  settingsTab === tab ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {label}
              </button>
            ))}
          </div>

          {settingsTab === "display" && (
            <div className="space-y-5">
              <section className="space-y-3" aria-labelledby="home-clock-title">
                <div>
                  <h3 id="home-clock-title" className="text-sm font-medium">主页时钟</h3>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">点击首页右上角时钟，也可以随时在这两种时间之间切换。</p>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {([
                    ["user", "用户当地时间", "按此设备的时区显示"],
                    ["utc", "UTC 时间", "全站统一使用 UTC；赛事时间另标各自偏移"],
                  ] as const).map(([mode, title, description]) => (
                    <button
                      key={mode}
                      type="button"
                      aria-pressed={preferences.homeClockMode === mode}
                      onClick={() => updatePreferences({ homeClockMode: mode })}
                      className={cn(
                        "rounded-xl border p-3 text-left transition-colors",
                        preferences.homeClockMode === mode ? "border-primary/60 bg-primary/5" : "border-border hover:border-primary/40",
                      )}
                    >
                      <span className="block text-sm font-medium">{title}</span>
                      <span className="mt-1 block text-xs text-muted-foreground">{description}</span>
                    </button>
                  ))}
                </div>
              </section>

              <section className="space-y-3" aria-labelledby="default-view-title">
                <div>
                  <h3 id="default-view-title" className="text-sm font-medium">默认日历视图</h3>
                  <p className="mt-1 text-xs text-muted-foreground">选择后立即应用，并作为以后打开首页时的默认视图。</p>
                </div>
                <div className="grid grid-cols-4 gap-2">
                  {([
                    ["list", "列表"], ["week", "周"], ["month", "月历"], ["weekend", "周末"],
                  ] as const satisfies readonly (readonly [HomeViewMode, string])[]).map(([mode, label]) => (
                    <button
                      key={mode}
                      type="button"
                      aria-pressed={preferences.defaultHomeView === mode}
                      onClick={() => updatePreferences({ defaultHomeView: mode })}
                      className={cn(
                        "rounded-lg border px-2 py-2 text-xs transition-colors",
                        preferences.defaultHomeView === mode ? "border-primary/60 bg-primary/5 text-foreground" : "border-border text-muted-foreground hover:text-foreground",
                      )}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </section>
            </div>
          )}

          {settingsTab === "experience" && (
            <section aria-labelledby="immersive-preference-title" className="space-y-3">
              <div>
                <h3 id="immersive-preference-title" className="text-sm font-medium">沉浸式体验</h3>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">控制首页是否在正式场次开始前自动进入全屏倒计时。</p>
              </div>
              <label className="flex items-start justify-between gap-4 rounded-xl border border-border p-4">
                <span>
                  <span className="block text-sm font-medium">自动进入沉浸式倒计时</span>
                  <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">仅对已确认时间的场次生效，在开始前两分钟触发；关闭后仍可手动进入。</span>
                </span>
                <input
                  type="checkbox"
                  checked={preferences.autoImmersiveCountdown}
                  onChange={(event) => updatePreferences({ autoImmersiveCountdown: event.target.checked })}
                  className="mt-0.5 size-4 shrink-0 accent-primary"
                />
              </label>
            </section>
          )}

          {settingsTab === "notifications" && (
          <section aria-labelledby="notification-preferences-title" className="space-y-3">
            <div>
              <h3 id="notification-preferences-title" className="text-sm font-medium">比赛提醒</h3>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                {!supportsNotifications
                  ? "当前浏览器不支持网页通知；其他设置仍可正常使用。"
                  : permission === "denied"
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
          )}

          {settingsTab === "notifications" && <p className="text-[11px] leading-relaxed text-muted-foreground">提醒计划保存在当前浏览器中；浏览器关闭后是否送达取决于设备和浏览器能力。</p>}
        </div>
      </dialog>
    </div>
  )
}
