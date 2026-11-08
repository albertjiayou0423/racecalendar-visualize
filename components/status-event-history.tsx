"use client"

import { useState } from "react"
import { ChevronDown, ExternalLink } from "lucide-react"
import { StatusPageEmbed } from "@/components/status-page-embed"

type StatusEventHistoryProps = {
  src: string
  externalUrl: string
}

export function StatusEventHistory({ src, externalUrl }: StatusEventHistoryProps) {
  const [open, setOpen] = useState(false)

  return (
    <section className="border-t border-border/60 pt-2" aria-labelledby="status-event-history-title">
      <h2 id="status-event-history-title" className="sr-only">维护与事件历史</h2>
      <div className="flex items-center gap-4">
        <button
          type="button"
          aria-expanded={open}
          aria-controls="status-event-history-content"
          onClick={() => setOpen((current) => !current)}
          className="flex min-h-11 flex-1 items-center justify-between gap-3 text-left text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <span>事件历史</span>
          <span className="flex items-center gap-2 text-xs">
            {open ? "收起" : "展开"}
            <ChevronDown className={`size-4 transition-transform ${open ? "rotate-180" : ""}`} aria-hidden="true" />
          </span>
        </button>
        <a
          href={externalUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          OpenStatus
          <ExternalLink className="size-3" aria-hidden="true" />
        </a>
      </div>

      {open && (
        <div id="status-event-history-content" className="pb-2">
          <StatusPageEmbed
            src={src}
            title="赛道时刻维护与事件历史"
            heightClassName="h-[920px] w-full sm:h-[800px]"
          />
        </div>
      )}
    </section>
  )
}
