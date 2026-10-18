"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { ArrowUpRight } from "lucide-react"

/** Preference handling is separate from the footer link and never opens a dialog. */
export function EditionRedirect() {
  const router = useRouter()
  useEffect(() => {
    try {
      if (new URLSearchParams(location.search).get("home") === "classic") {
        localStorage.removeItem("racecalendar-home-version")
        return
      }
      if (localStorage.getItem("racecalendar-home-version") === "new") router.replace("/new")
    } catch { /* The classic homepage remains usable when storage is unavailable. */ }
  }, [router])
  return null
}

export function EditionEntry() {
  return <Link href="/new" className="inline-flex items-center gap-1.5 rounded-full border border-border px-4 py-1.5 text-xs text-muted-foreground transition-colors hover:border-primary hover:text-foreground">
    <ArrowUpRight className="size-3.5" aria-hidden="true" />试试新版
  </Link>
}
