"use client"

import dynamic from "next/dynamic"
import Link from "next/link"
import { ArrowLeft, Clock3, Share2 } from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import type { RaceEvent, RaceSession } from "@/lib/types"
import { BEIJING_TZ, SERIES_META, countdown, formatDateTime } from "@/lib/format"
import { TogetherShareButton } from "@/components/together-share-button"

const ImmersiveCountdown = dynamic(() => import("@/components/immersive-countdown").then((module) => module.ImmersiveCountdown), { ssr: false })

export default function TogetherRoom({ id, utc, sessionName, fromNew }: { id: string; utc: string; sessionName: string; fromNew: boolean }) {
  const [event, setEvent] = useState<RaceEvent | null>(null)
  const [session, setSession] = useState<RaceSession | null>(null)
  const [now, setNow] = useState(Date.now())
  const [loading, setLoading] = useState(true)
  const [immersive, setImmersive] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    if (!id || !utc || !sessionName) {
      setError("分享链接缺少场次信息，请让朋友重新生成链接。")
      setLoading(false)
      return
    }
    const controller = new AbortController()
    void fetch("/api/schedule", { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("赛程暂时无法加载，请稍后重试。")
        const data = await response.json()
        const found = (data.events as RaceEvent[]).find((item) => item.id === id)
        const selected = found?.sessions.find((item) => item.utc === utc && item.name === sessionName)
        if (!found || !selected) throw new Error("这条赛程链接已过期或场次时间已调整，请从赛事卡片重新分享。")
        setEvent(found)
        setSession(selected)
      })
      .catch((cause) => {
        if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "赛程加载失败。")
      })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [id, utc, sessionName])

  const remaining = useMemo(() => countdown(utc, now), [utc, now])
  const targetMs = Date.parse(utc)
  const meta = event ? SERIES_META[event.series] : null
  const returnHref = fromNew ? "/new" : "/"

  if (immersive && event && session) return <ImmersiveCountdown targetTime={session.utc} series={event.series} title={`${event.name} · ${session.name}`} timeZone={event.tz} onClose={() => setImmersive(false)} />

  return <main className="min-h-screen bg-background px-4 py-8 sm:py-14">
    <div className="mx-auto max-w-2xl">
      <Link href={returnHref} className="inline-flex min-h-9 items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"><ArrowLeft size={16} aria-hidden />返回赛历</Link>
      {loading ? <div className="mt-8 animate-pulse rounded-2xl border border-border p-6"><div className="h-4 w-28 rounded bg-muted"/><div className="mt-6 h-16 rounded bg-muted"/></div>
        : error ? <section className="mt-8 rounded-2xl border border-border p-6 sm:p-8"><h1 className="text-xl font-semibold">无法打开共同倒计时</h1><p className="mt-3 text-sm leading-6 text-muted-foreground">{error}</p></section>
          : event && session && meta ? <>
            <header className="mt-8 flex items-center gap-3">
              <span className="inline-flex size-11 shrink-0 items-center justify-center rounded-xl text-sm font-bold" style={{ backgroundColor: meta.color, color: meta.textColor }}>{meta.label}</span>
              <div className="min-w-0"><p className="text-xs text-muted-foreground">一起等发车</p><h1 className="truncate text-xl font-semibold">{event.name}</h1></div>
            </header>
            <section className="mt-5 rounded-2xl border border-border px-5 py-7 text-center sm:px-10 sm:py-10" style={{ borderTopColor: meta.color }}>
              <p className="text-sm text-muted-foreground">{session.name}</p>
              <p className="mt-5 font-mono text-[clamp(2rem,10vw,4.5rem)] font-semibold leading-none tracking-tight tabular-nums" aria-live="off">
                {Number.isFinite(targetMs) && targetMs <= now ? "开赛时间已到" : `${remaining.days > 0 ? `${remaining.days}天 ` : ""}${String(remaining.hours).padStart(2, "0")}:${String(remaining.minutes).padStart(2, "0")}:${String(remaining.seconds).padStart(2, "0")}`}
              </p>
              <p className="mt-5 inline-flex items-center gap-1.5 text-xs text-muted-foreground"><Clock3 size={13} aria-hidden />北京时间 {formatDateTime(session.utc, BEIJING_TZ)} · 当地 {formatDateTime(session.utc, event.tz)}</p>
              <div className="mt-7 flex flex-wrap items-center justify-center gap-2">
                <button type="button" onClick={() => setImmersive(true)} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90" style={{ backgroundColor: meta.color }}><Share2 size={15} aria-hidden />进入沉浸倒计时</button>
                <TogetherShareButton event={event} session={session} />
              </div>
            </section>
            <p className="mt-4 text-center text-xs leading-5 text-muted-foreground">分享链接指向同一场次的绝对开赛时间。朋友打开后会看到同步倒计时；沉浸模式由每个人自行开启。</p>
            <p className="mt-8 text-center"><Link href={`/${fromNew ? "new/" : ""}event/${event.id}`} className="text-sm text-muted-foreground underline-offset-4 hover:underline">查看完整赛事信息</Link></p>
          </> : null}
    </div>
  </main>
}
