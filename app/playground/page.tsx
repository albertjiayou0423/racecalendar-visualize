"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import Link from "next/link"
import { ArrowLeft, Sparkles, Volume2, PartyPopper, Clock, Play, Pause, RotateCcw, Maximize2, X } from "lucide-react"
import confetti from "canvas-confetti"
import { cn } from "@/lib/utils"

const SERIES_COLORS: Record<string, string[]> = {
  F1: ["#ef4444", "#f87171", "#fca5a5", "#dc2626"],
  WRC: ["#3b82f6", "#60a5fa", "#93c5fd", "#1d4ed8"],
  FE: ["#10b981", "#34d399", "#6ee7b7", "#059669"],
  Neutral: ["#94a3b8", "#cbd5e1", "#e2e8f0", "#64748b"],
}

export default function PlaygroundPage() {
  return (
    <main className="mx-auto max-w-4xl px-4 py-8 sm:py-12">
      <Link href="/" className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground">
        <ArrowLeft className="size-4" />
        返回首页
      </Link>

      <header className="mb-8">
        <h1 className="flex items-center gap-2 text-2xl font-bold sm:text-3xl">
          <Sparkles className="size-7 text-primary" />
          交互测试台
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Playground · 用于测试各类交互组件与功能效果，不影响正式页面。
        </p>
      </header>

      <div className="space-y-8">
        <ConfettiDemo />
        <SoundDemo />
        <CountdownStageDemo />
        <ImmersiveCountdownDemo />
      </div>
    </main>
  )
}

// ─── 撒花特效演示 ─────────────────────────────────────────────

function ConfettiDemo() {
  const [series, setSeries] = useState<keyof typeof SERIES_COLORS>("F1")
  const [intensity, setIntensity] = useState<"light" | "normal" | "grand">("normal")

  const fire = useCallback(() => {
    const colors = SERIES_COLORS[series]
    const opts = { spread: 70, startVelocity: 38, ticks: 90, zIndex: 9999, colors, disableForReducedMotion: true }
    // 屏幕两侧齐射：左侧向右斜上（angle 0-60），右侧向左斜上（angle 120-180）
    if (intensity === "grand") {
      confetti({ ...opts, particleCount: 110, origin: { x: 0, y: 0.7 }, angle: 45, spread: 80 })
      confetti({ ...opts, particleCount: 110, origin: { x: 1, y: 0.7 }, angle: 135, spread: 80 })
      setTimeout(() => {
        confetti({ ...opts, particleCount: 90, origin: { x: 0, y: 0.6 }, angle: 30, spread: 60 })
        confetti({ ...opts, particleCount: 90, origin: { x: 1, y: 0.6 }, angle: 150, spread: 60 })
      }, 180)
    } else if (intensity === "normal") {
      confetti({ ...opts, particleCount: 70, origin: { x: 0, y: 0.7 }, angle: 45, spread: 70 })
      confetti({ ...opts, particleCount: 70, origin: { x: 1, y: 0.7 }, angle: 135, spread: 70 })
    } else {
      confetti({ ...opts, particleCount: 35, origin: { x: 0, y: 0.7 }, angle: 50, spread: 50 })
      confetti({ ...opts, particleCount: 35, origin: { x: 1, y: 0.7 }, angle: 130, spread: 50 })
    }
  }, [series, intensity])

  return (
    <DemoCard
      title="撒花特效"
      icon={<PartyPopper className="size-5 text-primary" />}
      description="canvas-confetti 彩带，各系列配色，可调强度。仅在前台触发。"
    >
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex gap-1.5">
          {(["F1", "WRC", "FE", "Neutral"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setSeries(s)}
              className={cn(
                "rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors",
                series === s ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:text-foreground"
              )}
            >
              {s}
            </button>
          ))}
        </div>
        <div className="flex gap-1.5">
          {(["light", "normal", "grand"] as const).map((i) => (
            <button
              key={i}
              onClick={() => setIntensity(i)}
              className={cn(
                "rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors",
                intensity === i ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:text-foreground"
              )}
            >
              {i === "light" ? "少量" : i === "normal" ? "常规" : "盛大"}
            </button>
          ))}
        </div>
        <button
          onClick={fire}
          className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-1.5 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          <PartyPopper className="size-3.5" />
          触发撒花
        </button>
      </div>
    </DemoCard>
  )
}

// ─── 提示音演示 ───────────────────────────────────────────────

