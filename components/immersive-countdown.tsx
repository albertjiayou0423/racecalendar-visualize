"use client"

import { useEffect, useState, useRef } from "react"
import { X, Radio } from "lucide-react"
import type { RaceEvent } from "@/lib/types"
import { countdown, firstSession, isLive, isPast, mainSession, formatDateTime, SERIES_META } from "@/lib/format"
import { BEIJING_TZ } from "@/lib/format"
import { countryCodeToFlag } from "@/lib/tz"
import { cn } from "@/lib/utils"

interface ImmersiveCountdownProps {
  event: RaceEvent
  now: number
  onClose: () => void
  onLiveStart?: () => void
}

/**
 * 全屏沉浸式开赛模式：
 * - 大号数字滚动动画（CSS transform + key change 实现切换）
 * - 进入后自动锁定背景滚动
 * - 赛道图模糊渐变背景
 * - 开赛瞬间触发 onLiveStart（由父组件处理撒花/提示音）
 */
export function ImmersiveCountdown({ event, now, onClose, onLiveStart }: ImmersiveCountdownProps) {
  const meta = SERIES_META[event.series]
  const first = firstSession(event)
  const main = mainSession(event)
  const flag = countryCodeToFlag(event.countryCode)
  const [mounted, setMounted] = useState(false)

  // 进入动画
  useEffect(() => {
    setMounted(true)
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
  }, [onClose])

  // 开赛瞬间触发回调（仅触发一次）
  const liveTriggeredRef = useRef(false)
  const live = isLive(event, now)
  useEffect(() => {
    if (live && !liveTriggeredRef.current) {
      liveTriggeredRef.current = true
      onLiveStart?.()
    }
  }, [live, onLiveStart])

  if (!first) return null
  const c = countdown(first.utc, now)
  const past = isPast(event, now)

  return (
    <div
      className={cn(
        "fixed inset-0 z-[9998] flex flex-col items-center justify-center transition-opacity duration-300",
        mounted ? "opacity-100" : "opacity-0",
      )}
      style={{
        background: `radial-gradient(ellipse at center, ${meta.color}22 0%, #0a0a0e 70%)`,
      }}
    >
      {/* 背景模糊层 */}
      <div
        className="absolute inset-0 -z-10 opacity-30"
        style={{
          backgroundColor: meta.color,
          filter: "blur(120px)",
          transform: "scale(1.5)",
        }}
        aria-hidden
      />

      {/* 关闭按钮 */}
      <button
        onClick={onClose}
        className="absolute right-4 top-4 rounded-full bg-white/10 p-2 text-white/80 backdrop-blur transition-colors hover:bg-white/20 hover:text-white"
        aria-label="关闭沉浸式模式"
      >
        <X className="size-5" />
      </button>

      {/* 顶部信息 */}
      <div className="absolute left-4 top-4 flex items-center gap-2 text-xs text-white/60 sm:left-6 sm:top-6">
        <span
          className="rounded px-2 py-0.5 font-bold"
          style={{ backgroundColor: meta.color, color: "#fff" }}
        >
          {live ? "LIVE" : meta.label}
        </span>
        {flag && <span aria-hidden>{flag}</span>}
        <span>{event.name}</span>
      </div>

      {/* 主体 */}
      <div className="flex flex-col items-center px-4 text-center">
        {live ? (
          // 进行中
          <div className="flex flex-col items-center gap-6">
            <div className="flex items-center gap-3">
              <span className="relative flex h-4 w-4">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
                <span className="relative inline-flex h-4 w-4 rounded-full bg-red-500" />
              </span>
              <span className="text-5xl font-bold text-red-500 sm:text-7xl">赛事进行中</span>
            </div>
            <p className="text-lg text-white/70">{event.circuit}</p>
            {event.broadcaster && (
              <div className="flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm text-white/80 backdrop-blur">
                <Radio className="size-4" />
                {event.broadcaster.name}
              </div>
            )}
          </div>
        ) : past ? (
          // 已结束
          <div className="flex flex-col items-center gap-4">
            <span className="text-5xl font-bold text-white/40 sm:text-7xl">已结束</span>
          </div>
        ) : (
          // 倒计时
          <>
            <div className="mb-2 text-sm uppercase tracking-[0.3em] text-white/50">距开赛</div>
            <RollingCountdown
              days={c.days}
              hours={c.hours}
              minutes={c.minutes}
              seconds={c.seconds}
              color={meta.color}
            />
            <div className="mt-6 flex flex-col items-center gap-2 text-white/60">
              <div className="flex items-center gap-2">
                <span className="text-xs">北京时间</span>
                <span className="font-mono tabular-nums">{formatDateTime(first.utc, BEIJING_TZ)}</span>
              </div>
              {main && main !== first && (
                <div className="text-xs">
                  主赛事 · {formatDateTime(main.utc, BEIJING_TZ)}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* 底部提示 */}
      <div className="absolute bottom-6 text-center text-[11px] text-white/30">
        按 ESC 或点击关闭退出沉浸式模式
      </div>
    </div>
  )
}

// ─── 数字滚动动画组件 ─────────────────────────────────────────

interface RollingCountdownProps {
  days: number
  hours: number
  minutes: number
  seconds: number
  color: string
}

/**
 * 数字滚动倒计时：
 * 每个数字位使用 key 触发 CSS animation 重新播放，实现切换动效。
 * 大字号、tabular-nums 保证视觉稳定。
 */
function RollingCountdown({ days, hours, minutes, seconds, color }: RollingCountdownProps) {
  const hasDays = days > 0

  return (
    <div className="flex items-end justify-center gap-2 sm:gap-4">
      {hasDays && (
        <RollingUnit value={days} label="天" color={color} size="md" />
      )}
      <RollingUnit value={hours} label="时" color={color} size={hasDays ? "md" : "lg"} />
      <RollingUnit value={minutes} label="分" color={color} size={hasDays ? "md" : "lg"} />
      <RollingUnit value={seconds} label="秒" color={color} size={hasDays ? "md" : "lg"} highlight />
    </div>
  )
}

function RollingUnit({
  value,
  label,
  color,
  size = "lg",
  highlight = false,
}: {
  value: number
  label: string
  color: string
  size?: "md" | "lg"
  highlight?: boolean
}) {
  const display = String(value).padStart(2, "0")
  const sizeClass = size === "lg" ? "text-7xl sm:text-9xl" : "text-5xl sm:text-7xl"

  return (
    <div className="flex flex-col items-center">
      <div className="relative overflow-hidden">
        <div
          key={display}
          className={cn(
            "font-mono font-black tabular-nums",
            sizeClass,
            highlight && "animate-[rollIn_0.4s_ease-out]",
          )}
          style={{
            color: highlight ? color : "#fff",
            textShadow: highlight ? `0 0 40px ${color}66` : "0 0 20px #00000066",
          }}
        >
          {display}
        </div>
      </div>
      <div className="mt-1 text-xs uppercase tracking-widest text-white/40">{label}</div>
    </div>
  )
}
