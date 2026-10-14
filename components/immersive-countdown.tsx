"use client"

import { useState, useEffect, useRef } from "react"
import { X } from "lucide-react"
import './immersive-countdown.css'
import { useFocusTrap } from "@/lib/use-focus-trap"
import type { Series } from "@/lib/types"

const SERIES_COLORS: Record<Series, string> = {
  F1: "#ef4444",
  WRC: "#3b82f6",
  FE: "#10b981",
}

interface ImmersiveCountdownProps {
  /** 目标 UTC 时间 */
  targetTime: string
  /** 赛事系列 */
  series: Series
  /** 关闭回调 */
  onClose: () => void
  /** Playground 展示模式：嵌入预览区，不覆盖页面或锁定滚动。 */
  preview?: boolean
  title?: string
}

/** 全屏沉浸式倒计时：纯黑背景 + 数字滚动 + 赛事配色 + 归零撒花 */
export function ImmersiveCountdown({ targetTime, series, onClose, preview = false, title }: ImmersiveCountdownProps) {
  const [previewTarget, setPreviewTarget] = useState<number | null>(null)
  const targetMs = preview && previewTarget !== null ? previewTarget : new Date(targetTime).getTime()
  const [remaining, setRemaining] = useState(() => Number.isFinite(targetMs) ? Math.max(0, targetMs - Date.now()) : 0)
  const closeRef = useRef(onClose)
  closeRef.current = onClose
  const containerRef = useRef<HTMLDivElement>(null)

  // 焦点陷阱：限制 Tab 在沉浸式容器内循环
  useFocusTrap(containerRef, !preview)

  // 每秒更新
  useEffect(() => {
    setRemaining(Number.isFinite(targetMs) ? Math.max(0, targetMs - Date.now()) : 0)
    const id = setInterval(() => {
      setRemaining(Number.isFinite(targetMs) ? Math.max(0, targetMs - Date.now()) : 0)
    }, 100)
    return () => clearInterval(id)
  }, [targetMs])

  // 锁定 body 滚动 + ESC 退出
  useEffect(() => {
    if (preview) return

    const prev = document.body.style.overflow
    document.body.style.overflow = "hidden"
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeRef.current()
    }
    document.addEventListener("keydown", onKey)
    return () => {
      document.body.style.overflow = prev
      document.removeEventListener("keydown", onKey)
    }
  }, [preview])

  const total = Math.ceil(remaining / 1000)
  const mins = Math.floor(total / 60)
  const secs = total % 60
  const started = Number.isFinite(targetMs) && remaining === 0
  const lit = started ? 0 : Math.max(0, 6 - total)
  const accentColor = SERIES_COLORS[series]

  return (
    <div
      ref={containerRef}
      className={`race-immersive ${preview ? 'race-immersive-preview' : 'race-immersive-overlay'} ${total <= 5 ? 'is-final' : ''} ${started ? 'is-started' : ''}`}
      data-series={series}
      role="dialog"
      aria-modal={!preview}
      aria-label="沉浸式倒计时"
    >
      <div className="race-atmosphere" aria-hidden="true" />
      <button
        onClick={onClose}
        className="absolute right-4 top-4 z-20 rounded-full bg-white/10 p-3 text-white/80 backdrop-blur transition-colors hover:bg-white/20 hover:text-white"
        aria-label="关闭"
      >
        <X className="size-5" />
      </button>
      {preview && <button type="button" className="absolute left-4 top-4 z-20 rounded-full bg-white/10 px-3 py-2 text-xs text-white" onClick={() => setPreviewTarget(Date.now() + 10000)}>重播最后 10 秒</button>}
      <header className="relative z-10 px-6 text-center"><p className="text-xs tracking-[0.35em] text-white/50">{series} / START SEQUENCE</p><h2 className="mt-3 max-w-2xl text-sm text-white/85 sm:text-xl">{title || '等待下一场出发'}</h2></header>
      <div className="race-stage" aria-hidden="true">
        {series === 'F1' && <div className="race-lights">{Array.from({ length: 5 }, (_, i) => <div key={i} className={`race-light-housing ${i < lit ? 'lit' : ''}`}><i /><i /></div>)}</div>}
        {series === 'WRC' && <><div className="rally-road" /><div className="rally-gate"><span /><span /><span className={started ? 'go' : total <= 5 ? 'ready' : ''} /></div></>}
        {series === 'FE' && <div className={`energy-core ${total <= 5 ? 'charged' : ''}`}><div /><i /><b /></div>}
      </div>

      <div
        className="relative z-10 flex flex-col items-center px-4 text-center"
        onClick={(e) => e.stopPropagation()}
      >
        {!Number.isFinite(targetMs) ? <span className="text-white">时间待确认</span> : started ? (
          <span
            className="race-launch text-5xl font-bold sm:text-7xl"
            style={{ color: accentColor, textShadow: `0 0 40px ${accentColor}66` }}
          >
            出发
          </span>
        ) : (
          <>
            <div className="mb-2 text-sm uppercase tracking-[0.3em] text-white/50">距开赛</div>
            <div className="flex items-end justify-center gap-2 sm:gap-4">
              {total > 5 && <RollingUnit value={mins} label="分" />}
              <RollingUnit value={secs} label="秒" highlight accentColor={accentColor} />
            </div>
          </>
        )}
      </div>

      <div className="relative z-10 mt-8 px-6 text-center text-[11px] leading-6 text-white/40"><p>按赛程时间倒计时 · 动画并非官方实时发车信号</p><p>按 ESC 或关闭按钮返回赛历</p></div>
    </div>
  )
}

function RollingUnit({
  value,
  label,
  highlight,
  accentColor = "#ef4444",
}: {
  value: number
  label: string
  highlight?: boolean
  accentColor?: string
}) {
  const display = String(value).padStart(2, "0")
  return (
    <div className="flex flex-col items-center">
      <div className="relative overflow-hidden">
        <div
          key={display}
          className={`race-number font-mono font-black tabular-nums text-7xl sm:text-9xl ${
            highlight ? "" : "text-white"
          }`}
          style={
            highlight
              ? { color: accentColor, textShadow: `0 0 40px ${accentColor}66` }
              : undefined
          }
        >
          {display}
        </div>
      </div>
      <div className="mt-1 text-xs uppercase tracking-widest text-white/40">{label}</div>
    </div>
  )
}
