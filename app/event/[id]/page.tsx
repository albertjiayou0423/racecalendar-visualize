"use client"

import { useState, useEffect } from "react"
import { ArrowLeft, WifiOff, RefreshCw } from "lucide-react"
import type { RaceEvent } from "@/lib/types"
import { SERIES_META, mainSession, formatDateTime, BEIJING_TZ } from "@/lib/format"
import { countryCodeToFlag } from "@/lib/tz"

export default function EventDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const [id, setId] = useState<string | null>(null)
  const [event, setEvent] = useState<RaceEvent | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [now, setNow] = useState(Date.now())

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    const resolveParams = async () => {
      const resolved = await params
      setId(resolved.id)
    }
    resolveParams()
  }, [params])

  useEffect(() => {
    if (!id) return
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
  const main = mainSession(event)
  const flag = countryCodeToFlag(event.countryCode)

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
        <section className="relative overflow-hidden rounded-2xl border border-border bg-card p-5">
          <div className="absolute inset-x-0 top-0 h-1" style={{ backgroundColor: meta.color }} />
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className="rounded-full px-2 py-0.5 text-xs font-bold"
                  style={{ backgroundColor: meta.color, color: "#fff" }}
                >
                  {meta.label}
                </span>
                <span className="rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground">
                  第 {event.round} 站
                </span>
                {flag && <span aria-hidden>{flag}</span>}
              </div>
              <h1 className="mt-3 text-xl font-bold">{event.name}</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                {event.circuit} · {event.locality}，{event.country}
              </p>
            </div>
            <span className="shrink-0 rounded-full bg-primary/15 px-3 py-1 text-xs font-medium text-primary">
              即将开始
            </span>
          </div>

          {main && (
            <div className="mt-5 rounded-lg bg-secondary/50 p-4">
              <div className="text-xs text-muted-foreground">正赛时间</div>
              <div className="mt-2 flex flex-wrap items-baseline gap-4">
                <div>
                  <div className="text-xs text-muted-foreground">北京时间</div>
                  <div className="text-lg font-bold font-mono tabular-nums">
                    {formatDateTime(main.utc, BEIJING_TZ)}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">当地时间</div>
                  <div className="text-lg font-bold font-mono tabular-nums">
                    {formatDateTime(main.utc, event.tz)}
                  </div>
                </div>
              </div>
            </div>
          )}
        </section>

        <section className="mt-4 rounded-xl border border-border bg-card p-5">
          <h2 className="text-sm font-semibold">赛程时间线</h2>
          <div className="mt-3 space-y-2">
            {event.sessions.map((s, i) => (
              <div key={i} className="rounded-lg border border-border p-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">{s.name}</span>
                  <span className="text-xs text-muted-foreground">未开始</span>
                </div>
                <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-muted-foreground">北京</span>
                    <span className="ml-1 font-mono tabular-nums">{formatDateTime(s.utc, BEIJING_TZ)}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">当地</span>
                    <span className="ml-1 font-mono tabular-nums">{formatDateTime(s.utc, event.tz)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  )
}
