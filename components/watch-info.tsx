"use client"

import { ExternalLink } from "lucide-react"
import type { RaceEvent } from "@/lib/types"
import { formatTime, mainSession } from "@/lib/format"
import { WeatherCard } from "./weather-card"
import { cn } from "@/lib/utils"

interface WatchInfoProps {
  event: RaceEvent
}

export function WatchInfo({ event }: WatchInfoProps) {
  const main = mainSession(event)
  const hasBroadcasters = (event.broadcasters && event.broadcasters.length > 0) || event.broadcaster

  return (
    <section className="mt-4 rounded-xl border border-border bg-card p-5">
      <h2 className="text-sm font-semibold">观赛信息</h2>

      {hasBroadcasters ? (
        <div className="mt-3 space-y-2">
          {(event.broadcasters || [event.broadcaster]).filter(Boolean).map((b, i) => (
            <div
              key={i}
              className={cn(
                "flex items-center justify-between rounded-lg border p-3",
                b?.confirmed === false ? "border-amber-500/30 bg-amber-500/5" : "border-border bg-secondary/30"
              )}
            >
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{b?.name}</span>
                  {b?.confirmed === false && (
                    <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] text-amber-600">
                      待确认
                    </span>
                  )}
                </div>
                {b?.note && <p className="mt-1 text-xs text-muted-foreground">{b.note}</p>}
              </div>
              {b?.url && (
                <a
                  href={b.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 rounded-md bg-secondary px-2 py-1 text-xs text-primary hover:bg-secondary/80"
                >
                  观看
                  <ExternalLink className="size-3" />
                </a>
              )}
            </div>
          ))}
          {event.broadcastCheckedAt && (
            <p className="text-[10px] text-muted-foreground">
              直播信息最后核验时间：{new Date(event.broadcastCheckedAt).toLocaleString("zh-CN")}
            </p>
          )}
        </div>
      ) : (
        <div className="mt-3 rounded-lg border border-border bg-secondary/30 p-3 text-center">
          <p className="text-sm text-muted-foreground">直播信息待确认</p>
        </div>
      )}

      {main && (
        <div className="mt-4 pt-4 border-t border-border">
          <h3 className="text-xs font-medium text-muted-foreground">比赛日天气</h3>
          <WeatherCard
            city={event.locality}
            country={event.country}
            date={new Date(main.utc).toISOString().split("T")[0]}
            startTime={formatTime(main.utc, event.tz)}
            lat={event.lat}
            lon={event.lon}
          />
        </div>
      )}
    </section>
  )
}