function SoundDemo() {
  const audioCtxRef = useRef<AudioContext | null>(null)

  /**
   * 合成柔和钟琴音：基频 + 2 个泛音叠加，经低通滤波 + 长衰减包络，
   * 模拟马林巴/颂钵音色，避免电音感。
   * @param partials 谐波 [{freq, gain, detune}]
   * @param dur 总时长（秒）
   * @param masterGain 总音量
   * @param fromFreq 起始基频（用于开赛上扬/完赛下沉的滑音）
   * @param toFreq 结束基频
   */
  const playTone = useCallback((
    partials: { freq: number; gain: number }[],
    dur: number,
    masterGain: number,
    fromFreq?: number,
    toFreq?: number,
  ) => {
    const ctx = audioCtxRef.current
    if (!ctx) return
    const now = ctx.currentTime

    // 低通滤波，去掉高频毛刺，让音色更圆润
    const filter = ctx.createBiquadFilter()
    filter.type = "lowpass"
    filter.frequency.setValueAtTime(2400, now)
    filter.Q.value = 0.6

    const master = ctx.createGain()
    master.gain.setValueAtTime(0, now)
    master.gain.linearRampToValueAtTime(masterGain, now + 0.015) // 起音
    master.gain.exponentialRampToValueAtTime(0.0001, now + dur) // 长尾衰减
    filter.connect(master).connect(ctx.destination)

    partials.forEach((p, i) => {
      const osc = ctx.createOscillator()
      osc.type = "sine" // 最柔和的波形
      // 如果有滑音（开赛/完赛），按基频比例同步滑
      const baseFrom = fromFreq ?? p.freq
      const baseTo = toFreq ?? p.freq
      const ratio = p.freq / (fromFreq ?? partials[0].freq)
      osc.frequency.setValueAtTime(baseFrom * ratio, now)
      if (fromFreq && toFreq && fromFreq !== toFreq) {
        osc.frequency.exponentialRampToValueAtTime(baseTo * ratio, now + dur * 0.7)
      }
      const g = ctx.createGain()
      g.gain.value = p.gain
      osc.connect(g).connect(filter)
      osc.start(now)
      osc.stop(now + dur)
    })
  }, [])

  const play = useCallback((type: "tick" | "chime" | "start" | "finish") => {
    try {
      if (!audioCtxRef.current) {
        const AC = window.AudioContext || (window as any).webkitAudioContext
        if (!AC) return
        audioCtxRef.current = new AC()
      }
      const ctx = audioCtxRef.current
      if (!ctx) return
      if (ctx.state === "suspended") ctx.resume()

      if (type === "tick") {
        // 滴答：极短木鱼感，基频 + 高泛音，短衰减
        playTone(
          [{ freq: 1318, gain: 1 }, { freq: 2637, gain: 0.3 }],
          0.18, 0.05,
        )
      } else if (type === "chime") {
        // 清脆钟琴：C6 + E6 双音和弦，中等衰减
        playTone(
          [
            { freq: 1046, gain: 0.9 }, // C6
            { freq: 1318, gain: 0.6 }, // E6
            { freq: 2093, gain: 0.25 }, // C7 泛音
          ],
          0.6, 0.07,
        )
      } else if (type === "start") {
        // 开赛：从 C5 上行到 C6，三音叠加，长衰减，有"渐入"仪式感
        playTone(
          [
            { freq: 523, gain: 0.9 },  // C5
            { freq: 659, gain: 0.5 },  // E5
            { freq: 1046, gain: 0.35 }, // C6 泛音
          ],
          1.0, 0.09,
          523, 1046,
        )
      } else if (type === "finish") {
        // 完赛：从 E6 下行到 C5，柔和颂钵感，最长衰减
        playTone(
          [
            { freq: 1318, gain: 0.85 }, // E6
            { freq: 1046, gain: 0.5 },  // C6
            { freq: 523, gain: 0.35 },  // C5 泛音
          ],
          1.3, 0.08,
          1318, 523,
        )
      }
    } catch {
      // 静默失败
    }
  }, [playTone])

  const sounds: { type: "tick" | "chime" | "start" | "finish"; label: string; desc: string }[] = [
    { type: "tick", label: "滴答", desc: "木鱼感短音" },
    { type: "chime", label: "钟琴和弦", desc: "C+E 双音柔和" },
    { type: "start", label: "开赛", desc: "C5→C6 上扬长尾" },
    { type: "finish", label: "完赛", desc: "E6→C5 颂钵下沉" },
  ]

  return (
    <DemoCard
      title="提示音"
      icon={<Volume2 className="size-5 text-primary" />}
      description="Web Audio 合成柔和钟琴/颂钵音色（多谐波叠加 + 低通滤波 + 长衰减），无电音感。点击试听。"
    >
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {sounds.map((s) => (
          <button
            key={s.type}
            onClick={() => play(s.type)}
            className="flex flex-col items-center gap-1 rounded-lg border border-border bg-secondary/30 p-3 transition-colors hover:bg-secondary"
          >
            <Volume2 className="size-4 text-primary" />
            <span className="text-xs font-medium">{s.label}</span>
            <span className="text-[10px] text-muted-foreground text-center">{s.desc}</span>
          </button>
        ))}
      </div>
      <p className="mt-2 text-[11px] text-muted-foreground">需浏览器允许音频播放（部分浏览器需先有用户交互）。</p>
    </DemoCard>
  )
}

