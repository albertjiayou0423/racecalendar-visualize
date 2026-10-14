"use client"

import { useState, useEffect, useRef } from "react"
import { X } from "lucide-react"
import NumberFlow, { NumberFlowGroup } from '@number-flow/react'
import { countdownDisplay } from '@/lib/countdown-display'
import { StartClock } from './start-clock'
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
}

/** 全屏倒计时：按位滚动，最后半小时显示系列起跑装置。 */
export function ImmersiveCountdown({ targetTime, series, onClose, preview = false, title, isRace = false }: ImmersiveCountdownProps) {
  const [clock, setClock] = useState(Date.now)
  const [demoStart, setDemoStart] = useState<number | null>(null)
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
  const elapsed = demoStart === null ? 0 : (clock - demoStart) / 1000
  const moving = demoStart !== null && elapsed < 12
  const blue = demoStart !== null && series === 'F1' && elapsed >= 12 && elapsed < 17
  const demoLightStart = series === 'F1' ? 17 : 12
  const signalSeconds = demoStart === null ? total : Math.max(0, Math.ceil(demoLightStart + 5 - elapsed))
  const started = demoStart === null ? Number.isFinite(targetMs) && remaining === 0 : elapsed >= demoLightStart + 5
  const lit = started || moving || blue ? 0 : Math.min(5, Math.max(0, 6 - signalSeconds))
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
      <button
        onClick={onClose}
        className="absolute right-4 top-4 z-20 rounded-full bg-white/10 p-3 text-white/80 backdrop-blur transition-colors hover:bg-white/20 hover:text-white"
        aria-label="关闭"
      >
        <X className="size-5" />
      </button>
      {preview && <button type="button" className="absolute left-4 top-4 z-20 rounded-full bg-white/10 px-3 py-2 text-xs text-white" onClick={() => setPreviewTarget(Date.now() + 10000)}>重播最后 10 秒</button>}
      <header className="relative z-10 px-6 text-center"><p className="text-xs tracking-[0.15em] text-white/40">{series}{demoStart !== null && ' · 发车程序演示'}</p><h2 className="mt-3 max-w-2xl text-sm text-white/85 sm:text-xl">{title || '等待下一场出发'}</h2></header>
      {Number.isFinite(targetMs) && (showSignals || demoStart !== null) && <div className="race-stage" aria-hidden="true">
        {moving ? <div className={`formation-demo ${series === 'FE' ? 'grid-positioning' : ''}`}><svg viewBox="0 0 300 120"><path d="M65 30 H235 A30 30 0 0 1 235 90 H65 A30 30 0 0 1 65 30" /></svg><div className="formation-car" /><p>{series === 'F1' ? '暖胎圈 · 示意路线' : '预备发车区 → 正式发车位'}</p></div> : (series === 'F1' || series === 'FE') && <div className={`race-lights ${blue ? 'pre-start' : ''}`}>{Array.from({ length: 5 }, (_, i) => <div key={i} className={`race-light-housing ${i < lit ? 'lit' : ''}`}><i />{series === 'F1' && <i />}</div>)}</div>}
        {series === 'WRC' && <StartClock seconds={total} started={started} />}
      </div>}
      {isRace && series !== 'WRC' && <button type="button" className="relative z-10 mb-5 rounded-full border border-white/15 px-4 py-2 text-xs text-white/60 hover:text-white" onClick={() => setDemoStart(demoStart === null ? Date.now() : null)}>{demoStart === null ? '观看发车程序演示' : '返回赛程倒计时'}</button>}

      <div
        className={`relative z-10 flex w-full flex-col items-center px-4 text-center ${!showSignals ? 'my-12 sm:my-20' : ''}`}
        onClick={(e) => e.stopPropagation()}
      >
        {demoStart !== null && !started ? <p className="text-sm text-white/70">{moving ? series === 'F1' ? '车队完成暖胎圈后回到发车位' : '车队依次就位' : blue ? '预启动提示 · 蓝色信号' : '红灯依次点亮，随后熄灭'}</p> : !Number.isFinite(targetMs) ? <span className="text-white">时间待确认</span> : started ? (
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

      <div className="relative z-10 mt-8 px-6 text-center text-[11px] leading-6 text-white/40"><p>{demoStart !== null ? '压缩时长的程序演示 · 不代表现场进度' : '按赛程时间倒计时 · 动画并非官方实时发车信号'}</p><p>按 ESC 或关闭按钮返回赛历</p></div>
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
