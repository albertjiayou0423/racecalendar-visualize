"use client"

import { useState, useEffect, useRef, type CSSProperties, type ReactNode } from "react"
import { X } from "lucide-react"
import NumberFlow, { NumberFlowGroup } from '@number-flow/react'
import { countdownDisplay, countdownTickDelay } from '@/lib/countdown-display'
import { StartClock } from './start-clock'
import { ClockParallax } from './clock-parallax'
import { StartLights } from './start-lights'
import { CountdownEntrance, CountdownImpact, CountdownFinalPulse } from './countdown-effects'
import { useF1Start } from '@/lib/use-f1-start'
import './immersive-countdown.css'
import { useFocusTrap } from "@/lib/use-focus-trap"
import type { Series } from "@/lib/types"
import { SERIES_THEME_COLORS } from '@/lib/series-theme'
import { didCountdownStart } from '@/lib/countdown-transition'
import { IMMERSION_MOTION, pulseOrigin, releaseVisible } from '@/lib/immersion-motion'

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
  /** 仅 Playground：-1 正常播放，0–1000 暂停在归零动画对应毫秒。 */
  previewFrameMs?: number
  /** Optional in-dialog controls, used by the immersion test routes. */
  children?: ReactNode
}

/** 全屏倒计时：按位滚动，最后半小时显示系列起跑装置。 */
export function ImmersiveCountdown({ targetTime, series, onClose, preview = false, title, isRace = false, entrance = false, timeZone, previewFrameMs = -1, children }: ImmersiveCountdownProps) {
  const vibrated = useRef(false)
  const enteredAt = useRef(Date.now())
  useEffect(() => {
    if (!entrance || preview || vibrated.current) return
    vibrated.current = true
    if (window.matchMedia('(pointer: coarse)').matches && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      try { navigator.vibrate?.(35) } catch { /* Unsupported or blocked haptics do not interrupt entry. */ }
    }
  }, [entrance, preview])
  const [clock, setClock] = useState(Date.now)
  const [previewTarget, setPreviewTarget] = useState<{ time: number; source: string; series: Series } | null>(null)
  const targetMs = preview && previewTarget?.source === targetTime && previewTarget.series === series ? previewTarget.time : new Date(targetTime).getTime()
  const liveState = useF1Start(targetTime, !preview && series === 'F1' && isRace && targetMs - clock <= 30 * 60000 && clock - targetMs <= 10 * 60000)
  const remaining = Number.isFinite(targetMs) ? Math.max(0, targetMs - clock) : 0
  const closeRef = useRef(onClose)
  closeRef.current = onClose
  const containerRef = useRef<HTMLDivElement>(null)

  // 焦点陷阱：限制 Tab 在沉浸式容器内循环
  useFocusTrap(containerRef, !preview)

  // One clock drives both the digits and transition state. Wake only when the
  // visible second changes, then keep a light heartbeat for live-state freshness.
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>
    let cancelled = false
    const tick = () => {
      if (cancelled) return
      const now = Date.now()
      setClock(now)
      timer = setTimeout(tick, countdownTickDelay(targetMs, now))
    }
    const now = Date.now()
    setClock(now)
    timer = setTimeout(tick, countdownTickDelay(targetMs, now))
    return () => { cancelled = true; clearTimeout(timer) }
  }, [targetMs])

  // 锁定 body 滚动 + ESC 退出
  useEffect(() => {
    if (preview) return

    const prev = document.body.style.overflow
    const prevRoot = document.documentElement.style.overflow
    document.body.style.overflow = "hidden"
    document.documentElement.style.overflow = "hidden"
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeRef.current()
    }
    document.addEventListener("keydown", onKey)
    return () => {
      document.body.style.overflow = prev
      document.documentElement.style.overflow = prevRoot
      document.removeEventListener("keydown", onKey)
    }
  }, [preview])

  const { total, days, hours, minutes, seconds, showSignals } = countdownDisplay(remaining)
  const freshLive = liveState && (clock - Date.parse(liveState.observedAt) < 30000 || ['racing', 'finished', 'delayed'].includes(liveState.phase)) && liveState.phase !== 'unknown' ? liveState : null
  const hasLiveState = !!freshLive
  const green = !!(freshLive?.phase === 'formation' && freshLive.signalAt && clock - Date.parse(freshLive.signalAt) < 30000)
  const started = freshLive ? ['racing', 'finished'].includes(freshLive.phase) : Number.isFinite(targetMs) && remaining === 0
  const lit = freshLive || started ? 0 : Math.min(5, Math.max(0, 6 - total))
  const phaseLabel = freshLive ? ({ formation: '暖胎圈信号', delayed: '发车延迟', racing: '比赛已开始', finished: '场次已结束', unknown: '等待信号' }[freshLive.phase])
    : null
  const impactDuration = IMMERSION_MOTION.impact[series]
  const accentColor = SERIES_THEME_COLORS[series]
  const inspectFrame = preview && Number.isFinite(previewFrameMs) && previewFrameMs >= 0
  const previousStarted = useRef({ targetMs, series, started })
  const [release, setRelease] = useState<{ at: number; lag: number; targetMs: number; series: Series } | null>(null)
  const releaseMatches = release?.targetMs === targetMs && release.series === series
  const launchBurst = !!(release && releaseMatches && started && releaseVisible(release.at, clock, series))
  useEffect(() => {
    const current = { targetMs, series, started }
    const crossedStart = didCountdownStart(previousStarted.current, current)
    previousStarted.current = current
    if (!crossedStart || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const at = hasLiveState ? Date.now() : targetMs
    const now = Date.now()
    if (releaseVisible(at, now, series)) setRelease({ at, lag: Math.max(0, now - at), targetMs, series })
  }, [started, impactDuration, targetMs, series, hasLiveState])

  return (
    <div
      ref={containerRef}
      className={`race-immersive ${preview ? 'race-immersive-preview' : 'race-immersive-overlay'} ${entrance ? 'race-wave-entry' : ''} ${total <= 5 ? 'is-final' : ''} ${started ? 'is-started' : ''} ${launchBurst || (inspectFrame && previewFrameMs < impactDuration) ? 'has-impact' : ''} ${inspectFrame ? 'is-frame-inspection' : ''}`}
      style={{ '--accent': accentColor, '--impact-duration': `${impactDuration}ms`, '--entry-duration': `${IMMERSION_MOTION.entry}ms`, '--reveal-at': `${IMMERSION_MOTION.revealAt}ms`, '--reveal-duration': `${IMMERSION_MOTION.reveal}ms`, '--release-lag': `${releaseMatches ? release?.lag ?? 0 : 0}ms`, ...(inspectFrame ? { '--launch-frame': `${Math.min(impactDuration, previewFrameMs)}ms` } : {}) } as CSSProperties}
      data-series={series}
      data-rally-clock={series === 'WRC' && showSignals && Number.isFinite(targetMs) ? true : undefined}
      role="dialog"
      aria-modal={!preview}
      aria-label="沉浸式倒计时"
      aria-description={title}
    >
      {entrance && <CountdownEntrance at={enteredAt.current} />}
      {(launchBurst || inspectFrame) && <CountdownImpact at={releaseMatches ? release?.at : undefined} frameMs={inspectFrame ? Math.min(impactDuration, previewFrameMs) : -1} />}
      {series === 'WRC' && Number.isFinite(targetMs) && total > 0 && total <= 5 && !started && <CountdownFinalPulse key={total} at={pulseOrigin(targetMs, total)} />}
      <button
        onClick={onClose}
        className="absolute right-4 top-4 z-20 rounded-full bg-white/10 p-3 text-white/80 backdrop-blur transition-colors hover:bg-white/20 hover:text-white"
        aria-label="关闭"
      >
        <X className="size-5" />
      </button>
      {preview && <button type="button" className="absolute left-4 top-4 z-20 rounded-full bg-white/10 px-3 py-2 text-xs text-white" onClick={() => setPreviewTarget({ time: Date.now() + 10000, source: targetTime, series })}>重播最后 10 秒</button>}
      <header className="relative z-10 px-6 text-center"><p className="text-xs tracking-[0.15em] text-white/40">{series}</p><h2 className="mt-3 max-w-2xl text-sm text-white/85 sm:text-xl">{title || '等待下一场出发'}</h2></header>
      {Number.isFinite(targetMs) && showSignals && <div className="race-stage" aria-hidden={series !== 'WRC'}>
        {(series === 'F1' || series === 'FE') && <StartLights series={series} lit={lit} green={green} delayed={freshLive?.phase === 'delayed'} />}
        {series === 'WRC' && <ClockParallax><StartClock seconds={total} started={started} now={clock} timeZone={timeZone} /></ClockParallax>}
      </div>}

      {!(series === 'WRC' && showSignals && Number.isFinite(targetMs)) && <div
        className={`relative z-10 flex w-full flex-col items-center px-4 text-center ${!showSignals ? 'my-12 sm:my-20' : ''}`}
        onClick={(e) => e.stopPropagation()}
      >
        {!Number.isFinite(targetMs) ? <span className="text-white">时间待确认</span> : (
          <div className={`race-countdown-body ${started ? 'is-complete' : ''}`}>
            <div className="race-countdown-content" aria-hidden={started}>
            <div className="mb-6 text-xs text-white/40">距离开赛</div>
            <div className={`race-clock ${days > 0 ? 'has-days' : ''} ${total <= 5 ? 'final-seconds' : ''}`}>
              <NumberFlowGroup>
                <RollingUnit value={days} label="天" collapsed={days === 0} />
                <RollingUnit value={hours} label="时" collapsed={total <= 5} />
                <RollingUnit value={minutes} label="分" maxTens={5} collapsed={total <= 5} />
                <RollingUnit value={seconds} label="秒" maxTens={5} highlight accentColor={accentColor} />
              </NumberFlowGroup>
            </div>
            </div>
            {started && <span className="race-launch race-launch-result">{phaseLabel || '开赛'}</span>}
          </div>
        )}
      </div>}

      <footer className="race-countdown-note"><p>{freshLive ? '实时赛事状态 · 灯光为视觉呈现' : '依据赛程时间 · 非现场发车信号'}</p></footer>
      {children}
    </div>
  )
}

function RollingUnit({
  value,
  label,
  highlight,
  accentColor = "#ef4444",
  maxTens,
  collapsed = false,
}: {
  value: number
  label: string
  highlight?: boolean
  accentColor?: string
  maxTens?: number
  collapsed?: boolean
}) {
  return (
    <div className={`race-clock-unit ${collapsed ? 'is-collapsed' : ''}`} aria-hidden={collapsed || undefined}>
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
