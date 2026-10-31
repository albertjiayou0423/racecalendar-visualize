"use client"

import { useEffect, useRef, useState, type ReactNode } from "react"

/** Animate once on first visibility, never on the schedule's clock ticks. */
function useArrival() {
  const ref = useRef<HTMLSpanElement>(null)
  const [active, setActive] = useState(false)
  useEffect(() => {
    const node = ref.current
    if (!node) return
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) { setActive(true); observer.disconnect() }
    }, { threshold: 0.25 })
    observer.observe(node)
    return () => observer.disconnect()
  }, [])
  return { ref, active }
}

/** A thin, non-blocking accent; initial rendering does not trigger a transition. */
export function SeriesRelay({ series }: { series: string }) {
  const previous = useRef(series)
  const [sequence, setSequence] = useState(0)
  useEffect(() => {
    if (previous.current !== series) { previous.current = series; setSequence(value => value + 1) }
  }, [series])
  return <div className="rc-ritual-relay" aria-hidden="true">{sequence > 0 && <span key={sequence}>{["#ef4444", "#3b82f6", "#10b981"].map(color => <i key={color} style={{ backgroundColor: color }} />)}</span>}</div>
}

export function RoundArrival({ round }: { round: number }) {
  const { ref, active } = useArrival()
  const number = useRef<HTMLSpanElement>(null)
  useEffect(() => {
    const node = number.current
    if (!active || !node || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return
    let disposed = false
    let stop: (() => void) | undefined
    import("countup.js").then(({ CountUp }) => {
      if (disposed) return
      const counter = new CountUp(node, round, { duration: 0.65, useGrouping: false })
      counter.start()
      stop = () => { counter.reset(); node.textContent = String(round) }
    }).catch(() => { node.textContent = String(round) })
    return () => { disposed = true; stop?.() }
  }, [active, round])
  return <span ref={ref} className="rc-ritual-round" data-active={active} aria-label={String(round)}><span ref={number} aria-hidden="true">{round}</span></span>
}

/** Mount only after explicit spoiler consent; no alternate or invented results. */
export function WinnerReveal({ children }: { children: ReactNode }) {
  const { ref, active } = useArrival()
  return <span ref={ref} className="rc-ritual-winner block" data-active={active}>{children}</span>
}

export function RaceFarewell({ text = "下站见，赛道见。" }: { text?: string }) {
  const { ref, active } = useArrival()
  const letters = useRef<HTMLSpanElement>(null)
  useEffect(() => {
    const node = letters.current
    if (!active || !node || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return
    let disposed = false
    let destroy: (() => void) | undefined
    import("typed.js").then(({ default: Typed }) => {
      if (disposed) return
      node.textContent = ""
      const typed = new Typed(node, { strings: [text], contentType: "null", typeSpeed: 65, showCursor: false, loop: false })
      destroy = () => { typed.destroy(); node.textContent = text }
    }).catch(() => { node.textContent = text })
    return () => { disposed = true; destroy?.() }
  }, [active, text])
  return <p className="rc-ritual-farewell" data-active={active}><span ref={ref} aria-label={text}><span ref={letters} aria-hidden="true">{text}</span></span></p>
}
