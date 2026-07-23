"use client"

import { useRef, useState, useEffect } from "react"
import { toPng } from "html-to-image"
import { Download, ImageIcon, RotateCcw, Copy, Check } from "lucide-react"
import type { RaceEvent } from "@/lib/types"
import { BEIJING_TZ, SERIES_META, countdown, formatDateTime, mainSession, isPast, isLive } from "@/lib/format"

interface ShareCardProps {
  event: RaceEvent
  now: number
}

const SERIES_COLORS: Record<string, string> = {
  F1: "#ef4444",
  WRC: "#3b82f6",
  FE: "#10b981",
}

const CARD_WIDTH = 1200
const CARD_HEIGHT = 630

export function ShareCard({ event, now }: ShareCardProps) {
  const generateRef = useRef<HTMLDivElement>(null)
  const previewRef = useRef<HTMLDivElement>(null)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const [generating, setGenerating] = useState(false)
  const [generatedUrl, setGeneratedUrl] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [scale, setScale] = useState(1)
  const [host, setHost] = useState("")

  const meta = SERIES_META[event.series]
  const main = mainSession(event)
  const live = isLive(event, now)
  const past = isPast(event, now)
  const cd = main ? countdown(main.utc, now) : null

  useEffect(() => {
    if (typeof window !== "undefined") {
      setHost(window.location.hostname)
    }
  }, [])

  // 预览缩放
  useEffect(() => {
    const updateScale = () => {
      if (!wrapperRef.current) return
      const containerWidth = wrapperRef.current.clientWidth
      const s = Math.min(1, Math.max(0.1, (containerWidth - 8) / CARD_WIDTH))
      setScale(s)
    }
    updateScale()
    window.addEventListener("resize", updateScale)
    return () => window.removeEventListener("resize", updateScale)
  }, [])

  const generate = async () => {
    if (!generateRef.current) return
    setGenerating(true)
    try {
      const dataUrl = await toPng(generateRef.current, { quality: 1, pixelRatio: 2 })
      setGeneratedUrl(dataUrl)
    } catch (err) {
      console.error("分享卡片生成失败:", err)
    } finally {
      setGenerating(false)
    }
  }

  const download = () => {
    if (!generatedUrl) return
    const a = document.createElement("a")
    a.download = `${event.id}-share-card.png`
    a.href = generatedUrl
    a.click()
  }

  const copy = async () => {
    if (!generatedUrl) return
    try {
      const res = await fetch(generatedUrl)
      const blob = await res.blob()
      await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })])
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error("复制失败:", err)
    }
  }

  const cardContent = (ref: React.RefObject<HTMLDivElement | null>, isGenerate = false) => (
    <div
      ref={ref}
      className="relative shrink-0 overflow-hidden rounded-xl text-white"
      style={{
        width: CARD_WIDTH,
        height: CARD_HEIGHT,
        padding: 60,
        background: "linear-gradient(135deg, #0a0a12 0%, #101020 50%, #0a0a12 100%)",
      }}
    >
      {/* 背景光晕 */}
      <div className="absolute inset-0 opacity-20 pointer-events-none">
        <div className="absolute -top-40 -right-40 h-80 w-80 rounded-full bg-red-600 blur-[100px]" />
        <div className="absolute -bottom-40 -left-40 h-80 w-80 rounded-full bg-blue-600 blur-[100px]" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-60 w-60 rounded-full bg-purple-600 blur-[100px]" />
      </div>
      {/* 网格 */}
      <div
        className="absolute inset-0 opacity-[0.03] pointer-events-none"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }}
      />

      <div className="relative z-10 flex h-full flex-col justify-between">
        {/* 顶部 */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-3 w-3 rounded-full" style={{ backgroundColor: SERIES_COLORS[event.series] }} />
            <span className="text-sm font-bold tracking-wider">{meta.full}</span>
            <span className="rounded-full border border-white/20 px-2 py-0.5 text-xs text-white/60">
              第 {event.round} 站
            </span>
          </div>
          {live && (
            <span className="flex items-center gap-1.5 rounded-full bg-red-500/20 px-3 py-1 text-xs font-bold text-red-400">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500" />
              </span>
              LIVE
            </span>
          )}
        </div>

        {/* 中间 */}
        <div className="space-y-4">
          <h2 className="text-5xl font-black tracking-tight">{event.name}</h2>
          <p className="text-lg text-white/70">
            {event.circuit} · {event.locality}，{event.country}
          </p>

          {!past && cd && (
            <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm font-medium">
              {live ? (
                <span className="font-bold text-red-400">赛事进行中</span>
              ) : (
                <>
                  <span className="tabular-nums">
                    {cd.days > 0 ? `${cd.days}天 ` : ""}
                    {cd.hours}时 {cd.minutes}分
                  </span>
                  <span className="text-white/50">后开赛</span>
                </>
              )}
            </div>
          )}
          {past && (
            <div className="inline-flex rounded-full bg-white/10 px-4 py-2 text-sm text-white/50">已结束</div>
          )}

          {main && (
            <div className="flex gap-8 text-sm">
              <div>
                <div className="mb-1 text-xs text-white/40">北京时间</div>
                <div className="font-mono text-lg font-bold tabular-nums">
                  {formatDateTime(main.utc, BEIJING_TZ)}
                </div>
              </div>
              <div>
                <div className="mb-1 text-xs text-white/40">当地时间</div>
                <div className="font-mono text-lg font-bold tabular-nums">
                  {formatDateTime(main.utc, event.tz)}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 底部 */}
        <div className="flex items-center justify-between border-t border-white/10 pt-4">
          <span className="text-xs font-bold tracking-widest text-white/30 uppercase">Race Calendar</span>
          <span className="font-mono text-xs text-white/20">{host || "racecalendar-visualize.vercel.app"}</span>
        </div>
      </div>
    </div>
  )

  return (
    <section className="mt-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-medium">分享卡片</h3>
        <div className="flex gap-2">
          <button
            onClick={generate}
            disabled={generating}
            className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
          >
            {generating ? <RotateCcw className="size-3.5 animate-spin" /> : <ImageIcon className="size-3.5" />}
            生成
          </button>
          {generatedUrl && (
            <>
              <button
                onClick={download}
                className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium transition-colors hover:bg-secondary"
              >
                <Download className="size-3.5" />
                下载
              </button>
              <button
                onClick={copy}
                className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium transition-colors hover:bg-secondary"
              >
                {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                {copied ? "已复制" : "复制"}
              </button>
            </>
          )}
        </div>
      </div>

      {/* 预览区（只用于显示） */}
      <div ref={wrapperRef} className="w-full overflow-hidden rounded-xl border border-border bg-black/5 p-4">
        <div
          style={{
            width: CARD_WIDTH,
            height: CARD_HEIGHT,
            transform: `scale(${scale})`,
            transformOrigin: "top left",
            marginBottom: `${CARD_HEIGHT * (scale - 1)}px`,
          }}
        >
          {cardContent(previewRef, false)}
        </div>
      </div>

      {/* 生成用 DOM（屏幕外，专门用于截图） */}
      <div
        className="pointer-events-none absolute left-0 top-0 -z-50"
        style={{ visibility: "hidden", width: 0, height: 0, overflow: "hidden" }}
        aria-hidden="true"
      >
        {cardContent(generateRef, true)}
      </div>
    </section>
  )
}
