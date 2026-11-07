import type { Metadata } from "next"
import Link from "next/link"
import { Activity, ArrowLeft, ExternalLink } from "lucide-react"
import { StatusPageEmbed } from "@/components/status-page-embed"

export const metadata: Metadata = {
  title: "服务状态 · 赛道时刻",
  description: "查看赛道时刻官方网站的可用性与服务状态。",
}

const STATUS_PAGE_URL = "https://racecalendar-huosai.openstatus.dev/"
const EMBED_URL = `${STATUS_PAGE_URL}?embed=banner,components&theme=dark`

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

      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 py-5 sm:py-6">
        <p className="text-sm text-muted-foreground">官方网站的可用性与历史记录</p>
        <div className="inline-flex items-center gap-2 text-xs text-muted-foreground">
          <Activity className="size-3.5" aria-hidden="true" />
          OpenStatus 实时监控
        </div>
      </div>

      <section aria-label="赛道时刻服务状态" className="overflow-hidden rounded-2xl border border-border/80 bg-card/30 shadow-[0_18px_60px_-40px_rgb(0_0_0/0.8)]">
        <StatusPageEmbed src={EMBED_URL} />
      </section>
    </main>
  )
}
