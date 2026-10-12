"use client"

import { useState, useEffect, useRef } from "react"
import { X } from "lucide-react"
import { useConfettiBurst } from "@/lib/countdown-hooks"
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
}

/** 全屏沉浸式倒计时：纯黑背景 + 数字滚动 + 赛事配色 + 归零撒花 */
export function ImmersiveCountdown({ targetTime, series, onClose, preview = false }: ImmersiveCountdownProps) {
  const targetMs = new Date(targetTime).getTime()
  const [remaining, setRemaining] = useState(() => Math.max(0, targetMs - Date.now()))
  const { burst } = useConfettiBurst()
  const triggeredRef = useRef(false)
  const containerRef = useRef<HTMLDivElement>(null)

  // 焦点陷阱：限制 Tab 在沉浸式容器内循环
  useFocusTrap(containerRef, !preview)

  // 每秒更新
  useEffect(() => {
    const id = setInterval(() => {
      setRemaining(Math.max(0, targetMs - Date.now()))
    }, 1000)
    return () => clearInterval(id)
  }, [targetMs])

  // 锁定 body 滚动 + ESC 退出
  useEffect(() => {
    if (preview) return

    const prev = document.body.style.overflow
    document.body.style.overflow = "hidden"
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    document.addEventListener("keydown", onKey)
    return () => {
      document.body.style.overflow = prev
      document.removeEventListener("keydown", onKey)
    }
  }, [onClose, preview])

  // 归零触发撒花 + 震动反馈（仅一次）
  useEffect(() => {
    if (!preview && remaining === 0 && !triggeredRef.current) {
      triggeredRef.current = true
      burst(series, "grand")
      // 移动端短震反馈
      if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
        navigator.vibrate(10)
      }
    }
  }, [remaining, burst, series, preview])

  const mins = Math.floor(remaining / 60000)
  const secs = Math.floor((remaining % 60000) / 1000)
  const accentColor = SERIES_COLORS[series]

  return (
    <div
      ref={containerRef}
      className={preview
        ? "relative flex min-h-64 w-full flex-col items-center justify-center overflow-hidden rounded-xl border border-white/10 bg-black px-4 py-10"
        : "fixed inset-0 z-[9998] flex flex-col items-center justify-center bg-black"}
      onClick={onClose}
      role="dialog"
      aria-modal={!preview}
      aria-label="沉浸式倒计时"
    >
      <button
        onClick={onClose}
        className="absolute right-4 top-4 rounded-full bg-white/10 p-2 text-white/80 backdrop-blur transition-colors hover:bg-white/20 hover:text-white"
        aria-label="关闭"
      >
        <X className="size-5" />
      </button>

      <div
        className="flex flex-col items-center px-4 text-center"
        onClick={(e) => e.stopPropagation()}
      >
        {remaining === 0 ? (
          <span
            className="text-5xl font-bold sm:text-7xl animate-pulse"
            style={{ color: accentColor, textShadow: `0 0 40px ${accentColor}66` }}
          >
            开赛！
          </span>
        ) : (
          <>
            <div className="mb-2 text-sm uppercase tracking-[0.3em] text-white/50">距开赛</div>
            <div className="flex items-end justify-center gap-2 sm:gap-4">
              <RollingUnit value={mins} label="分" />
              <RollingUnit value={secs} label="秒" highlight accentColor={accentColor} />
            </div>
          </>
        )}
      </div>

      <div className="absolute bottom-6 text-center text-[11px] text-white/30">按 ESC 退出</div>
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
          className={`font-mono font-black tabular-nums text-7xl sm:text-9xl animate-[rollIn_0.4s_ease-out] ${
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
