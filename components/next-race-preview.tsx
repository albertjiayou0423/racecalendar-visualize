"use client"

import { useState, useEffect, useRef } from "react"
import { Clock, MapPin, Calendar, Trophy, Maximize2 } from "lucide-react"
import type { RaceEvent, Series } from "@/lib/types"
import {
  countdown,
  firstSession,
  formatDateTime,
  formatTime,
  isLive,
  isPast,
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

export function NextRacePreview({ event, now }: NextRacePreviewProps) {
  const first = firstSession(event)
  const meta = SERIES_META[event.series]
  const { burst } = useConfettiBurst()
  const { play } = useRaceSound()
  const [immersiveOpen, setImmersiveOpen] = useState(false)
  const [milestoneVisible, setMilestoneVisible] = useState(true)
  const prevStageRef = useRef<CountdownStage>("far")
  const firstTriggerRef = useRef(false)

  if (!first) return null

  const c = countdown(first.utc, now)
  const live = isLive(event, now)
  const past = isPast(event, now)
  const accentColor = SERIES_ACCENT[event.series]

  const totalSeconds =
    c.days * 86400 + c.hours * 3600 + c.minutes * 60 + c.seconds
  const stage = getCountdownStage(totalSeconds)

  // 页面加载时显示里程碑彩蛋，7秒后自动消失
  useEffect(() => {
    const timer = setTimeout(() => setMilestoneVisible(false), 7000)
    return () => clearTimeout(timer)
  }, [])

  useEffect(() => {
    if (live) {
      if (!firstTriggerRef.current) {
        firstTriggerRef.current = true
        play("start")
        burst(event.series, "grand")
      }
      prevStageRef.current = "past"
      return
    }
    firstTriggerRef.current = false

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
            <div className="mt-1 flex items-center gap-2" style={{ minHeight: "2.5rem" }}>
              <span
                className="animate-in fade-in slide-in-from-left-4 text-2xl font-bold duration-700"
                style={{ color: milestoneColor, textShadow: `0 0 20px ${milestoneColor}44` }}
              >
                {milestoneText}
              </span>
              <span className="text-xs text-muted-foreground">（倒计时恢复中…）</span>
            </div>
          ) : (
          <div className="mt-1 flex items-baseline gap-1 font-mono font-bold tabular-nums">
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
            <span>{formatDateTime(first.utc, BEIJING_TZ)} 北京时间</span>
            {!live && (
              <button
                onClick={() => setImmersiveOpen(true)}
                className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-0.5 text-[11px] text-muted-foreground transition-colors hover:border-primary hover:text-primary"
                title="进入沉浸式倒计时模式"
              >
                <Maximize2 className="size-3" />
                沉浸式
              </button>
            )}
          </div>
        </div>
      ) : null}

      {/* 预测投票 */}
      <PredictionVote event={event} />

      <div className="mt-4">
        <div className="text-xs font-medium text-muted-foreground mb-2">赛程安排</div>
        <div className="space-y-1.5">
          {event.sessions.slice(0, 6).map((session, idx) => {
            const sessionPast = new Date(session.utc).getTime() < now
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
                </div>
                <div className="font-mono text-xs tabular-nums text-muted-foreground">
                  {formatTime(session.utc, BEIJING_TZ)}
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

      {immersiveOpen && (
        <ImmersiveCountdown
          targetTime={first.utc}
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
