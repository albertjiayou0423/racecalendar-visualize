"use client"

import { useEffect, useRef, useState, type CSSProperties, type InputHTMLAttributes } from "react"
import type { Instance } from "tippy.js"

let activeFavoriteTooltip: Instance | null = null

export type LoaderKind = "schedule" | "sync" | "live" | "page" | "weather" | "standings"

/** Native library presets, sized and coloured by the surrounding component. */
export function MotionLoader({ kind, size = 18 }: { kind: LoaderKind; size?: number }) {
  const count = { schedule: 3, sync: 9, live: 5, page: 0, weather: 6, standings: 12 }[kind]
  const name = { schedule: "ball-pulse", sync: "ball-grid-pulse", live: "line-scale", page: "sk-plane", weather: "sk-chase", standings: "sk-circle" }[kind]
  return <span aria-hidden="true" className="rc-motion-loader" style={{ "--rc-loader-size": `${Math.max(8, Math.min(64, Number.isFinite(size) ? size : 18))}px` } as CSSProperties}><span className={`${kind === "schedule" || kind === "sync" || kind === "live" ? "loader-inner " : ""}${name}`}>{Array.from({ length: count }, (_, index) => kind === "weather" || kind === "standings" ? <span key={index} className={`${name}-dot`} /> : <div key={index} />)}</span></span>
}

export function useShake() {
  const ref = useRef<HTMLElement | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  useEffect(() => () => clearTimeout(timer.current), [])
  const shake = (element: HTMLElement | null, kind: "little" | "horizontal" = "little") => {
    clearTimeout(timer.current)
    ref.current?.classList.remove("shake-little", "shake-horizontal", "shake-constant", "rc-motion-shake")
    if (!element || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return
    ref.current = element
    void element.offsetWidth
    element.classList.add(`shake-${kind}`, "shake-constant", "rc-motion-shake")
    timer.current = setTimeout(() => element.classList.remove(`shake-${kind}`, "shake-constant", "rc-motion-shake"), 650)
  }
  return shake
}

/** Stops as soon as the user focuses/types; never writes to the input value. */
export function useSearchHint(enabled = true) {
  const ref = useRef<HTMLInputElement>(null)
  useEffect(() => {
    const input = ref.current
    if (!enabled || !input || input.value || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return
    const original = input.placeholder
    let disposed = false
    let cleanup: (() => void) | undefined
    import("typed.js").then(({ default: Typed }) => {
      if (disposed || input.value || input === document.activeElement) return
      const typed = new Typed(input, { strings: [original, "试试搜索 F1、WRC 或 FE"], attr: "placeholder", typeSpeed: 50, backSpeed: 25, backDelay: 1800, showCursor: false, loop: false })
      const stop = () => { typed.destroy(); input.placeholder = original }
      const motion = window.matchMedia("(prefers-reduced-motion: reduce)")
      const reduce = () => { if (motion.matches) stop() }
      motion.addEventListener("change", reduce)
      input.addEventListener("focus", stop, { once: true })
      cleanup = () => { motion.removeEventListener("change", reduce); input.removeEventListener("focus", stop); typed.destroy(); input.placeholder = original }
    }).catch(() => { if (!disposed) input.placeholder = original })
    return () => { disposed = true; cleanup?.() }
  }, [enabled])
  return ref
}

/** The same input used on both home pages and in real feedback forms. */
export function MotionInput({ variant = "search", noResults = false, onKeyDown, onInvalid, ...props }: InputHTMLAttributes<HTMLInputElement> & { variant?: "search" | "field"; noResults?: boolean }) {
  const ref = useSearchHint(variant === "search")
  const shake = useShake()
  return <input {...props} ref={ref} onKeyDown={event => {
    onKeyDown?.(event)
    if (!event.defaultPrevented && variant === "search" && event.key === "Enter" && !event.nativeEvent.isComposing && event.currentTarget.value.trim() && noResults) shake(event.currentTarget, "horizontal")
  }} onInvalid={event => { onInvalid?.(event); if (variant === "field") shake(event.currentTarget) }} />
}

/** Keeps the accessible title stable and reserves its full width while typing. */
export function MotionText({ text, fade = false }: { text: string; fade?: boolean }) {
  const ref = useRef<HTMLSpanElement>(null)
  const previous = useRef(text)
  useEffect(() => {
    const element = ref.current
    if (!element || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return
    let disposed = false
    let cleanup: (() => void) | undefined
    import("typed.js").then(({ default: Typed }) => {
      if (disposed) return
      const before = previous.current
      previous.current = text
      const typed = new Typed(element, { strings: fade && before !== text ? [before, text] : [text], backDelay: 0, contentType: "null", typeSpeed: fade ? 0 : 75, showCursor: false, fadeOut: fade, loop: false })
      const motion = window.matchMedia("(prefers-reduced-motion: reduce)")
      const reduce = () => { if (motion.matches) { typed.destroy(); element.textContent = text } }
      motion.addEventListener("change", reduce)
      cleanup = () => { motion.removeEventListener("change", reduce); typed.destroy() }
    }).catch(() => { if (!disposed) element.textContent = text })
    return () => { disposed = true; cleanup?.() }
  }, [text, fade])
  return <span className="rc-motion-text" aria-label={text}><span aria-hidden="true" className="rc-motion-reserve">{text}</span><span aria-hidden="true" ref={ref} className="rc-motion-letters">{text}</span></span>
}

export function FavoriteMotion({ active, onToggle, label, className, children }: { active: boolean; onToggle: () => void; label: string; className?: string; children: React.ReactNode }) {
  const ref = useRef<HTMLButtonElement>(null)
  const instance = useRef<Instance | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const [announcement, setAnnouncement] = useState("")
  const pending = useRef(0)
  useEffect(() => () => { pending.current++; clearTimeout(timer.current); if (activeFavoriteTooltip === instance.current) activeFavoriteTooltip = null; instance.current?.destroy() }, [])
  const toggle = async () => {
    onToggle()
    const text = active ? "已取消收藏" : "已收藏"
    setAnnouncement(text)
    const token = ++pending.current
    activeFavoriteTooltip?.hide()
    const { default: tippy } = await import("tippy.js").catch(() => ({ default: null }))
    if (!tippy) return
    if (token !== pending.current || !ref.current) return
    if (activeFavoriteTooltip !== instance.current) activeFavoriteTooltip?.hide()
    instance.current?.destroy()
    const hide = () => instance.current?.hide()
    instance.current = tippy(ref.current, { content: text, trigger: "manual", animation: "scale", placement: "bottom-end", arrow: false, offset: [0, 6], maxWidth: 200, duration: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : [130, 100], theme: "racecalendar", appendTo: () => document.body,
      onShow: () => window.addEventListener("scroll", hide, true),
      onHide: () => { window.removeEventListener("scroll", hide, true) },
      onDestroy: () => { window.removeEventListener("scroll", hide, true) },
    })
    activeFavoriteTooltip = instance.current
    instance.current.show()
    clearTimeout(timer.current)
    timer.current = setTimeout(() => instance.current?.hide(), 1000)
  }
  return <><button ref={ref} type="button" aria-label={label} title={label} aria-pressed={active} className={className} onClick={toggle} onBlur={() => instance.current?.hide()} onKeyDown={event => { if (event.key === "Escape") instance.current?.hide() }}>{children}</button><span className="sr-only" role="status">{announcement}</span></>
}

export function SpringToggle({ open }: { open: boolean }) {
  return <span aria-hidden="true" className={`rc-spring hamburger hamburger--spring ${open ? "is-active" : ""}`}><span className="hamburger-box"><span className="hamburger-inner" /></span></span>
}
