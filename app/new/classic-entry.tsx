"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { ArrowUpRight, X } from "lucide-react"
import { useFocusTrap } from "@/lib/use-focus-trap"
import { HOME_INTRO_KEY, readHomePreference, saveHomePreference } from "./home-preference"

/** The only integration into the classic homepage. Playground never mounts it. */
export function NewHomeEntry() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const dialog = useRef<HTMLDivElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  useFocusTrap(dialog, open)
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("home") === "classic") {
      saveHomePreference("classic")
      return
    }
    if (readHomePreference() === "new") { router.replace("/new"); return }
    const timer = window.setTimeout(() => {
      if (document.querySelector('dialog[open], [aria-modal="true"]')) return
      try {
        if (!localStorage.getItem(HOME_INTRO_KEY)) {
          setOpen(true)
          localStorage.setItem(HOME_INTRO_KEY, "seen")
        }
      } catch { /* The capsule still works when storage is unavailable. */ }
    }, 1200)
    return () => window.clearTimeout(timer)
  }, [router])
  useEffect(() => {
    if (!open) return
    const previous = document.body.style.overflow
    document.body.style.overflow = "hidden"
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") dismiss() }
    document.addEventListener("keydown", escape)
    return () => { document.body.style.overflow = previous; document.removeEventListener("keydown", escape) }
  }, [open])
  function dismiss() { setOpen(false); trigger.current?.focus() }
  function showIntro() {
    try { localStorage.setItem(HOME_INTRO_KEY, "seen") } catch { /* Storage is optional. */ }
    setOpen(true)
  }
  return <>
    <button ref={trigger} type="button" onClick={showIntro} className="inline-flex items-center gap-2 self-start rounded-full border border-white/20 bg-white/5 px-4 py-2 text-xs text-foreground transition-colors hover:bg-white/10">
      试试新版首页 <ArrowUpRight size={14} aria-hidden="true" />
    </button>
    {open && <div className="fixed inset-0 z-[10010] grid place-items-center overflow-y-auto bg-black/75 p-5 backdrop-blur-sm" onClick={dismiss}>
      <div ref={dialog} role="dialog" aria-modal="true" aria-labelledby="new-home-intro-title" aria-describedby="new-home-intro-description" className="relative w-full max-w-md rounded-3xl border border-white/15 bg-[#111315] p-7 text-white shadow-2xl sm:p-10" onClick={event => event.stopPropagation()}>
        <button type="button" aria-label="关闭新版介绍" onClick={dismiss} className="absolute right-4 top-4 rounded-full p-2 text-white/60 hover:bg-white/10"><X size={20} /></button>
        <p className="text-xs tracking-[.2em] text-white/45">赛道时刻 / 新版体验</p>
        <h2 id="new-home-intro-title" className="mt-8 text-4xl font-semibold leading-tight tracking-tight">首页，重新发车。</h2>
        <p id="new-home-intro-description" className="mt-4 text-sm leading-7 text-white/65">更清爽的赛程，更醒目的下一场。用日期带快速浏览，随时进入沉浸式倒计时。</p>
        <div className="my-7 flex items-center gap-3 border-y border-white/10 py-5 text-sm"><span className="font-semibold">F1</span><span className="text-white/25">/</span><span className="font-semibold">WRC</span><span className="text-white/25">/</span><span className="font-semibold">FE</span><span className="ml-auto text-xs text-white/45">同一份真实赛历</span></div>
        <a href="/new" onClick={() => saveHomePreference("new")} className="flex min-h-12 items-center justify-between rounded-full bg-white px-5 text-sm font-medium text-black">进入新版 <ArrowUpRight size={18} aria-hidden="true" /></a>
        <button type="button" onClick={dismiss} className="mt-3 min-h-11 w-full text-xs text-white/60">先用现在的版本</button>
        <p className="mt-4 text-center text-[11px] leading-5 text-white/40">进入后，下次访问将自动打开新版。可随时切回旧版。仅在当前浏览器记住选择。</p>
      </div>
    </div>}
  </>
}
