"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import confetti from "canvas-confetti"

// ─── 页面可见性 ─────────────────────────────────────────────

/** 仅当页面在前台时返回 true，避免后台 tab 浪费资源 */
export function usePageVisibility(): boolean {
  const [visible, setVisible] = useState(true)
  useEffect(() => {
    const onVis = () => setVisible(!document.hidden)
    document.addEventListener("visibilitychange", onVis)
    return () => document.removeEventListener("visibilitychange", onVis)
  }, [])
  return visible
}

// ─── 提示音 ────────────────────────────────────────────────

type SoundType = "tick" | "start" | "finish"

/**
 * Web Audio 合成柔和钟琴/颂钵音色（多谐波 sine 叠加 + 低通滤波 + 长衰减），
 * 避免电音感，更耐听。
 */
export function useRaceSound() {
  const ctxRef = useRef<AudioContext | null>(null)
  const lastPlayRef = useRef(0)
  const visible = usePageVisibility()

  const play = useCallback(
    (type: SoundType) => {
      if (!visible) return
      // 1.2s 节流，避免快速重复触发
      const now = Date.now()
      if (now - lastPlayRef.current < 1200) return
      lastPlayRef.current = now

      try {
        if (!ctxRef.current) {
          const AC = window.AudioContext || (window as any).webkitAudioContext
          if (!AC) return
          ctxRef.current = new AC()
        }
        const ctx = ctxRef.current
        if (!ctx) return
        if (ctx.state === "suspended") ctx.resume()
        const ctxNow = ctx.currentTime

        const filter = ctx.createBiquadFilter()
        filter.type = "lowpass"
        filter.frequency.setValueAtTime(2400, ctxNow)
        filter.Q.value = 0.6

        const master = ctx.createGain()
        master.gain.setValueAtTime(0, ctxNow)
        filter.connect(master).connect(ctx.destination)

        if (type === "tick") {
          master.gain.linearRampToValueAtTime(0.05, ctxNow + 0.01)
          master.gain.exponentialRampToValueAtTime(0.0001, ctxNow + 0.18)
          const partials = [
            { freq: 1318, gain: 1 },
            { freq: 2637, gain: 0.3 },
          ]
          partials.forEach((p) => {
            const osc = ctx.createOscillator()
            osc.type = "sine"
            osc.frequency.value = p.freq
            const g = ctx.createGain()
            g.gain.value = p.gain
            osc.connect(g).connect(filter)
            osc.start(ctxNow)
            osc.stop(ctxNow + 0.18)
          })
        } else if (type === "start") {
          // 开赛：C5→C6 上扬，1s
          master.gain.linearRampToValueAtTime(0.08, ctxNow + 0.015)
          master.gain.exponentialRampToValueAtTime(0.0001, ctxNow + 1.0)
          const fromFreq = 523
          const toFreq = 1046
          const partials = [
            { freq: 523, gain: 0.9 },
            { freq: 659, gain: 0.5 },
            { freq: 1046, gain: 0.35 },
          ]
          partials.forEach((p) => {
            const osc = ctx.createOscillator()
            osc.type = "sine"
            const ratio = p.freq / fromFreq
            osc.frequency.setValueAtTime(fromFreq * ratio, ctxNow)
            osc.frequency.exponentialRampToValueAtTime(toFreq * ratio, ctxNow + 0.7)
            const g = ctx.createGain()
            g.gain.value = p.gain
            osc.connect(g).connect(filter)
            osc.start(ctxNow)
            osc.stop(ctxNow + 1.0)
          })
        } else if (type === "finish") {
          // 完赛：E6→C5 下沉，1.3s
          master.gain.linearRampToValueAtTime(0.07, ctxNow + 0.015)
          master.gain.exponentialRampToValueAtTime(0.0001, ctxNow + 1.3)
          const fromFreq = 1318
          const toFreq = 523
          const partials = [
            { freq: 1318, gain: 0.85 },
            { freq: 1046, gain: 0.5 },
            { freq: 523, gain: 0.35 },
          ]
          partials.forEach((p) => {
            const osc = ctx.createOscillator()
            osc.type = "sine"
            const ratio = p.freq / fromFreq
            osc.frequency.setValueAtTime(fromFreq * ratio, ctxNow)
            osc.frequency.exponentialRampToValueAtTime(toFreq * ratio, ctxNow + 0.9)
            const g = ctx.createGain()
            g.gain.value = p.gain
            osc.connect(g).connect(filter)
            osc.start(ctxNow)
            osc.stop(ctxNow + 1.3)
          })
        }
      } catch {
        // 静默失败
      }
    },
    [visible]
  )

  return { play }
}

// ─── 撒花特效 ──────────────────────────────────────────────

const SERIES_COLORS: Record<string, string[]> = {
  F1: ["#ef4444", "#f87171", "#fca5a5", "#dc2626"],
  WRC: ["#3b82f6", "#60a5fa", "#93c5fd", "#1d4ed8"],
  FE: ["#10b981", "#34d399", "#6ee7b7", "#059669"],
}

type ConfettiIntensity = "light" | "normal" | "grand"

/**
 * 触发屏幕两侧齐射的撒花特效。
 * @param series 系列名，决定配色（F1/WRC/FE）
 * @param intensity 强度
 */
export function useConfettiBurst() {
  const visible = usePageVisibility()

  const burst = useCallback(
    (series: string, intensity: ConfettiIntensity = "normal") => {
      if (!visible) return
      const colors = SERIES_COLORS[series] ?? SERIES_COLORS.F1
      const opts = {
        spread: 70,
        startVelocity: 38,
        ticks: 90,
        zIndex: 9999,
        colors,
        disableForReducedMotion: true,
      }
      if (intensity === "grand") {
        confetti({ ...opts, particleCount: 110, origin: { x: 0, y: 0.7 }, angle: 45 })
        confetti({ ...opts, particleCount: 110, origin: { x: 1, y: 0.7 }, angle: 135 })
        setTimeout(() => {
          confetti({ ...opts, particleCount: 90, origin: { x: 0, y: 0.6 }, angle: 30 })
          confetti({ ...opts, particleCount: 90, origin: { x: 1, y: 0.6 }, angle: 150 })
        }, 180)
      } else if (intensity === "normal") {
        confetti({ ...opts, particleCount: 70, origin: { x: 0, y: 0.7 }, angle: 45 })
        confetti({ ...opts, particleCount: 70, origin: { x: 1, y: 0.7 }, angle: 135 })
      } else {
        confetti({ ...opts, particleCount: 35, origin: { x: 0, y: 0.7 }, angle: 50 })
        confetti({ ...opts, particleCount: 35, origin: { x: 1, y: 0.7 }, angle: 130 })
      }
    },
    [visible]
  )

  return { burst }
}
