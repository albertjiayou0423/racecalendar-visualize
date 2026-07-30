"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import confetti from "canvas-confetti"
import type { RaceEvent, Series } from "./types"
import { countdown, firstSession, isLive, isPast } from "./format"

// ─── 页面可见性 hook ──────────────────────────────────────────

/** 监听页面是否在前台（可见） */
export function usePageVisibility(): boolean {
  const [visible, setVisible] = useState(true)
  useEffect(() => {
    const handler = () => setVisible(!document.hidden)
    document.addEventListener("visibilitychange", handler)
    handler()
    return () => document.removeEventListener("visibilitychange", handler)
  }, [])
  return visible
}

// ─── 倒计时阶段判定 ───────────────────────────────────────────

export type CountdownStage = "far" | "today" | "soon" | "urgent" | "final" | "live" | "past"

export interface CountdownState {
  days: number
  hours: number
  minutes: number
  seconds: number
  totalSeconds: number
  stage: CountdownStage
  /** 剩余秒数（past 时为 0） */
  remaining: number
}

/** 计算倒计时阶段（统一阈值） */
export function getCountdownStage(totalSeconds: number): CountdownStage {
  if (totalSeconds <= 0) return "past"
  if (totalSeconds <= 60) return "final"      // ≤1 分钟
  if (totalSeconds <= 600) return "urgent"    // ≤10 分钟
  if (totalSeconds <= 1800) return "soon"     // ≤30 分钟
  if (totalSeconds <= 86400) return "today"   // ≤1 天
  return "far"                                // >1 天
}

/** 计算赛事的完整倒计时状态 */
export function getRaceCountdownState(event: RaceEvent, now: number): CountdownState | null {
  const first = firstSession(event)
  if (!first) return null

  const live = isLive(event, now)
  const past = isPast(event, now)
  const c = countdown(first.utc, now)
  const totalSeconds = c.days * 86400 + c.hours * 3600 + c.minutes * 60 + c.seconds

  let stage: CountdownStage
  if (live) stage = "live"
  else if (past) stage = "past"
  else stage = getCountdownStage(totalSeconds)

  return {
    days: c.days,
    hours: c.hours,
    minutes: c.minutes,
    seconds: c.seconds,
    totalSeconds,
    stage,
    remaining: Math.max(0, totalSeconds),
  }
}

// ─── 提示音 hook（Web Audio API） ─────────────────────────────

/** 短促好听的提示音，仅当页面在前台时播放 */
export function useRaceSound() {
  const visibleRef = useRef(true)
  const audioCtxRef = useRef<AudioContext | null>(null)
  const lastPlayRef = useRef(0)

  useEffect(() => {
    const handler = () => (visibleRef.current = !document.hidden)
    document.addEventListener("visibilitychange", handler)
    visibleRef.current = !document.hidden
    return () => document.removeEventListener("visibilitychange", handler)
  }, [])

  const play = useCallback((type: "tick" | "chime" | "start" | "finish" = "chime") => {
    // 仅前台播放
    if (!visibleRef.current) return
    // 节流：同类型 1.2s 内不重复
    const now = Date.now()
    if (now - lastPlayRef.current < 1200) return
    lastPlayRef.current = now

    try {
      if (!audioCtxRef.current) {
        const AC = window.AudioContext || (window as any).webkitAudioContext
        if (!AC) return
        audioCtxRef.current = new AC()
      }
      const ctx = audioCtxRef.current
      if (!ctx) return
      if (ctx.state === "suspended") ctx.resume()

      // 不同类型对应不同音色
      const presets: Record<string, { freq: number; dur: number; type: OscillatorType; gain: number; sweep?: number }> = {
        tick: { freq: 880, dur: 0.08, type: "sine", gain: 0.04 },       // 滴答
        chime: { freq: 1046, dur: 0.18, type: "sine", gain: 0.06 },     // 清脆短音
        start: { freq: 660, dur: 0.35, type: "triangle", gain: 0.08, sweep: 1320 }, // 开赛上扬
        finish: { freq: 1320, dur: 0.45, type: "sine", gain: 0.07, sweep: 660 },    // 完赛下沉
      }
      const p = presets[type] ?? presets.chime
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = p.type
      osc.frequency.setValueAtTime(p.freq, ctx.currentTime)
      if (p.sweep) {
        osc.frequency.linearRampToValueAtTime(p.sweep, ctx.currentTime + p.dur)
      }
      gain.gain.setValueAtTime(0, ctx.currentTime)
      gain.gain.linearRampToValueAtTime(p.gain, ctx.currentTime + 0.01)
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + p.dur)
      osc.connect(gain).connect(ctx.destination)
      osc.start()
      osc.stop(ctx.currentTime + p.dur)
    } catch {
      // 静默失败，不阻塞主流程
    }
  }, [])

  return play
}

