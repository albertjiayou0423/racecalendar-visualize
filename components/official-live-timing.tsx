"use client"

import { useState } from "react"
import { ExternalLink, ChevronDown, ChevronRight, Globe, RefreshCw } from "lucide-react"

interface OfficialLiveTimingProps {
  url: string
  eventName: string
  disabled?: boolean
}

export function OfficialLiveTiming({ url, eventName, disabled }: OfficialLiveTimingProps) {
  const [expanded, setExpanded] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState(false)

  if (disabled) return null

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-secondary/50 transition-colors"
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
        <div className="border-t border-border">
          {error ? (
            <div className="p-4 text-center">
              <p className="text-sm text-muted-foreground mb-3">
                无法在页面内加载官方 Live Timing
              </p>
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
              >
                <ExternalLink className="size-4" />
                在新窗口打开官方 Live Timing
              </a>
            </div>
          ) : (
            <div className="relative">
              <iframe
                src={url}
                title={`${eventName} 官方 Live Timing`}
                className="w-full h-[600px] border-0"
                onLoad={() => setLoaded(true)}
                onError={() => setError(true)}
                sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
              />
              {!loaded && !error && (
                <div className="absolute inset-0 flex items-center justify-center bg-background/80">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <RefreshCw className="size-4 animate-spin" />
                    正在加载官方 Live Timing...
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="flex items-center justify-between border-t border-border px-4 py-2 bg-muted/30">
            <span className="text-xs text-muted-foreground">
              数据来源：WRC 官方网站
            </span>
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
            >
              <ExternalLink className="size-3" />
              查看完整页面
            </a>
          </div>
        </div>
      )}
    </div>
  )
}