"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { Clock, MapPin, Calendar, Trophy, Moon, CloudRain, Sun, HelpCircle } from "lucide-react"
import type { RaceEvent, Series } from "@/lib/types"
import {
  countdown,
  nextSession,
  formatDateTime,
  formatTime,
  isLive,
  isPast,
  isNightRace,
  SERIES_META,
} from "@/lib/format"
import { BEIJING_TZ } from "@/lib/format"
import { PredictionVote } from "@/components/prediction-vote"
import { ImmersiveCountdown } from "@/components/immersive-countdown"
import { useConfettiBurst, useRaceSound } from "@/lib/countdown-hooks"

interface NextRacePreviewProps {
  event: RaceEvent
  now: number
}

const SERIES_ACCENT: Record<Series, string> = {
  F1: "#ef4444",
  WRC: "#3b82f6",
  FE: "#10b981",
}

type CountdownStage = "far" | "today" | "soon" | "urgent" | "final" | "past"

function getCountdownStage(seconds: number): CountdownStage {
  if (seconds <= 0) return "past"
  if (seconds <= 60) return "final"
  if (seconds <= 600) return "urgent"
  if (seconds <= 1800) return "soon"
  if (seconds <= 86400) return "today"
  return "far"
}

// 使用 sessionStorage 记录是否已触发过开赛撒花/音效（避免从其他页面返回时重复触发）
function hasTriggeredLive(): boolean {
  try { return sessionStorage.getItem("race-live-triggered") === "1" } catch { return false }
}
function markLiveTriggered(): void {
  try { sessionStorage.setItem("race-live-triggered", "1") } catch {}
}

