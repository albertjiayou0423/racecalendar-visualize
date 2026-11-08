import type { Metadata } from "next"
import Link from "next/link"
import { ArrowLeft, ExternalLink } from "lucide-react"
import { ApiMonitorStatus } from "@/components/api-monitor-status"
import { StatusPageEmbed } from "@/components/status-page-embed"

export const metadata: Metadata = {
  title: "服务状态 · 赛道时刻",
  description: "查看赛道时刻官方网站的可用性与服务状态。",
}

const STATUS_PAGE_URL = "https://racecalendar-huosai.openstatus.dev/"
const EMBED_URL = `${STATUS_PAGE_URL}?embed=banner,components&theme=dark`
const EVENT_HISTORY_EMBED_URL = `${STATUS_PAGE_URL}events?embed&theme=dark`

export default function StatusPage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col px-4 pb-8 pt-5 sm:px-6 sm:pb-12 sm:pt-8">
      <header className="flex items-center justify-between gap-4 border-b border-border/70 pb-5 sm:pb-6">
        <div className="flex min-w-0 items-center gap-3.5">
          <Link
            href="/"
            className="flex size-10 shrink-0 items-center justify-center rounded-full border border-border/80 text-muted-foreground transition-colors hover:border-foreground/30 hover:text-foreground"
            aria-label="返回首页"
          >
            <ArrowLeft className="size-4" />
          </Link>
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">RACECALENDAR / STATUS</p>
            <h1 className="mt-1 text-xl font-bold tracking-tight sm:text-2xl">服务状态</h1>
          </div>
        </div>
        <a
          href={STATUS_PAGE_URL}
          target="_blank"
          rel="noreferrer"
          className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-border/80 px-3.5 py-2 text-xs text-muted-foreground transition-colors hover:border-foreground/30 hover:text-foreground"
        >
          <ExternalLink className="size-3" />
          OpenStatus
        </a>
      </header>

      <div className="pt-5 sm:pt-6">
        <ApiMonitorStatus />
      </div>

      <section aria-label="网站可用性与维护记录" className="mt-10 border-t border-border/70 pt-6">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">网站可用性与维护记录</h2>
            <p className="mt-1 text-xs text-muted-foreground">网站访问状态、维护安排与公开更新</p>
          </div>
          <a
            href={STATUS_PAGE_URL}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            <ExternalLink className="size-3" />
            在 OpenStatus 查看
          </a>
        </div>
        <StatusPageEmbed src={EMBED_URL} title="赛道时刻网站当前状态" heightClassName="h-[300px] w-full sm:h-[340px]" />
      </section>

      <section aria-label="OpenStatus 事件历史" className="mt-8 border-t border-border/70 pt-6">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">事件历史</h2>
            <p className="mt-1 text-xs text-muted-foreground">OpenStatus 维护公告与服务事件记录</p>
          </div>
          <a
            href={`${STATUS_PAGE_URL}events`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            <ExternalLink className="size-3" />
            查看全部事件
          </a>
        </div>
        <StatusPageEmbed
          src={EVENT_HISTORY_EMBED_URL}
          title="赛道时刻 OpenStatus 事件历史"
          heightClassName="h-[440px] w-full sm:h-[500px]"
        />
      </section>
    </main>
  )
}