// ─── 倒计时阶段化字号演示 ─────────────────────────────────────

function CountdownStageDemo() {
  const [seconds, setSeconds] = useState(90)
  const [running, setRunning] = useState(false)
  const [series, setSeries] = useState<keyof typeof SERIES_COLORS>("F1")

  useEffect(() => {
    if (!running) return
    const id = setInterval(() => {
      setSeconds((s) => {
        if (s <= 1) {
          setRunning(false)
          return 0
        }
        return s - 1
      })
    }, 1000)
    return () => clearInterval(id)
  }, [running])

  const stage = getStage(seconds)
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  // 紧急阶段用赛事主色（取配色数组第二个，略亮一点）
  const accentColor = SERIES_COLORS[series][1]
  const accentStyle = (stage === "final" || stage === "urgent")
    ? { color: accentColor, textShadow: `0 0 24px ${accentColor}55` }
    : undefined

  return (
    <DemoCard
      title="倒计时阶段化字号"
      icon={<Clock className="size-5 text-primary" />}
      description="剩余时间越少字号越大，最后阶段使用赛事配色（非固定红色）。"
    >
      <div className="flex flex-col items-center gap-4 py-2">
        <div className="flex flex-wrap justify-center gap-1.5">
          {(["F1", "WRC", "FE", "Neutral"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setSeries(s)}
              className={cn(
                "rounded-lg border px-3 py-1 text-xs font-medium transition-colors",
                series === s ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:text-foreground"
              )}
            >
              {s}
            </button>
          ))}
        </div>
        <div className="flex items-baseline gap-1 font-mono font-bold tabular-nums">
          <span
            className={cn(
              "transition-all duration-500",
              stage === "final" ? "text-5xl sm:text-6xl animate-pulse" :
              stage === "urgent" ? "text-4xl sm:text-5xl" :
              stage === "soon" ? "text-3xl sm:text-4xl" :
              "text-3xl sm:text-4xl"
            )}
            style={accentStyle}
          >
            {String(mins).padStart(2, "0")}
          </span>
          <span className="ml-0.5 mr-2 text-sm text-muted-foreground">分</span>
          <span
            className={cn(
              "transition-all duration-500",
              stage === "final" ? "text-5xl sm:text-6xl animate-pulse" :
              stage === "urgent" ? "text-4xl sm:text-5xl" :
              stage === "soon" ? "text-3xl sm:text-4xl" :
              "text-3xl sm:text-4xl"
            )}
            style={accentStyle}
          >
            {String(secs).padStart(2, "0")}
          </span>
          <span className="ml-0.5 text-sm text-muted-foreground">秒</span>
        </div>
        <span className="rounded-full bg-secondary px-3 py-0.5 text-xs text-muted-foreground">
          阶段：{stageLabel(stage)}
        </span>
        <div className="flex flex-wrap items-center justify-center gap-2">
          <button
            onClick={() => setRunning((r) => !r)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-1.5 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            {running ? <Pause className="size-3.5" /> : <Play className="size-3.5" />}
            {running ? "暂停" : "开始"}
          </button>
          <button
            onClick={() => { setRunning(false); setSeconds(90) }}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border px-4 py-1.5 text-xs font-medium transition-colors hover:bg-secondary"
          >
            <RotateCcw className="size-3.5" />
            重置
          </button>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <input
              type="range"
              min={0}
              max={3600}
              value={seconds}
              onChange={(e) => { setSeconds(Number(e.target.value)); setRunning(false) }}
              className="w-24 sm:w-32"
            />
          </div>
        </div>
      </div>
    </DemoCard>
  )
}

function getStage(sec: number): "far" | "today" | "soon" | "urgent" | "final" | "past" {
  if (sec <= 0) return "past"
  if (sec <= 60) return "final"
  if (sec <= 600) return "urgent"
  if (sec <= 1800) return "soon"
  if (sec <= 86400) return "today"
  return "far"
}

function stageLabel(stage: string): string {
  const map: Record<string, string> = {
    far: ">1天",
    today: "当天（≤24h）",
    soon: "≤30分钟",
    urgent: "≤10分钟（放大+红）",
    final: "≤60秒（最大+红+脉冲）",
    past: "已结束",
  }
  return map[stage] ?? stage
}

// ─── 沉浸式倒计时演示 ─────────────────────────────────────────

