"use client"

import { useState, useEffect } from "react"
import { useParams, usePathname, useRouter } from "next/navigation"
import { ArrowLeft, WifiOff, RefreshCw } from "lucide-react"
import type { RaceEvent } from "@/lib/types"
import { SERIES_META } from "@/lib/format"
import { WatchInfo } from "@/components/watch-info"
import { Highlights } from "@/components/highlights"
import { DeepInfo } from "@/components/deep-info"
import { OfficialLiveTiming } from "@/components/official-live-timing"
import { EventNotificationManager } from "@/components/event-notification-manager"
import { EventHeader } from "@/components/event-header"
import { SessionTimeline } from "@/components/session-timeline"
import { NextSessionPill } from "@/components/next-session-pill"
import { PageTransition } from "@/components/page-transition"
import { AIPrediction } from "@/components/ai-prediction"
import { ShareCard } from "@/components/share-card"
import { TrackFlightShare } from "@/components/track-flight-share"
import { parseClientScheduleCache, scheduleFromClientCache } from "@/lib/client-schedule-cache"
import { nextConfirmedSession } from "@/lib/together"
import { TogetherShareButton } from "@/components/together-share-button"

const SCHEDULE_CACHE_KEY = "schedule-cache-v2"
const LEGACY_SCHEDULE_CACHE_KEY = "schedule-cache"
const SCHEDULE_REQUEST_TIMEOUT_MS = 20000

function readCachedEvent(id: string): RaceEvent | null {
  try {
    const raw = localStorage.getItem(SCHEDULE_CACHE_KEY) ?? localStorage.getItem(LEGACY_SCHEDULE_CACHE_KEY)
    const cache = parseClientScheduleCache(raw)
    return cache ? scheduleFromClientCache(cache).events.find((event) => event.id === id) ?? null : null
  } catch {
    return null
  }
}

export default function EventDetailPage() {
  const params = useParams()
  const pathname = usePathname()
  const router = useRouter()
  const id = params?.id as string | undefined
  const [event, setEvent] = useState<RaceEvent | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [stale, setStale] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [now, setNow] = useState(Date.now())
  const [notificationManager, setNotificationManager] = useState(false)

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    if (!id) return
    const controller = new AbortController()
    const cachedEvent = readCachedEvent(id)
    setEvent(cachedEvent)
    setLoading(!cachedEvent)
    setError(null)
    setStale(false)
    void fetchEvent(id, controller.signal, !!cachedEvent)
    return () => controller.abort()
  }, [id])

  async function fetchEvent(targetId = id, parentSignal?: AbortSignal, hasCachedEventOverride = false) {
    if (!targetId) return
    const hasCachedEvent = hasCachedEventOverride || event?.id === targetId
    const controller = new AbortController()
    const abortFromParent = () => controller.abort()
    parentSignal?.addEventListener("abort", abortFromParent, { once: true })
    const timeout = window.setTimeout(() => controller.abort(), SCHEDULE_REQUEST_TIMEOUT_MS)
    setRefreshing(hasCachedEvent)
    if (!hasCachedEvent) setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/schedule", { signal: controller.signal })
      if (!res.ok) throw new Error("Failed to fetch schedule")
      const data = await res.json()
      if (!Array.isArray(data?.events)) throw new Error("Invalid schedule response")
      const found = data.events.find((e: RaceEvent) => e.id === targetId)
      if (!found) {
        if (hasCachedEvent) {
          setStale(true)
        } else {
          setError("赛事不存在")
        }
        setLoading(false)
        return
      }
      setEvent(found)
      setStale(false)
      setLoading(false)
    } catch {
      if (parentSignal?.aborted) return
      if (hasCachedEvent) {
        setStale(true)
      } else {
        setError(controller.signal.aborted ? "加载超时，请重试" : "加载失败，请重试")
      }
      setLoading(false)
    } finally {
      window.clearTimeout(timeout)
      parentSignal?.removeEventListener("abort", abortFromParent)
      if (!parentSignal?.aborted) setRefreshing(false)
    }
  }

  if (!id || loading) {
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
            onClick={() => pathname.startsWith("/new/") ? router.push("/new") : window.history.back()}
            className="mb-4 flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-4" />
            返回
          </button>
          <div className="flex flex-col items-center justify-center rounded-xl border border-border bg-card p-8 text-center">
            <WifiOff className="mb-4 size-10 text-muted-foreground" />
            <p className="mb-2 text-sm font-medium">{error}</p>
            <button
              onClick={() => void fetchEvent()}
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

  if (!event || event.id !== id) return null

  const meta = SERIES_META[event.series]
  const shareSession = nextConfirmedSession(event, now)

  return (
    <div className="min-h-screen bg-background">
      <NextSessionPill event={event} now={now} />
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
        {stale && (
          <div className="mb-4 flex items-center justify-between gap-3 rounded-lg border border-border bg-card px-4 py-3 text-sm text-muted-foreground" role="status">
            <span>赛程暂时无法更新，正在显示上次成功加载的数据。</span>
            <button
              type="button"
              onClick={() => void fetchEvent()}
              disabled={refreshing}
              className="shrink-0 font-medium text-primary hover:underline disabled:opacity-50"
            >
              {refreshing ? "更新中…" : "重试"}
            </button>
          </div>
        )}
        <PageTransition>
          <EventHeader
            event={event}
            now={now}
            onSetNotification={() => setNotificationManager(true)}
          />
          {shareSession && <section className="my-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border px-4 py-3">
            <div><h2 className="text-sm font-semibold">和朋友一起等发车</h2><p className="mt-1 text-xs text-muted-foreground">{shareSession.name} · 打开链接即可同步倒计时</p></div>
            <TogetherShareButton event={event} session={shareSession} />
          </section>}
          <SessionTimeline event={event} now={now} />
          <WatchInfo event={event} />
          <Highlights event={event} />
          <DeepInfo event={event} />
          <AIPrediction event={event} />
          <ShareCard event={event} now={now} />
          <TrackFlightShare event={event} />
          {event.liveTimingUrl && (
            <div className="mt-4">
              <OfficialLiveTiming url={event.liveTimingUrl} eventName={event.name} />
            </div>
          )}
        </PageTransition>
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
