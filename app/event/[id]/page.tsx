"use client"

import { useState, useEffect, use } from "react"
import { ArrowLeft, WifiOff, RefreshCw } from "lucide-react"
import type { RaceEvent } from "@/lib/types"
import { SERIES_META } from "@/lib/format"
import { EventHeader } from "@/components/event-header"
import { SessionTimeline } from "@/components/session-timeline"
import { WatchInfo } from "@/components/watch-info"
import { Highlights } from "@/components/highlights"
import { DeepInfo } from "@/components/deep-info"
import { EventNotificationManager } from "@/components/event-notification-manager"

export default function EventDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [event, setEvent] = useState<RaceEvent | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [now, setNow] = useState(Date.now())
  const [notificationManager, setNotificationManager] = useState(false)

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    fetchEvent()
  }, [id])

  async function fetchEvent() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/schedule`)
      if (!res.ok) throw new Error("Failed to fetch schedule")
      const data = await res.json()
      const found = data.events.find((e: RaceEvent) => e.id === id)
      if (!found) {
        setError("赛事不存在")
        setLoading(false)
        return
      }
      setEvent(found)
      setLoading(false)
    } catch (e) {
      setError("加载失败，请重试")
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background p-4">
        <div className="mx-auto max-w-2xl">
          <div className="mb-4 flex items-center gap-2">
            <div className="h-6 w-20 animate-pulse rounded bg-muted" />
          </div>
          <div className="animate-pulse rounded-xl border border-border bg-card p-5">
            <div className="h-4 w-3/4 mb-3 rounded bg-muted" />
            <div className="h-3 w-1/2 mb-4 rounded bg-muted" />
            <div className="grid grid-cols-2 gap-3">
              <div className="h-16 rounded-lg bg-muted" />
              <div className="h-16 rounded-lg bg-muted" />
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background p-4">
        <div className="mx-auto max-w-2xl">
          <button
            onClick={() => window.history.back()}
            className="mb-4 flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-4" />
            返回
          </button>
          <div className="flex flex-col items-center justify-center rounded-xl border border-border bg-card p-8 text-center">
            <WifiOff className="mb-4 size-10 text-muted-foreground" />
            <p className="mb-2 text-sm font-medium">{error}</p>
            <button
              onClick={fetchEvent}
              className="flex items-center gap-1 rounded-md border border-border px-4 py-2 text-sm transition-colors hover:bg-secondary"
            >
              <RefreshCw className="size-4" />
              重试
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (!event) return null

  const meta = SERIES_META[event.series]

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-3">
          <button
            onClick={() => window.history.back()}
            className="flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
            aria-label="返回"
          >
            <ArrowLeft className="size-4" />
            返回赛程
          </button>
          <span className="text-xs font-medium text-muted-foreground">
            {meta.label} · 第 {event.round} 站
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-2xl p-4">
        <EventHeader
          event={event}
          now={now}
          onSetNotification={() => setNotificationManager(true)}
        />
        <SessionTimeline event={event} now={now} />
        <WatchInfo event={event} />
        <Highlights event={event} />
        <DeepInfo event={event} />
      </main>

      {notificationManager && (
        <EventNotificationManager
          event={event}
          onClose={() => setNotificationManager(false)}
        />
      )}
    </div>
  )
}
