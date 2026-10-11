"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { usePathname, useRouter } from "next/navigation"
import { BookOpen, X } from "lucide-react"
import { CARD_GUIDE_STEPS, GUIDE_CHOICES, getGuideSteps, guidePanelPosition, type GuideRect } from "@/lib/usage-guide"

const SEEN_KEY = "racecalendar:usage-guide-seen"
const OPEN_EVENT = "racecalendar:open-usage-guide"
let shownThisSession = false

export function UsageGuideButton() {
  return <button data-guide="usage-launcher" type="button" onClick={() => window.dispatchEvent(new Event(OPEN_EVENT))} className="inline-flex items-center gap-1.5 rounded-full border border-border px-4 py-1.5 text-xs text-muted-foreground transition-colors hover:border-primary hover:text-foreground">
    <BookOpen className="size-3.5" aria-hidden />使用指南
  </button>
}

export function UsageGuide() {
  const pathname = usePathname()
  const router = useRouter()
  const dialog = useRef<HTMLDialogElement>(null)
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState(0)
  const [rect, setRect] = useState<GuideRect | null>(null)
  const [viewport, setViewport] = useState({ width: 1024, height: 768 })
  const [panelHeight, setPanelHeight] = useState(240)
  const [selected, setSelected] = useState<string | null>(null)
  const panel = useRef<HTMLDivElement>(null)
  const selectedPath = GUIDE_CHOICES.find(choice => choice.key === selected)?.path
  const navigating = !!selectedPath && selectedPath !== pathname
  const steps = selected === "cards" ? CARD_GUIDE_STEPS : selected === "details" ? CARD_GUIDE_STEPS.slice(-1) : getGuideSteps(selectedPath || pathname)
  useEffect(() => { setStep(0); setRect(null) }, [pathname])
  const show = useCallback(() => {
    shownThisSession = true
    try { localStorage.setItem(SEEN_KEY, "1") } catch { /* Session guard still prevents repeat opens. */ }
    setStep(0)
    setSelected(null)
    setOpen(true)
  }, [])

  useEffect(() => {
    if (pathname.startsWith("/admin") || pathname.startsWith("/api") || pathname.startsWith("/playground/preview")) { setOpen(false); return }
    let seen = shownThisSession
    try { seen = seen || localStorage.getItem(SEEN_KEY) === "1" } catch { /* Storage can be disabled. */ }
    const timer = seen || pathname.startsWith("/playground") ? undefined : window.setTimeout(show, 600)
    const manualShow = () => { window.clearTimeout(timer); show() }
    window.addEventListener(OPEN_EVENT, manualShow)
    return () => { window.removeEventListener(OPEN_EVENT, manualShow); window.clearTimeout(timer) }
  }, [pathname, show])

  useEffect(() => {
    const element = dialog.current
    if (!element) return
    if (!open) { if (element.open) element.close(); return }
    element.showModal()
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => { document.body.style.overflow = previousOverflow; if (element.open) element.close() }
  }, [open])


  const current = steps[Math.min(step, steps.length - 1)]
  useEffect(() => {
    if (!open) return
    const update = () => setViewport({ width: window.innerWidth, height: window.innerHeight })
    update()
    window.addEventListener("resize", update)
    return () => window.removeEventListener("resize", update)
  }, [open])
  useEffect(() => {
    if (!open || !selected || navigating) { setRect(null); return }
    if (current.card) window.dispatchEvent(new CustomEvent("racecalendar:guide-card", { detail: current.card }))
    let target: HTMLElement | null = null
    let preparedCard: Element | null = null
    let frame = 0
    const findTarget = () => current.card
      ? document.querySelector("[data-event-card]")?.querySelector<HTMLElement>(`[data-guide="card-${current.card}"]`) ?? null
      : document.querySelector<HTMLElement>(current.selector)
    const measure = () => {
      const firstCard = document.querySelector("[data-event-card]")
      if (current.card && firstCard && firstCard !== preparedCard) {
        preparedCard = firstCard
        window.dispatchEvent(new CustomEvent("racecalendar:guide-card", { detail: current.card }))
      }
      const previousTarget = target
      target = findTarget()
      if (target && target !== previousTarget) target.scrollIntoView({ block: "center", behavior: "instant" })
      setViewport({ width: window.innerWidth, height: window.innerHeight })
      if (!target || !target.getClientRects().length) { setRect(null); return }
      const box = target.getBoundingClientRect()
      setRect({ top: box.top, left: box.left, width: box.width, height: box.height })
    }
    const update = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(measure) }
    if (pathname === "/" && step < 5) window.scrollTo({ top: 0, behavior: "instant" })
    target = findTarget()
    target?.scrollIntoView({ block: "center", behavior: "instant" })
    measure()
    const observer = new MutationObserver(update)
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["class", "hidden"] })
    const resize = new ResizeObserver(update)
    if (target) resize.observe(target)
    const timeout = window.setTimeout(() => {
      const element = findTarget()
      if (!element || !element.getClientRects().length) {
        if (step < steps.length - 1) setStep(step + 1)
        else setOpen(false)
      }
    }, current.card ? 12000 : 1200)
    window.addEventListener("resize", update)
    window.addEventListener("scroll", update, true)
    return () => { observer.disconnect(); resize.disconnect(); window.clearTimeout(timeout); cancelAnimationFrame(frame); window.removeEventListener("resize", update); window.removeEventListener("scroll", update, true) }
  }, [open, selected, step, pathname, navigating, current.selector, current.card, steps.length])

  useEffect(() => {
    if (!open || !panel.current) return
    const element = panel.current
    element.scrollTop = 0
    const resize = new ResizeObserver(() => setPanelHeight(element.getBoundingClientRect().height))
    resize.observe(element)
    setPanelHeight(element.getBoundingClientRect().height)
    return () => resize.disconnect()
  }, [open, step, selected, pathname])

  const position = guidePanelPosition(selected ? rect : null, viewport, panelHeight, !selected ? 640 : 360)
  if (pathname.startsWith("/playground/preview")) return null
  return <>
    {pathname !== "/" && !pathname.startsWith("/admin") && !pathname.startsWith("/api") && <div className="fixed bottom-4 right-4 z-40 rounded-full bg-background shadow-lg"><UsageGuideButton /></div>}
    <dialog ref={dialog} aria-labelledby="usage-guide-title" aria-describedby="usage-guide-description" onCancel={() => setOpen(false)} className="fixed inset-0 m-0 h-dvh max-h-none w-screen max-w-none border-0 bg-transparent p-0 text-foreground backdrop:bg-transparent">
      {rect ? <div aria-hidden="true" className="pointer-events-none fixed rounded-xl border-2 border-primary" style={{ top: rect.top - 6, left: rect.left - 6, width: rect.width + 12, height: rect.height + 12, boxShadow: "0 0 0 9999px rgb(0 0 0 / 0.72)" }} /> : <div aria-hidden="true" className="fixed inset-0 bg-black/70" />}
      <div ref={panel} className="fixed overflow-y-auto rounded-2xl border border-border bg-card p-5 shadow-2xl" style={position}>
        <div className="flex items-center justify-between gap-2"><span className="text-xs text-muted-foreground">{selected ? `功能指南 · ${step + 1} / ${steps.length}` : "欢迎使用赛车日历"}</span><button type="button" onClick={() => setOpen(false)} aria-label="关闭使用指南" className="min-h-10 min-w-10 rounded-full p-2 hover:bg-secondary"><X className="mx-auto size-4" /></button></div>
        <div aria-live="polite" aria-atomic="true"><h2 id="usage-guide-title" className="mt-2 text-lg font-semibold">{selected ? current.title : "你想先了解哪个界面？"}</h2><p id="usage-guide-description" className="mt-3 text-sm leading-relaxed text-muted-foreground">{selected ? current.description : "选择感兴趣的功能开始。页面指南会带你前往对应界面，赛事卡片直接定位首页最上面的真实赛事；随时可以回来选择其他内容。"}</p></div>
        {!selected ? <div className="mt-5 grid gap-3 sm:grid-cols-2">{GUIDE_CHOICES.map(choice => <button key={choice.key} type="button" onClick={() => { setStep(0); setRect(null); setSelected(choice.key); if (choice.path && choice.path !== pathname) router.push(choice.path) }} className="rounded-xl border border-border p-4 text-left transition-colors hover:border-primary hover:bg-secondary focus-visible:ring-2 focus-visible:ring-primary"><span className="block font-medium">{choice.label}</span><span className="mt-1 block text-xs leading-relaxed text-muted-foreground">{choice.detail}</span></button>)}</div> : null}
        {navigating && <p role="status" className="mt-3 text-xs text-muted-foreground">正在前往对应界面，加载后会定位控件。</p>}
        <div className="mt-5 flex flex-wrap items-center justify-between gap-2">
          {selected ? <><button type="button" onClick={() => { setSelected(null); setStep(0); setRect(null) }} className="min-h-11 rounded-lg px-3 py-2 text-sm hover:bg-secondary">选择其他指南</button><div className="flex gap-2"><button type="button" onClick={() => step ? setStep(step - 1) : setOpen(false)} className="min-h-11 rounded-lg px-3 py-2 text-sm hover:bg-secondary">{step ? "上一步" : "跳过"}</button><button type="button" onClick={() => step === steps.length - 1 ? setSelected(null) : setStep(step + 1)} className="min-h-11 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">{step === steps.length - 1 ? "完成并返回选择" : "下一步"}</button></div></> : <button type="button" onClick={() => setOpen(false)} className="min-h-11 rounded-lg px-3 py-2 text-sm hover:bg-secondary">暂时跳过</button>}
        </div>
      </div>
    </dialog>
  </>
}
