"use client"

import { useEffect, useRef, useState } from "react"
import { Clock } from "lucide-react"
import type { RaceEvent } from "@/lib/types"
import { countdown, formatDateTime, isLive, isPast } from "@/lib/format"
import { BEIJING_TZ } from "@/lib/format"
import { useConfettiBurst, useRaceSound } from "@/lib/countdown-hooks"
import { cn } from "@/lib/utils"

type CountdownStage = "far" | "today" | "soon" | "urgent" | "final" | "past"

function getCountdownStage(seconds: number): CountdownStage {
  if (seconds <= 0) return "past"
  if (seconds <= 60) return "final"
  if (seconds <= 600) return "urgent"
  if (seconds <= 1800) return "soon"
  if (seconds <= 86400) return "today"
  return "far"
}

const STAGE_COLORS: Record<CountdownStage, string> = {
  far: "text-muted-foreground",
  today: "text-foreground",
  soon: "text-amber-500",
  urgent: "text-orange-500",
  final: "text-red-500",
  past: "text-muted-foreground",
}

interface NextSessionPillProps {
  event: RaceEvent
  now: number
}

/** 找到下一个未结束的 session */
function findNextSession(event: RaceEvent, now: number) {
  for (const s of event.sessions) {
    const start = new Date(s.utc).getTime()
    const end = start + 2 * 60 * 60 * 1000
    if (now < end) {
      const live = now >= start && now <= end
      return { session: s, start, end, live }
    }
  }
  return null
}

export function NextSessionPill({ event, now }: NextSessionPillProps) {
  const { play } = useRaceSound()
  const { burst } = useConfettiBurst()
  const prevStageRef = useRef<CountdownStage>("far")
  const triggeredRef = useRef(false)
  const [visible, setVisible] = useState(false)

  const next = findNextSession(event, now)
  const past = isPast(event, now)
  const live = isLive(event, now)

  useEffect(() => {
    // 滚动超过 100px 后显示吸顶胶囊
    const onScroll = () => setVisible(window.scrollY > 120)
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => window.removeEventListener("scroll", onScroll)
  }, [])

  if (!next || past) return null

  const c = countdown(next.session.utc, now)
  const totalSeconds = c.days * 86400 + c.hours * 3600 + c.minutes * 60 + c.seconds
  const stage = getCountdownStage(totalSeconds)

  useEffect(() => {
    if (next?.live) {
      if (!triggeredRef.current) {
        triggeredRef.current = true
        play("start")
        burst(event.series, "grand")
      }
      prevStageRef.current = "past"
      return
    }
    triggeredRef.current = false

    const prev = prevStageRef.current
    if (prev !== stage) {
      if (stage === "final" && prev !== "final") {
        play("tick")
      }
      prevStageRef.current = stage
    }
  }, [stage, next?.live, burst, play, event.series])

  useEffect(() => {
    if (stage !== "final" || next?.live) return
    const id = setInterval(() => play("tick"), 1000)
    return () => clearInterval(id)
  }, [stage, next?.live, play])

  return (
    <div
      className={cn(
        "fixed top-14 left-1/2 z-30 -translate-x-1/2 transition-all duration-300",
        visible ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-4 pointer-events-none"
      )}
    >
      <div className="flex items-center gap-2 rounded-full border border-border bg-card/95 px-3 py-1.5 shadow-lg backdrop-blur">
        {next.live ? (
          <>
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500" />
            </span>
            <span className="text-xs font-medium text-red-500">
              {next.session.name} · 进行中
            </span>
          </>
        ) : (
          <>
            <Clock className={cn("size-3.5", STAGE_COLORS[stage])} />
            <span className="text-xs text-muted-foreground">{next.session.name}</span>
            <span className={cn("font-mono text-xs font-bold tabular-nums", STAGE_COLORS[stage])}>
              {c.days > 0 ? `${c.days}d ` : ""}
              {String(c.hours).padStart(2, "0")}:{String(c.minutes).padStart(2, "0")}:{String(c.seconds).padStart(2, "0")}
            </span>
          </>
        )}
      </div>
    </div>
  )
}
