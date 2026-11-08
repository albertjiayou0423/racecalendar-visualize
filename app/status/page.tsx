import type { Metadata } from "next"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { ApiMonitorStatus } from "@/components/api-monitor-status"
import { StatusPageEmbed } from "@/components/status-page-embed"

export const metadata: Metadata = {
  title: "服务状态 · 赛道时刻",
  description: "查看赛道时刻官方网站的可用性与服务状态。",
}

const STATUS_PAGE_URL = "https://racecalendar-huosai.openstatus.dev/"
const EMBED_URL = `${STATUS_PAGE_URL}?embed=banner,components&theme=dark`

export default function StatusPage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col px-4 pb-8 pt-3 sm:px-6 sm:pb-12 sm:pt-5">
      <header className="flex items-center pb-2">
        <Link
          href="/"
          className="flex size-9 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          aria-label="返回首页"
        >
          <ArrowLeft className="size-4" />
        </Link>
        <h1 className="sr-only">服务状态</h1>
      </header>

      <section aria-label="公开网站状态" className="pt-2">
        <StatusPageEmbed src={EMBED_URL} title="赛道时刻网站状态" heightClassName="h-[560px] w-full sm:h-[620px]" />
      </section>

      <div className="mt-8">
        <ApiMonitorStatus />
      </div>
    </main>
  )
}
