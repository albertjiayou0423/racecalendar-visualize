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
    if (intensity === "grand") {
      confetti({ ...opts, particleCount: 100, origin: { x: 0.2, y: 0.6 }, angle: 60 })
      confetti({ ...opts, particleCount: 100, origin: { x: 0.8, y: 0.6 }, angle: 120 })
      setTimeout(() => confetti({ ...opts, particleCount: 80, origin: { y: 0.5 }, spread: 100 }), 150)
    } else if (intensity === "normal") {
      confetti({ ...opts, particleCount: 60, origin: { x: 0.3, y: 0.6 }, angle: 60 })
      confetti({ ...opts, particleCount: 60, origin: { x: 0.7, y: 0.6 }, angle: 120 })
    } else {
      confetti({ ...opts, particleCount: 30, origin: { y: 0.5 }, spread: 50 })
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

      const presets: Record<string, { freq: number; dur: number; type: OscillatorType; gain: number; sweep?: number }> = {
        tick: { freq: 880, dur: 0.08, type: "sine", gain: 0.04 },
        chime: { freq: 1046, dur: 0.18, type: "sine", gain: 0.06 },
        start: { freq: 660, dur: 0.35, type: "triangle", gain: 0.08, sweep: 1320 },
        finish: { freq: 1320, dur: 0.45, type: "sine", gain: 0.07, sweep: 660 },
      }
      const p = presets[type]
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = p.type
      osc.frequency.setValueAtTime(p.freq, ctx.currentTime)
      if (p.sweep) osc.frequency.linearRampToValueAtTime(p.sweep, ctx.currentTime + p.dur)
      gain.gain.setValueAtTime(0, ctx.currentTime)
      gain.gain.linearRampToValueAtTime(p.gain, ctx.currentTime + 0.01)
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + p.dur)
      osc.connect(gain).connect(ctx.destination)
      osc.start()
      osc.stop(ctx.currentTime + p.dur)
    } catch {
      // 静默失败
    }
  }, [])

  const sounds: { type: "tick" | "chime" | "start" | "finish"; label: string; desc: string }[] = [
    { type: "tick", label: "滴答", desc: "≤60秒每秒提示" },
    { type: "chime", label: "清脆短音", desc: "通用提示" },
    { type: "start", label: "开赛音效", desc: "上扬 660→1320Hz" },
    { type: "finish", label: "完赛音效", desc: "下沉 1320→660Hz" },
  ]

  return (
    <DemoCard
      title="提示音"
      icon={<Volume2 className="size-5 text-primary" />}
      description="Web Audio API 合成音效，无需音频文件。点击试听。"
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
            <span className="text-[10px] text-muted-foreground">{s.desc}</span>
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

  return (
    <DemoCard
      title="倒计时阶段化字号"
      icon={<Clock className="size-5 text-primary" />}
      description="剩余时间越少字号越大、变红。模拟首页大倒计时效果。"
    >
      <div className="flex flex-col items-center gap-4 py-2">
        <div className="flex items-baseline gap-1 font-mono font-bold tabular-nums">
          <span
            className={cn(
              "transition-all duration-500",
              stage === "final" ? "text-5xl sm:text-6xl text-red-500 animate-pulse" :
              stage === "urgent" ? "text-4xl sm:text-5xl text-red-500" :
              stage === "soon" ? "text-3xl sm:text-4xl" :
              "text-3xl sm:text-4xl"
            )}
          >
            {String(mins).padStart(2, "0")}
          </span>
          <span className="ml-0.5 mr-2 text-sm text-muted-foreground">分</span>
          <span
            className={cn(
              "transition-all duration-500",
              stage === "final" ? "text-5xl sm:text-6xl text-red-500 animate-pulse" :
              stage === "urgent" ? "text-4xl sm:text-5xl text-red-500" :
              stage === "soon" ? "text-3xl sm:text-4xl" :
              "text-3xl sm:text-4xl"
            )}
          >
            {String(secs).padStart(2, "0")}
          </span>
          <span className="ml-0.5 text-sm text-muted-foreground">秒</span>
        </div>
        <span className="rounded-full bg-secondary px-3 py-0.5 text-xs text-muted-foreground">
          阶段：{stageLabel(stage)}
        </span>
        <div className="flex items-center gap-2">
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

  // 归零撒花
  useEffect(() => {
    if (remaining === 0) {
      confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 }, colors: SERIES_COLORS.F1, disableForReducedMotion: true, zIndex: 10000 })
    }
  }, [remaining])

  const mins = Math.floor(remaining / 60)
  const secs = remaining % 60

  return (
    <div
      className="fixed inset-0 z-[9998] flex flex-col items-center justify-center transition-opacity"
      style={{ background: "radial-gradient(ellipse at center, #ef444422 0%, #0a0a0e 70%)" }}
    >
      <div className="absolute inset-0 -z-10 opacity-30" style={{ backgroundColor: "#ef4444", filter: "blur(120px)", transform: "scale(1.5)" }} aria-hidden />
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
