"use client"

import { useRef, useState, useEffect } from "react"
import { toPng } from "html-to-image"
import { Download, ImageIcon, Copy, Check, RotateCcw } from "lucide-react"
import type { RaceEvent } from "@/lib/types"
import {
  BEIJING_TZ,
  SERIES_META,
  countdown,
  formatDateTime,
  mainSession,
  isPast,
  isLive,
} from "@/lib/format"

interface ShareCardProps {
  event: RaceEvent
  now: number
}

/** 系列对应的硬编码颜色（避免 CSS 变量在 html-to-image 中失效） */
const SERIES_COLORS: Record<string, { bg: string; text: string; glow: string }> = {
  F1: { bg: "#ef4444", text: "#fca5a5", glow: "#ef4444" },
  WRC: { bg: "#3b82f6", text: "#93c5fd", glow: "#3b82f6" },
  FE: { bg: "#10b981", text: "#6ee7b7", glow: "#10b981" },
}

export function ShareCard({ event, now }: ShareCardProps) {
  const cardRef = useRef<HTMLDivElement>(null)
  const [generating, setGenerating] = useState(false)
  const [generatedUrl, setGeneratedUrl] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const meta = SERIES_META[event.series]
  const colors = SERIES_COLORS[event.series] ?? SERIES_COLORS.F1
  const main = mainSession(event)
  const past = isPast(event, now)
  const live = isLive(event, now)

  // 倒计时文本
  let countdownText = ""
  if (live) {
    countdownText = "LIVE"
  } else if (past) {
    countdownText = "已结束"
  } else if (main) {
    const cd = countdown(main.utc, now)
    const parts: string[] = []
    if (cd.days > 0) parts.push(`${cd.days}天`)
    if (cd.hours > 0 || cd.days > 0) parts.push(`${cd.hours}时`)
    parts.push(`${cd.minutes}分`)
    countdownText = `${parts.join("")} 后开赛`
  }

  // 生成图片
  const generateImage = async () => {
    if (!cardRef.current) return
    setGenerating(true)
    try {
      const dataUrl = await toPng(cardRef.current, {
        quality: 1,
        pixelRatio: 2,
      })
      setGeneratedUrl(dataUrl)
    } catch (err) {
      console.error("分享卡片生成失败:", err)
    } finally {
      setGenerating(false)
    }
  }

  // 下载图片
  const downloadImage = () => {
    if (!generatedUrl) return
    const link = document.createElement("a")
    link.download = `race-calendar-${event.series}-${event.round}.png`
    link.href = generatedUrl
    link.click()
  }

  // 复制到剪贴板
  const copyToClipboard = async () => {
    if (!generatedUrl) return
    try {
      const res = await fetch(generatedUrl)
      const blob = await res.blob()
      await navigator.clipboard.write([
        new ClipboardItem({ "image/png": blob }),
      ])
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error("复制到剪贴板失败:", err)
    }
  }

  if (!mounted) return null

  return (
    <div className="mt-4 rounded-xl border border-border bg-card p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold">分享卡片</h3>
        <div className="flex gap-2">
          <button
            onClick={generateImage}
            disabled={generating}
            className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
          >
            {generating ? (
              <RotateCcw className="size-3.5 animate-spin" />
            ) : (
              <ImageIcon className="size-3.5" />
            )}
            生成
          </button>
          {generatedUrl && (
            <>
              <button
                onClick={downloadImage}
                className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium transition-colors hover:bg-secondary"
              >
                <Download className="size-3.5" />
                下载
              </button>
              <button
                onClick={copyToClipboard}
                className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium transition-colors hover:bg-secondary"
              >
                {copied ? (
                  <Check className="size-3.5 text-green-500" />
                ) : (
                  <Copy className="size-3.5" />
                )}
                {copied ? "已复制" : "复制"}
              </button>
            </>
          )}
        </div>
      </div>

      {/* 卡片预览容器：缩放显示 1200x630 的卡片 */}
      <div className="flex justify-center overflow-hidden rounded-lg bg-black/5 p-4">
        <div
          ref={cardRef}
          className="relative shrink-0 overflow-hidden text-white"
          style={{ width: 1200, height: 630, transform: "scale(0.45)", transformOrigin: "top left" }}
        >
          {/* 深色渐变背景 */}
          <div className="absolute inset-0 bg-gradient-to-br from-[#0a0a12] via-[#101020] to-[#0a0a12]" />

          {/* 渐变光晕装饰 */}
          <div className="absolute inset-0 opacity-[0.12]">
            <div
              className="absolute -top-32 -right-32 h-80 w-80 rounded-full blur-3xl"
              style={{ backgroundColor: colors.glow }}
            />
            <div className="absolute -bottom-32 -left-32 h-80 w-80 rounded-full bg-blue-600 blur-3xl" />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-60 w-60 rounded-full bg-purple-500/30 blur-3xl" />
          </div>

          {/* 网格纹理 */}
          <div className="absolute inset-0 opacity-[0.03]">
            <div
              className="h-full w-full"
              style={{
                backgroundImage:
                  "linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)",
                backgroundSize: "40px 40px",
              }}
            />
          </div>

          {/* 内容层 */}
          <div className="relative z-10 flex h-full flex-col justify-between p-10">
            {/* 顶部：系列标签 + 圆角色彩标识 */}
            <div className="flex items-center gap-3">
              <div
                className="flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold"
                style={{ backgroundColor: colors.bg }}
              >
                {event.series}
              </div>
              <span className="text-sm font-medium text-white/50">
                {meta.full} · 第 {event.round} 站
              </span>
            </div>

            {/* 中间：赛事名称 + 赛道/地点 */}
            <div className="flex-1 flex flex-col justify-center -mt-4">
              <h1 className="text-5xl font-extrabold leading-tight tracking-tight">
                {event.name}
              </h1>
              <p className="mt-3 text-xl text-white/60">
                {event.circuit}
                <span className="mx-2 text-white/30">·</span>
                {event.locality}
                {event.country && (
                  <>
                    <span className="mx-2 text-white/30">·</span>
                    {event.country}
                  </>
                )}
              </p>
            </div>

            {/* 倒计时 + 正赛时间 + 底部域名 */}
            <div className="space-y-3">
              {/* 倒计时 */}
              {countdownText && (
                <div className="flex items-center gap-3">
                  {live ? (
                    <div className="flex items-center gap-2">
                      <div className="h-3 w-3 animate-pulse rounded-full bg-red-500" />
                      <span className="text-2xl font-bold text-red-400">LIVE</span>
                    </div>
                  ) : past ? (
                    <span className="text-xl font-semibold text-white/40">{countdownText}</span>
                  ) : (
                    <span className="text-xl font-semibold" style={{ color: colors.text }}>
                      {countdownText}
                    </span>
                  )}
                </div>
              )}

              {/* 正赛时间 */}
              {main && (
                <div className="flex items-center gap-6 text-base text-white/50">
                  <div className="flex items-center gap-2">
                    <span className="text-white/30">北京时间</span>
                    <span className="font-mono font-medium text-white/80">
                      {formatDateTime(main.utc, BEIJING_TZ)}
                    </span>
                  </div>
                  {event.tz !== BEIJING_TZ && (
                    <div className="flex items-center gap-2">
                      <span className="text-white/30">当地时间</span>
                      <span className="font-mono font-medium text-white/80">
                        {formatDateTime(main.utc, event.tz)}
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* 底部分隔线 + 域名 */}
              <div className="flex items-center justify-between border-t border-white/10 pt-3">
                <span className="text-sm font-medium tracking-wider text-white/25 uppercase">
                  Race Calendar
                </span>
                <span className="text-sm font-mono text-white/25">
                  racecalendar-visualize.vercel.app
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