export function NextRacePreview({ event, now }: NextRacePreviewProps) {
  const targetResult = nextSession(event, now)
  const meta = SERIES_META[event.series]
  const { burst } = useConfettiBurst()
  const { play } = useRaceSound()
  const [immersiveOpen, setImmersiveOpen] = useState(false)
  const [milestoneVisible, setMilestoneVisible] = useState(true)
  const [showHelp, setShowHelp] = useState(false)
  const prevStageRef = useRef<CountdownStage>("far")

  if (!targetResult) return null

  const target = targetResult.session
  const c = countdown(target.utc, now)
  const live = targetResult.live || isLive(event, now)
  const past = isPast(event, now)
  const accentColor = SERIES_ACCENT[event.series]
  const isNight = isNightRace(target.utc, event.tz)

  const totalSeconds =
    c.days * 86400 + c.hours * 3600 + c.minutes * 60 + c.seconds
  const stage = getCountdownStage(totalSeconds)

  // 进入沉浸式模式
  const enterImmersive = useCallback(() => {
    if (!live && !past) {
      setImmersiveOpen(true)
    }
  }, [live, past])

  // 键盘快捷键
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // 忽略输入框中的按键
      const tag = (e.target as HTMLElement)?.tagName
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return

      if (e.key === "f" || e.key === "F") {
        e.preventDefault()
        enterImmersive()
      } else if (e.key === "?") {
        e.preventDefault()
        setShowHelp((v) => !v)
      } else if (e.key === "Escape") {
        setShowHelp(false)
      }
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [enterImmersive])

  // 页面加载时显示里程碑彩蛋，7秒后自动消失
  useEffect(() => {
    const timer = setTimeout(() => setMilestoneVisible(false), 7000)
    return () => clearTimeout(timer)
  }, [])

  useEffect(() => {
    if (live) {
      // 只在首次进入 LIVE 时触发一次，本会话不重复触发
      if (!hasTriggeredLive()) {
        markLiveTriggered()
        play("start")
        burst(event.series, "grand")
        // 移动端短震反馈
        if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
          navigator.vibrate(10)
        }
      }
      prevStageRef.current = "past"
      return
    }

    const prev = prevStageRef.current
    if (prev !== stage) {
      if (stage === "final" && prev !== "final") {
        play("tick")
      }
      prevStageRef.current = stage
    }
  }, [stage, live, burst, play, event.series])

  useEffect(() => {
    if (stage !== "final" || live) return
    const id = setInterval(() => play("tick"), 1000)
    return () => clearInterval(id)
  }, [stage, live, play])

  // 里程碑提示文案
  const milestoneText = live
    ? "GO! \uD83D\uDD25"
    : stage === "final"
      ? "最后倒计时！"
      : stage === "urgent"
        ? "即将开始 \u23F3"
        : stage === "soon"
          ? "半小时内开赛"
          : stage === "today"
            ? "今天开赛 \uD83C\uDFC1"
            : "赛事倒计时中\u23F1"
  const milestoneColor = live
    ? "#ef4444"
    : stage === "final"
      ? "#ef4444"
      : stage === "urgent"
        ? "#f97316"
        : stage === "soon"
          ? "#eab308"
          : accentColor

  return (
    <section
      className="relative overflow-hidden rounded-2xl border border-border bg-card p-5 sm:p-6"
      aria-label="下一站预览"
    >
      <div
        className="absolute inset-x-0 top-0 h-1"
        style={{ backgroundColor: live ? "#ef4444" : meta.color }}
        aria-hidden
      />
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <span
          className="rounded px-2 py-0.5 font-bold"
          style={{ backgroundColor: live ? "#ef4444" : meta.color, color: meta.textColor }}
        >
          {live ? "LIVE" : meta.label}
        </span>
        <span>{live ? "进行中" : meta.full}</span>
        <span>·</span>
        <span>第 {event.round} 轮</span>
        <span>·</span>
        <span>{live ? "当前赛事" : "下一站"}</span>
        {isNight && (
          <span className="flex items-center gap-1 text-indigo-400" title="夜赛">
            <Moon className="size-3" />
            <span>夜赛</span>
          </span>
        )}
        <button
          onClick={() => setShowHelp((v) => !v)}
          className="ml-auto rounded p-1 text-muted-foreground hover:text-foreground transition-colors"
          aria-label="键盘快捷键帮助"
          title="键盘快捷键"
        >
          <HelpCircle className="size-3.5" />
        </button>
      </div>

      <h2 className="mt-3 flex items-center gap-2 text-pretty text-xl font-bold leading-tight sm:text-2xl">
        {event.name}
        {live && (
          <span className="flex items-center gap-1 rounded-full bg-red-500/15 px-2 py-0.5 text-xs font-medium text-red-500">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-red-500" />
            </span>
            LIVE
          </span>
        )}
        {isNight && (
          <Moon className="size-4 text-indigo-400" title="夜赛" aria-label="夜赛" />
        )}
      </h2>

      <div className="mt-2 flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <MapPin className="size-4" />
          <span>{event.circuit}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Calendar className="size-4" />
          <span>
            {event.locality}，{event.country}
          </span>
        </div>
      </div>

      {!past ? (
        <div className="mt-4 rounded-xl bg-muted/30 p-4">
          <div className="text-xs text-muted-foreground">{live ? "赛事进行中" : "距开赛"}</div>
          {/* 里程碑彩蛋覆盖层 */}
          {milestoneVisible ? (
            <div className="mt-1" style={{ minHeight: "2.5rem" }}>
              <span
                className="animate-in fade-in slide-in-from-left-4 text-2xl font-bold duration-700"
                style={{ color: milestoneColor, textShadow: `0 0 20px ${milestoneColor}44` }}
              >
                {milestoneText}
              </span>
            </div>
          ) : (
          <div
            className="mt-1 flex items-baseline gap-1 font-mono font-bold tabular-nums cursor-pointer select-none"
            onClick={enterImmersive}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault()
                enterImmersive()
              }
            }}
            role="button"
            tabIndex={!live ? 0 : -1}
            aria-label={!live ? `点击或按 F 键进入沉浸式倒计时` : "赛事进行中"}
            title={!live ? "点击进入沉浸式倒计时 (F)" : undefined}
          >
            {live ? (
              <span className="flex items-center gap-2 text-2xl text-red-500">
                <span className="relative flex h-3 w-3">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
                  <span className="relative inline-flex h-3 w-3 rounded-full bg-red-500" />
                </span>
                正在进行
              </span>
            ) : (
              <>
                <TimeBlock value={c.days} unit="天" stage={stage} accentColor={accentColor} />
                <TimeBlock value={c.hours} unit="时" stage={stage} accentColor={accentColor} />
                <TimeBlock value={c.minutes} unit="分" stage={stage} accentColor={accentColor} />
                <TimeBlock value={c.seconds} unit="秒" stage={stage} accentColor={accentColor} />
              </>
            )}
          </div>
          )}
          <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
            <span>{formatDateTime(target.utc, BEIJING_TZ)} 北京时间</span>
            {!live && !past && (
              <kbd className="rounded border border-border bg-background px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground">
                F
              </kbd>
            )}
          </div>
        </div>
      ) : null}

      {/* 预测投票 */}
      <PredictionVote event={event} />

      <div className="mt-4">
        <div className="mb-2 flex items-center justify-between">
          <div className="text-xs font-medium text-muted-foreground">赛程安排</div>
          <button
            onClick={() => setShowHelp((v) => !v)}
            className="text-[10px] text-muted-foreground hover:text-foreground transition-colors"
          >
            快捷键: F 沉浸式 · / 搜索 · ? 帮助
          </button>
        </div>
        <div className="space-y-1.5">
          {event.sessions.slice(0, 6).map((session, idx) => {
            const sessionPast = new Date(session.utc).getTime() < now
            const sessionIsNight = isNightRace(session.utc, event.tz)
            return (
              <div
                key={idx}
                className={`flex items-center justify-between rounded-lg px-3 py-2 text-sm ${
                  sessionPast ? "opacity-50" : ""
                }`}
              >
                <div className="flex items-center gap-2">
                  {session.isMain ? (
                    <Trophy className="size-3.5 text-primary" />
                  ) : (
                    <Clock className="size-3.5 text-muted-foreground" />
                  )}
                  <span className="font-medium">{session.name}</span>
                  {sessionIsNight && (
                    <Moon className="size-3 text-indigo-400" title="夜赛" aria-label="夜赛" />
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <div className="font-mono text-xs tabular-nums text-muted-foreground">
                    {formatTime(session.utc, BEIJING_TZ)}
                  </div>
                </div>
              </div>
            )
          })}
          {event.sessions.length > 6 && (
            <div className="text-center text-xs text-muted-foreground pt-1">
              还有 {event.sessions.length - 6} 场...
            </div>
          )}
        </div>
      </div>

      {/* 快捷键帮助 */}
      {showHelp && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setShowHelp(false)}
          role="dialog"
          aria-label="键盘快捷键帮助"
        >
          <div
            className="w-full max-w-xs rounded-2xl border border-border bg-card p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="mb-4 text-lg font-bold">键盘快捷键</h3>
            <div className="space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <span>进入沉浸式倒计时</span>
                <kbd className="rounded border border-border bg-background px-2 py-1 text-xs font-mono">F</kbd>
              </div>
              <div className="flex items-center justify-between">
                <span>聚焦搜索框</span>
                <kbd className="rounded border border-border bg-background px-2 py-1 text-xs font-mono">/</kbd>
              </div>
              <div className="flex items-center justify-between">
                <span>显示/隐藏帮助</span>
                <kbd className="rounded border border-border bg-background px-2 py-1 text-xs font-mono">?</kbd>
              </div>
              <div className="flex items-center justify-between">
                <span>关闭对话框</span>
                <kbd className="rounded border border-border bg-background px-2 py-1 text-xs font-mono">Esc</kbd>
              </div>
            </div>
            <p className="mt-4 text-xs text-muted-foreground">
              提示：在非输入框状态下使用快捷键
            </p>
          </div>
        </div>
      )}

      {immersiveOpen && (
        <ImmersiveCountdown
          targetTime={target.utc}
          series={event.series}
          onClose={() => setImmersiveOpen(false)}
        />
      )}
    </section>
  )
}

function TimeBlock({
  value,
  unit,
  stage,
  accentColor,
}: {
  value: number
  unit: string
  stage: CountdownStage
  accentColor: string
}) {
  const sizeClass =
    stage === "final"
      ? "text-4xl sm:text-5xl"
      : stage === "urgent"
        ? "text-3xl sm:text-4xl"
        : "text-2xl sm:text-3xl"

  const showAccent = stage === "final" || stage === "urgent"
  const textStyle = showAccent
    ? { color: accentColor, textShadow: `0 0 24px ${accentColor}55` }
    : undefined

  return (
    <span className="flex items-baseline">
      <span
        className={`${sizeClass} transition-all duration-500 ${stage === "final" ? "animate-pulse" : ""}`}
        style={textStyle}
      >
        {String(value).padStart(2, "0")}
      </span>
      <span className="ml-0.5 mr-2 text-sm text-muted-foreground">{unit}</span>
    </span>
  )
}
