"use client"

import { MapPin, Trophy, Users } from "lucide-react"
import type { RaceEvent } from "@/lib/types"

interface HighlightsProps {
  event: RaceEvent
}

export function Highlights({ event }: HighlightsProps) {
  const { highlights } = event
  if (!highlights || (!highlights.track && !highlights.championship && !highlights.drivers)) {
    return null
  }

  return (
    <section className="mt-4 rounded-xl border border-border bg-card p-5">
      <h2 className="text-sm font-semibold">比赛看点</h2>
      <div className="mt-3 space-y-3">
        {highlights.track && (
          <div className="flex gap-3">
            <div className="shrink-0 rounded-full bg-blue-500/15 p-2">
              <MapPin className="size-4 text-blue-500" />
            </div>
            <div>
              <div className="text-xs font-medium text-blue-500">赛道特点</div>
              <p className="mt-0.5 text-sm">{highlights.track}</p>
            </div>
          </div>
        )}
        {highlights.championship && (
          <div className="flex gap-3">
            <div className="shrink-0 rounded-full bg-amber-500/15 p-2">
              <Trophy className="size-4 text-amber-500" />
            </div>
            <div>
              <div className="text-xs font-medium text-amber-500">积分形势</div>
              <p className="mt-0.5 text-sm">{highlights.championship}</p>
            </div>
          </div>
        )}
        {highlights.drivers && (
          <div className="flex gap-3">
            <div className="shrink-0 rounded-full bg-green-500/15 p-2">
              <Users className="size-4 text-green-500" />
            </div>
            <div>
              <div className="text-xs font-medium text-green-500">关注车手</div>
              <p className="mt-0.5 text-sm">{highlights.drivers}</p>
            </div>
          </div>
        )}
      </div>
    </section>
  )
}