"use client"

import { useState, useEffect } from "react"
import { Clock, MapPin, Calendar } from "lucide-react"
import type { RaceEvent } from "@/lib/types"
import { firstSession, formatDateTime, SERIES_META, isLive, isPast } from "@/lib/format"
import { BEIJING_TZ } from "@/lib/format"
import { PredictionVote } from "@/components/prediction-vote"
import { MultiSessionCountdown } from "@/components/multi-session-countdown"
import { cn } from "@/lib/utils"

interface NextRacePreviewProps {
  event: RaceEvent
  now?: number
}

export function NextRacePreview({ event, now }: NextRacePreviewProps) {
  const first = firstSession(event)
  const meta = SERIES_META[event.series]
  const [localNow, setLocalNow] = useState<number>(now ?? 0)

  // 如果未传入 now，本地维护时间
  useEffect(() => {
    if (now !== undefined) return
    setLocalNow(Date.now())
    const timer = setInterval(() => setLocalNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [now])

  const currentTime = now ?? localNow

  return (
    <section
      className="relative overflow-hidden rounded-2xl border border-border bg-card p-5 sm:p-6"
      aria-label="下一站预览"
    >
      <div
        className="absolute inset-x-0 top-0 h-1"
        style={{ backgroundColor: meta.color }}
        aria-hidden
      />
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <span
          className="rounded px-2 py-0.5 font-bold"
          style={{ backgroundColor: meta.color, color: meta.textColor }}
        >
          {meta.label}
        </span>
        <span>{meta.full}</span>
        <span>·</span>
        <span>第 {event.round} 轮</span>
        <span>·</span>
        <span>下一站</span>
      </div>

      <h2 className="mt-3 text-pretty text-xl font-bold leading-tight sm:text-2xl">
        {event.name}
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

      {first ? (
        <div className="mt-4 rounded-xl bg-muted/30 p-4">
          <div className="text-xs text-muted-foreground">距开赛</div>
          <div className="mt-1 font-mono text-2xl font-bold tabular-nums">
            <Countdown targetTime={first.utc} event={event} />
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            {formatDateTime(first.utc, BEIJING_TZ)} 北京时间
          </div>
        </div>
      ) : null}

      {/* 预测投票 */}
      <PredictionVote event={event} />

      {/* 多场次联动倒计时（替换原简陋列表，支持移动端横向滚动 + 状态联动） */}
      <div className="mt-4">
        <MultiSessionCountdown event={event} now={currentTime} />
      </div>
    </section>
  )
}

function Countdown({ targetTime, event }: { targetTime: string; event: RaceEvent }) {
  const [now, setNow] = useState<number | null>(null)

  useEffect(() => {
    setNow(Date.now())
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [])

  if (now === null) {
    return <span>--:--:--</span>
  }

  // 修复归零卡死 bug：归零后切换到 LIVE / 已结束状态
  if (isLive(event, now)) {
    return (
      <span className="flex items-center gap-1.5 text-red-500">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500" />
        </span>
        进行中
      </span>
    )
  }
  if (isPast(event, now)) {
    return <span className="text-muted-foreground">已结束</span>
  }

  const diff = new Date(targetTime).getTime() - now
  const days = Math.floor(diff / (1000 * 60 * 60 * 24))
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
  const seconds = Math.floor((diff % (1000 * 60)) / 1000)

  // 统一阈值：≤30 分钟标红脉冲
  const urgent = days === 0 && hours === 0 && minutes < 30

  return (
    <span className={cn("tabular-nums", urgent && "text-red-500 animate-pulse")}>
      {days > 0 && `${days}天 `}
      {String(hours).padStart(2, "0")}:{String(minutes).padStart(2, "0")}:
      {String(seconds).padStart(2, "0")}
    </span>
  )
}
