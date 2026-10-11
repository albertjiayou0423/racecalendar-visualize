"use client"

import { useEffect } from "react"
import { usePathname } from "next/navigation"
import { useSWRConfig } from "swr"
import { CLIENT_CRAWL_INTERVAL, fetchClientCrawl, type ClientCrawlJob } from "@/lib/client-crawl"

let lastAttempt = 0
const KEY = "racecalendar:client-crawl-attempt"
export function ClientCrawl() {
  const pathname = usePathname()
  const { mutate } = useSWRConfig()
  useEffect(() => {
    if (pathname.startsWith("/admin") || pathname.startsWith("/api")) return
    let disposed = false, timer = 0
    let active: AbortController | null = null
    const allowed = () => {
      const connection = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection
      return navigator.onLine && !document.hidden && !connection?.saveData && !["slow-2g", "2g"].includes(connection?.effectiveType || "")
    }
    const run = async () => {
      if (disposed || active || !allowed()) return
      let previous = lastAttempt
      try { previous = Math.max(previous, Number(localStorage.getItem(KEY)) || 0) } catch { /* In-memory cooldown remains. */ }
      if (Date.now() - previous < CLIENT_CRAWL_INTERVAL) { schedule(CLIENT_CRAWL_INTERVAL - (Date.now() - previous)); return }
      lastAttempt = Date.now()
      try { localStorage.setItem(KEY, String(lastAttempt)) } catch { /* Storage is optional. */ }
      const controller = new AbortController()
      active = controller
      const timeout = window.setTimeout(() => controller.abort(), 35000)
      try {
        const plan = await fetch("/api/client-crawl", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "claim" }), cache: "no-store", signal: controller.signal })
        if (!plan.ok) return
        const { jobs } = await plan.json() as { jobs: ClientCrawlJob[] }
        if (!Array.isArray(jobs)) return
        for (const job of jobs.slice(0, 2)) {
          if (controller.signal.aborted || !allowed()) break
          let raw: string | undefined
          try { raw = await fetchClientCrawl(job, AbortSignal.any([controller.signal, AbortSignal.timeout(12000)])) } catch { /* CORS, timeout or offline: report a bounded failure, never upload partial data. */ }
          if (controller.signal.aborted) break
          const upload = await fetch("/api/client-crawl", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "submit", id: job.id, token: job.token, raw, failed: raw === undefined }), cache: "no-store", signal: controller.signal })
          if (upload.ok && (await upload.json()).saved) await mutate("/api/schedule")
        }
      } catch { /* Optional contribution must not block or disrupt the page. */ }
      finally { window.clearTimeout(timeout); active = null; schedule(CLIENT_CRAWL_INTERVAL) }
    }
    function schedule(delay = 6000) { window.clearTimeout(timer); if (!disposed) timer = window.setTimeout(run, delay) }
    const resume = () => { if (allowed()) schedule(); else active?.abort() }
    schedule()
    document.addEventListener("visibilitychange", resume)
    window.addEventListener("online", resume)
    return () => { disposed = true; window.clearTimeout(timer); active?.abort(); document.removeEventListener("visibilitychange", resume); window.removeEventListener("online", resume) }
  }, [pathname, mutate])
  return null
}
