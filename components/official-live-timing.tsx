"use client"

import { useState } from "react"
import { ExternalLink, ChevronDown, ChevronRight, Globe, Info } from "lucide-react"

interface OfficialLiveTimingProps {
  url: string
  eventName: string
  disabled?: boolean
}

/**
 * 官方 Live Timing 入口：
 * WRC.com 是反爬严格的 SPA，iframe + HTML 代理无法承载其实时计时页面。
 * 改为提供醒目的外跳入口 + 展开说明，保证用户能稳定到达官方实时数据页。
 */
export function OfficialLiveTiming({ url, eventName, disabled }: OfficialLiveTimingProps) {
  const [expanded, setExpanded] = useState(false)

  if (disabled) return null

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-secondary/50 transition-colors"
        aria-expanded={expanded}
      >
        {expanded ? (
          <ChevronDown className="size-4 text-muted-foreground" />
        ) : (
          <ChevronRight className="size-4 text-muted-foreground" />
        )}
        <Globe className="size-4 text-primary" />
        <span className="font-medium">官方 Live Timing</span>
        <span className="text-xs text-muted-foreground ml-auto">
          {expanded ? "点击收起" : "点击展开"}
        </span>
      </button>

      {expanded && (
        <div className="border-t border-border p-4">
          <div className="flex items-start gap-2 mb-4">
            <Info className="size-4 shrink-0 text-muted-foreground mt-0.5" />
            <p className="text-xs text-muted-foreground leading-relaxed">
              WRC 官方实时计时需在 wrc.com 独立页面查看（含分段计时、赛段成绩等）。
              点击下方按钮将在新窗口打开 {eventName} 的官方实时数据页。
            </p>
          </div>
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            <ExternalLink className="size-4" />
            在新窗口打开官方 Live Timing
          </a>
        </div>
      )}
    </div>
  )
}
