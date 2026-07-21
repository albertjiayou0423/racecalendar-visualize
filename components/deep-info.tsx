"use client"

import { ChevronDown, ExternalLink } from "lucide-react"
import { useState } from "react"
import type { RaceEvent } from "@/lib/types"
import { WikipediaImage } from "./wikipedia-image"
import { cn } from "@/lib/utils"

interface DeepInfoProps {
  event: RaceEvent
}

export function DeepInfo({ event }: DeepInfoProps) {
  const [show, setShow] = useState(false)

  const hasContent =
    event.circuitImageUrl ||
    event.circuitWikipediaUrl ||
    event.circuitInfo ||
    event.circuitType ||
    event.lastYearWinner ||
    event.lastYearFastestLap ||
    event.extraInfo ||
    event.url ||
    event.wikipediaUrl

  if (!hasContent) {
    return null
  }

  return (
    <section className="mt-4 rounded-xl border border-border bg-card overflow-hidden">
      <button
        onClick={() => setShow(!show)}
        className="flex w-full items-center justify-between px-5 py-4 text-left"
        aria-expanded={show}
      >
        <span className="text-sm font-semibold">深度信息</span>
        <ChevronDown className={cn("size-4 transition-transform", show && "rotate-180")} />
      </button>
      {show && (
        <div className="border-t border-border p-5 space-y-4">
          {event.circuitImageUrl ? (
            <div>
              <h3 className="text-xs font-medium text-muted-foreground mb-2">赛道平面图</h3>
              <img
                src={event.circuitImageUrl}
                alt={`${event.circuit} 赛道平面图`}
                className="h-auto w-full max-h-[200px] rounded-lg object-contain"
              />
            </div>
          ) : event.circuitWikipediaUrl ? (
            <div>
              <h3 className="text-xs font-medium text-muted-foreground mb-2">赛道图片</h3>
              <WikipediaImage url={event.circuitWikipediaUrl} />
            </div>
          ) : null}

          {event.circuitInfo && (
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg bg-secondary/30 p-3">
                <div className="text-xs text-muted-foreground">赛道长度</div>
                <div className="mt-0.5 text-sm font-medium">{event.circuitInfo.length}</div>
              </div>
              <div className="rounded-lg bg-secondary/30 p-3">
                <div className="text-xs text-muted-foreground">比赛圈数</div>
                <div className="mt-0.5 text-sm font-medium">{event.circuitInfo.laps} 圈</div>
              </div>
            </div>
          )}

          {event.circuitType && (
            <div>
              <div className="text-xs text-muted-foreground">赛道类型</div>
              <span className="rounded-full bg-secondary px-2 py-1 text-xs font-medium">
                {event.circuitType === "street"
                  ? "街道赛"
                  : event.circuitType === "permanent"
                  ? "永久性赛道"
                  : event.circuitType === "hybrid"
                  ? "混合赛道"
                  : "拉力赛"}
              </span>
            </div>
          )}

          {event.lastYearWinner && (
            <div className="rounded-lg bg-secondary/30 p-3">
              <div className="text-xs font-medium text-muted-foreground">2025 冠军</div>
              <div className="mt-1 text-sm">
                <span className="font-medium">{event.lastYearWinner.driver}</span>
                <span className="text-muted-foreground"> · {event.lastYearWinner.constructor}</span>
              </div>
            </div>
          )}

          {event.lastYearFastestLap && (
            <div className="rounded-lg bg-secondary/30 p-3">
              <div className="text-xs font-medium text-muted-foreground">2025 最快圈速</div>
              <div className="mt-1 text-sm">
                <span className="font-medium">{event.lastYearFastestLap.driver}</span>
                <span className="text-muted-foreground"> · {event.lastYearFastestLap.time}</span>
                <span className="text-muted-foreground"> · 第 {event.lastYearFastestLap.lap} 圈</span>
              </div>
            </div>
          )}

          {event.extraInfo && event.extraInfo.length > 0 && (
            <div className="grid gap-2">
              {event.extraInfo.map((info, i) => (
                <div key={i} className="flex items-center justify-between rounded-lg bg-secondary/30 px-3 py-2 text-sm">
                  <span className="text-muted-foreground">{info.label}</span>
                  <span className="font-medium">{info.value}</span>
                </div>
              ))}
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            {event.url && (
              <a
                href={event.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 rounded-md bg-secondary px-3 py-1.5 text-xs text-primary hover:bg-secondary/80"
              >
                <ExternalLink className="size-3" />
                官方网站
              </a>
            )}
            {event.wikipediaUrl && (
              <a
                href={event.wikipediaUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 rounded-md bg-secondary px-3 py-1.5 text-xs text-primary hover:bg-secondary/80"
              >
                <ExternalLink className="size-3" />
                赛事 Wiki
              </a>
            )}
            {event.circuitWikipediaUrl && event.circuitWikipediaUrl !== event.wikipediaUrl && (
              <a
                href={event.circuitWikipediaUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 rounded-md bg-secondary px-3 py-1.5 text-xs text-primary hover:bg-secondary/80"
              >
                <ExternalLink className="size-3" />
                赛道 Wiki
              </a>
            )}
          </div>

          <p className="text-[10px] text-muted-foreground">
            数据仅供参考，实际比赛时间和结果以官方公告为准。
          </p>
        </div>
      )}
    </section>
  )
}