function ImmersiveCountdownDemo() {
  const [open, setImmersiveOpen] = useState(false)
  const [targetSeconds, setTargetSeconds] = useState(60)

  return (
    <DemoCard
      title="沉浸式开赛模式"
      icon={<Maximize2 className="size-5 text-primary" />}
      description="全屏倒计时 + 数字滚动动画 + 渐变背景。可设置任意秒数触发。"
    >
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>倒计时秒数：</span>
          <input
            type="range"
            min={10}
            max={300}
            value={targetSeconds}
            onChange={(e) => setTargetSeconds(Number(e.target.value))}
            className="w-24 sm:w-32"
          />
          <span className="tabular-nums text-foreground">{targetSeconds}s</span>
        </div>
        <button
          onClick={() => setImmersiveOpen(true)}
          className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-1.5 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          <Maximize2 className="size-3.5" />
          进入沉浸式
        </button>
      </div>

      {open && <ImmersiveOverlay targetSeconds={targetSeconds} onClose={() => setImmersiveOpen(false)} />}
    </DemoCard>
  )
}

function ImmersiveOverlay({ targetSeconds, onClose }: { targetSeconds: number; onClose: () => void }) {
  const [remaining, setRemaining] = useState(targetSeconds)

  useEffect(() => {
    setRemaining(targetSeconds)
    const id = setInterval(() => {
      setRemaining((r) => Math.max(0, r - 1))
    }, 1000)
    return () => clearInterval(id)
  }, [targetSeconds])

  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = "hidden"
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose() }
    document.addEventListener("keydown", onKey)
    return () => {
      document.body.style.overflow = prev
      document.removeEventListener("keydown", onKey)
    }
  }, [onClose])

  // 归零撒花（屏幕两侧齐射）
  useEffect(() => {
    if (remaining === 0) {
      const colors = SERIES_COLORS.F1
      const opts = { spread: 70, startVelocity: 38, ticks: 90, zIndex: 10000, colors, disableForReducedMotion: true }
      confetti({ ...opts, particleCount: 100, origin: { x: 0, y: 0.7 }, angle: 45 })
      confetti({ ...opts, particleCount: 100, origin: { x: 1, y: 0.7 }, angle: 135 })
    }
  }, [remaining])

  const mins = Math.floor(remaining / 60)
  const secs = remaining % 60

  return (
    <div
      className="fixed inset-0 z-[9998] flex flex-col items-center justify-center bg-black"
    >
      <button
        onClick={onClose}
        className="absolute right-4 top-4 rounded-full bg-white/10 p-2 text-white/80 backdrop-blur transition-colors hover:bg-white/20 hover:text-white"
        aria-label="关闭"
      >
        <X className="size-5" />
      </button>
      <div className="flex flex-col items-center px-4 text-center">
        {remaining === 0 ? (
          <span className="text-5xl font-bold text-red-500 sm:text-7xl animate-pulse">开赛！</span>
        ) : (
          <>
            <div className="mb-2 text-sm uppercase tracking-[0.3em] text-white/50">距开赛</div>
            <div className="flex items-end justify-center gap-2 sm:gap-4">
              <RollingUnit value={mins} label="分" />
              <RollingUnit value={secs} label="秒" highlight />
            </div>
          </>
        )}
      </div>
      <div className="absolute bottom-6 text-center text-[11px] text-white/30">按 ESC 退出</div>
    </div>
  )
}

function RollingUnit({ value, label, highlight }: { value: number; label: string; highlight?: boolean }) {
  const display = String(value).padStart(2, "0")
  return (
    <div className="flex flex-col items-center">
      <div className="relative overflow-hidden">
        <div
          key={display}
          className={cn("font-mono font-black tabular-nums text-7xl sm:text-9xl animate-[rollIn_0.4s_ease-out]", highlight ? "text-red-500" : "text-white")}
          style={{ textShadow: highlight ? "0 0 40px #ef444466" : "0 0 20px #00000066" }}
        >
          {display}
        </div>
      </div>
      <div className="mt-1 text-xs uppercase tracking-widest text-white/40">{label}</div>
    </div>
  )
}

// ─── 通用演示卡片容器 ─────────────────────────────────────────

function DemoCard({
  title,
  icon,
  description,
  children,
}: {
  title: string
  icon: React.ReactNode
  description: string
  children: React.ReactNode
}) {
  return (
    <section className="rounded-2xl border border-border bg-card p-5 sm:p-6">
      <div className="mb-4 flex items-center gap-2">
        {icon}
        <h2 className="text-base font-semibold sm:text-lg">{title}</h2>
      </div>
      <p className="mb-4 text-xs text-muted-foreground">{description}</p>
      {children}
    </section>
  )
}
