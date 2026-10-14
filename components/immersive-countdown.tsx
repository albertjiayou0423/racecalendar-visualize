"use client"

import { useState, useEffect, useRef } from "react"
import { X } from "lucide-react"
import NumberFlow, { NumberFlowGroup } from '@number-flow/react'
import { countdownDisplay } from '@/lib/countdown-display'
import { StartClock } from './start-clock'
import { StartLights } from './start-lights'
import { simulatedStartPhase } from '@/lib/f1-start-state'
import { useF1Start } from '@/lib/use-f1-start'
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
  isRace?: boolean
  entrance?: boolean
  timeZone?: string
}

/** 全屏倒计时：按位滚动，最后半小时显示系列起跑装置。 */
export function ImmersiveCountdown({ targetTime, series, onClose, preview = false, title, isRace = false, entrance = false, timeZone }: ImmersiveCountdownProps) {
  const vibrated = useRef(false)
  useEffect(() => {
    if (!entrance || preview || vibrated.current) return
    vibrated.current = true
    if (window.matchMedia('(pointer: coarse)').matches && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      try { navigator.vibrate?.(35) } catch { /* Unsupported or blocked haptics do not interrupt entry. */ }
    }
  }, [entrance, preview])
  const [clock, setClock] = useState(Date.now)
  const [demoStart, setDemoStart] = useState<number | null>(null)
  const [previewTarget, setPreviewTarget] = useState<number | null>(null)
  const targetMs = preview && previewTarget !== null ? previewTarget : new Date(targetTime).getTime()
  const liveState = useF1Start(targetTime, !preview && series === 'F1' && isRace && targetMs - clock <= 30 * 60000 && clock - targetMs <= 10 * 60000)
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
      setClock(Date.now())
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

  const { total, days, hours, minutes, seconds, showSignals } = countdownDisplay(remaining)
  const elapsed = (clock - (demoStart ?? targetMs)) / 1000
  const automaticProcedure = isRace && series !== 'WRC' && elapsed >= 0 && elapsed <= 600
  const procedure = demoStart !== null || automaticProcedure
  const sim = series === 'WRC' ? { phase: 'waiting', lit: 0 } : simulatedStartPhase(series, elapsed, demoStart !== null)
  const freshLive = demoStart === null && liveState && (clock - Date.parse(liveState.observedAt) < 30000 || ['racing', 'finished', 'delayed'].includes(liveState.phase)) && liveState.phase !== 'unknown' ? liveState : null
  const green = freshLive ? freshLive.phase === 'formation' && !!freshLive.signalAt && clock - Date.parse(freshLive.signalAt) < 30000 : procedure && sim.phase === 'green'
  const blue = !freshLive && procedure && sim.phase === 'blue'
  const started = freshLive ? ['racing', 'finished'].includes(freshLive.phase) : procedure ? sim.phase === 'out' : Number.isFinite(targetMs) && remaining === 0
  const lit = freshLive ? 0 : procedure ? sim.lit : isRace && series !== 'WRC' ? 0 : started ? 0 : Math.min(5, Math.max(0, 6 - total))
  const phaseLabel = freshLive ? ({ formation: '暖胎圈信号', delayed: '发车延迟', racing: '比赛已开始', finished: '场次已结束', unknown: '等待信号' }[freshLive.phase])
    : procedure ? sim.phase === 'green' || sim.phase === 'formation' ? series === 'F1' ? '暖胎圈灯光（模拟）' : '起跑就位绿灯（模拟）' : blue ? '预启动提示（模拟）' : sim.phase === 'red' || sim.phase === 'hold' ? '发车红灯（模拟）' : '灯灭出发（模拟）' : null
  const accentColor = SERIES_COLORS[series]

  return (
    <div
      ref={containerRef}
      className={`race-immersive ${preview ? 'race-immersive-preview' : 'race-immersive-overlay'} ${entrance && !preview ? 'race-wave-entry' : ''} ${total <= 5 ? 'is-final' : ''} ${started ? 'is-started' : ''}`}
      data-series={series}
      role="dialog"
      aria-modal={!preview}
      aria-label="沉浸式倒计时"
    >
      {entrance && !preview && <div className="race-entry-wave" aria-hidden="true"><svg viewBox="0 0 1440 80" preserveAspectRatio="none"><path d="M0 45 Q360 -20 720 40 T1440 35 V80 H0Z" fill="currentColor" /></svg></div>}
      <button
        onClick={onClose}
        className="absolute right-4 top-4 z-20 rounded-full bg-white/10 p-3 text-white/80 backdrop-blur transition-colors hover:bg-white/20 hover:text-white"
        aria-label="关闭"
      >
        <X className="size-5" />
      </button>
      {preview && <button type="button" className="absolute left-4 top-4 z-20 rounded-full bg-white/10 px-3 py-2 text-xs text-white" onClick={() => setPreviewTarget(Date.now() + 10000)}>重播最后 10 秒</button>}
      <header className="relative z-10 px-6 text-center"><p className="text-xs tracking-[0.15em] text-white/40">{series}{demoStart !== null && ' · 发车程序演示'}</p><h2 className="mt-3 max-w-2xl text-sm text-white/85 sm:text-xl">{title || '等待下一场出发'}</h2></header>
      {Number.isFinite(targetMs) && (showSignals || procedure || freshLive) && <div className="race-stage" aria-hidden="true">
        {(series === 'F1' || series === 'FE') && <StartLights series={series} lit={lit} green={green} blue={blue} delayed={freshLive?.phase === 'delayed'} />}
        {series === 'WRC' && <StartClock seconds={total} started={started} now={clock} timeZone={timeZone} />}
      </div>}
      {isRace && series !== 'WRC' && <button type="button" className="relative z-10 mb-5 rounded-full border border-white/15 px-4 py-2 text-xs text-white/60 hover:text-white" onClick={() => setDemoStart(demoStart === null ? Date.now() : null)}>{demoStart === null ? '观看发车程序演示' : '返回赛程倒计时'}</button>}

      <div
        className={`relative z-10 flex w-full flex-col items-center px-4 text-center ${!showSignals ? 'my-12 sm:my-20' : ''}`}
        onClick={(e) => e.stopPropagation()}
      >
        {phaseLabel ? <p className="text-lg text-white/80">{phaseLabel}</p> : !Number.isFinite(targetMs) ? <span className="text-white">时间待确认</span> : started ? (
          <span
            className="race-launch text-5xl font-bold sm:text-7xl"
            style={{ color: accentColor }}
          >
            {demoStart !== null ? '出发' : '赛程时间已到'}
          </span>
        ) : (
          <>
            <div className="mb-6 text-xs text-white/40">距离开赛</div>
            <div className={`race-clock ${days > 0 ? 'has-days' : ''} ${total <= 5 ? 'final-seconds' : ''}`}>
              <NumberFlowGroup>
                {days > 0 && <RollingUnit value={days} label="天" />}
                {total > 5 && <>
                  <RollingUnit value={hours} label="时" />
                  <RollingUnit value={minutes} label="分" maxTens={5} />
                </>}
                <RollingUnit value={seconds} label="秒" maxTens={5} highlight accentColor={accentColor} />
              </NumberFlowGroup>
            </div>
          </>
        )}
      </div>

      <div className="relative z-10 mt-8 px-6 text-center text-[11px] leading-6 text-white/40"><p>{freshLive ? 'F1 实时赛事控制消息 · 灯位为界面演绎，非现场灯具遥测' : procedure ? '按赛程自动播放灯光模拟 · 不代表现场进度' : '按赛程时间倒计时 · 动画并非官方实时发车信号'}</p><p>按 ESC 或关闭按钮返回赛历</p></div>
    </div>
  )
}

function RollingUnit({
  value,
  label,
  highlight,
  accentColor = "#ef4444",
  maxTens,
}: {
  value: number
  label: string
  highlight?: boolean
  accentColor?: string
  maxTens?: number
}) {
  return (
    <div className="race-clock-unit">
      <NumberFlow value={value} locales="en-US" format={{ minimumIntegerDigits: 2, useGrouping: false }}
        trend={-1} digits={maxTens === undefined ? undefined : { 1: { max: maxTens } }}
        transformTiming={{ duration: 420, easing: 'cubic-bezier(.22,1,.36,1)' }}
        spinTiming={{ duration: 520, easing: 'cubic-bezier(.22,1,.36,1)' }}
        opacityTiming={{ duration: 180, easing: 'ease-out' }}
        className="race-flow-number" style={{ color: highlight ? accentColor : '#f5f5f5' }} />
      <div className="mt-3 text-xs text-white/35">{label}</div>
    </div>
  )
}
