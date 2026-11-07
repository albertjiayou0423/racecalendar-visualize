import type { Metadata } from "next"
import Link from "next/link"
import { ArrowLeft, ExternalLink } from "lucide-react"

export const metadata: Metadata = {
  title: "服务状态 · 赛道时刻",
  description: "查看赛道时刻官方网站的可用性与服务状态。",
}

const STATUS_PAGE_URL = "https://racecalendar-huosai.openstatus.dev/"
const EMBED_URL = `${STATUS_PAGE_URL}?embed=all&theme=dark`

export default function StatusPage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col gap-5 px-4 py-6 sm:px-6 sm:py-10">
      <header className="flex items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <Link
            href="/"
            className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground transition-colors hover:text-foreground"
            aria-label="返回首页"
          >
            <ArrowLeft className="size-4" />
          </Link>
          <div className="min-w-0">
            <h1 className="text-xl font-bold tracking-tight sm:text-2xl">服务状态</h1>
            <p className="mt-0.5 text-sm text-muted-foreground">赛道时刻官方网站的可用性监控</p>
          </div>
        </div>
        <a
          href={STATUS_PAGE_URL}
          target="_blank"
          rel="noreferrer"
          className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-border px-3.5 py-2 text-xs text-muted-foreground transition-colors hover:border-primary hover:text-foreground"
        >
          <ExternalLink className="size-3.5" />
          OpenStatus
        </a>
      </header>

      <section aria-label="赛道时刻服务状态" className="min-h-[min(78vh,900px)] overflow-hidden rounded-xl border border-border bg-background">
        <iframe
          src={EMBED_URL}
          title="赛道时刻服务状态"
          className="h-[min(78vh,900px)] min-h-[620px] w-full border-0 bg-background"
          loading="lazy"
          referrerPolicy="strict-origin-when-cross-origin"
        />
      </section>
    </main>
  )
}