// ─── 撒花特效 hook ────────────────────────────────────────────

/** 各系列对应的撒花配色 */
const SERIES_COLORS: Record<Series, string[]> = {
  F1: ["#ef4444", "#f87171", "#fca5a5", "#dc2626"],
  WRC: ["#3b82f6", "#60a5fa", "#93c5fd", "#1d4ed8"],
  FE: ["#10b981", "#34d399", "#6ee7b7", "#059669"],
}

/** 触发撒花特效（仅在页面可见时） */
export function useConfetti() {
  const visibleRef = useRef(true)
  useEffect(() => {
    const handler = () => (visibleRef.current = !document.hidden)
    document.addEventListener("visibilitychange", handler)
    visibleRef.current = !document.hidden
    return () => document.removeEventListener("visibilitychange", handler)
  }, [])

  const fire = useCallback((series: Series, intensity: "light" | "normal" | "grand" = "normal") => {
    if (!visibleRef.current) return
    const colors = SERIES_COLORS[series] ?? ["#94a3b8"]

    try {
      const opts = {
        spread: 70,
        startVelocity: 38,
        ticks: 90,
        zIndex: 9999,
        colors,
        disableForReducedMotion: true,
      }

      if (intensity === "grand") {
        // 盛大：左右两侧齐射 + 中央补充
        confetti({ ...opts, particleCount: 100, origin: { x: 0.2, y: 0.6 }, angle: 60 })
        confetti({ ...opts, particleCount: 100, origin: { x: 0.8, y: 0.6 }, angle: 120 })
        setTimeout(() => confetti({ ...opts, particleCount: 80, origin: { y: 0.5 }, spread: 100 }), 150)
      } else if (intensity === "normal") {
        confetti({ ...opts, particleCount: 60, origin: { x: 0.3, y: 0.6 }, angle: 60 })
        confetti({ ...opts, particleCount: 60, origin: { x: 0.7, y: 0.6 }, angle: 120 })
      } else {
        confetti({ ...opts, particleCount: 30, origin: { y: 0.5 }, spread: 50 })
      }
    } catch {
      // 静默失败
    }
  }, [])

  return fire
}

// ─── 赛事状态切换检测 hook ─────────────────────────────────────

export type RaceStatus = "upcoming" | "live" | "past"

/**
 * 检测赛事状态切换：
 * - upcoming → live：触发 onLive（开赛）
 * - live → past：触发 onPast（完赛）
 * 仅在页面可见时触发回调（调用方自行检查）
 */
export function useRaceStatusTransition(
  event: RaceEvent,
  now: number,
  onLive?: () => void,
  onPast?: () => void,
) {
  const prevStatusRef = useRef<RaceStatus | null>(null)
  const current: RaceStatus = isLive(event, now)
    ? "live"
    : isPast(event, now)
    ? "past"
    : "upcoming"

  useEffect(() => {
    const prev = prevStatusRef.current
    if (prev === null) {
      prevStatusRef.current = current
      return
    }
    if (prev !== current) {
      if (prev === "upcoming" && current === "live" && onLive) onLive()
      if (prev === "live" && current === "past" && onPast) onPast()
      prevStatusRef.current = current
    }
  }, [current, onLive, onPast])

  return current
}
