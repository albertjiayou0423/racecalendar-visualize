"use client"

import { usePathname } from "next/navigation"
import { useState } from "react"
import { Check, Copy, Share2 } from "lucide-react"
import type { RaceEvent, RaceSession } from "@/lib/types"

export function TogetherShareButton({ event, session, compact = false }: { event: RaceEvent; session: RaceSession; compact?: boolean }) {
  const pathname = usePathname()
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState("")
  const [manualUrl, setManualUrl] = useState("")

  async function share() {
    const url = new URL(`/together/${encodeURIComponent(event.id)}`, window.location.origin)
    url.searchParams.set("at", session.utc)
    url.searchParams.set("session", session.name)
    if (pathname.startsWith("/new")) url.searchParams.set("from", "new")
    const title = `一起等发车 · ${event.name}`
    const text = `${event.name} · ${session.name}，打开链接一起看同一场倒计时。`
    setError("")
    setManualUrl("")
    try {
      if (navigator.share) {
        await navigator.share({ title, text, url: url.toString() })
        return
      }
      await navigator.clipboard.writeText(url.toString())
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2200)
    } catch (cause) {
      if (cause instanceof DOMException && cause.name === "AbortError") return
      try {
        await navigator.clipboard.writeText(url.toString())
        setCopied(true)
        window.setTimeout(() => setCopied(false), 2200)
      } catch {
        setManualUrl(url.toString())
        setError("自动分享不可用，请手动复制下面的链接。")
      }
    }
  }

  return <span className="inline-flex flex-col items-start">
    <button type="button" onClick={() => void share()} aria-label={`邀请朋友一起等${event.name}${session.name}`} title="邀请朋友一起等发车" className={compact
      ? "inline-flex min-h-8 items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
      : "inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-medium transition-colors hover:bg-secondary"}>
      {copied ? <Check className="size-3.5" aria-hidden /> : compact ? <Share2 className="size-3.5" aria-hidden /> : <Copy className="size-4" aria-hidden />}
      {compact ? (copied ? "已复制" : "一起等") : (copied ? "链接已复制" : "邀请朋友一起等发车")}
    </button>
    {error && <span role="status" className="mt-1 text-xs text-muted-foreground">{error}</span>}
    {manualUrl && <input aria-label="共同倒计时分享链接" readOnly value={manualUrl} onFocus={(event) => event.currentTarget.select()} className="mt-2 w-full max-w-[min(22rem,80vw)] rounded-md border border-border bg-background px-2 py-1.5 text-xs text-muted-foreground" />}
  </span>
}
