"use client"

import { useEffect, useRef } from "react"
import { motion, useMotionTemplate, useMotionValue } from "motion/react"

const TEXT_SELECTOR = 'input:not([type="button"]):not([type="submit"]), textarea, [contenteditable="true"]'

export function AdaptiveCursor() {
  const x = useMotionValue(-100)
  const y = useMotionValue(-100)
  const opacity = useMotionValue(0)
  const cursorRef = useRef<HTMLDivElement>(null)
  const currentElementRef = useRef<Element | null>(null)
  const transform = useMotionTemplate`translate3d(${x}px, ${y}px, 0) translate(-50%, -50%)`

  useEffect(() => {
    const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)")
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)")
    if (!finePointer.matches || reducedMotion.matches) return

    const root = document.documentElement
    root.classList.add("has-fixed-cursor")

    const onPointerMove = (event: PointerEvent) => {
      if (event.pointerType === "touch") return
      x.set(event.clientX)
      y.set(event.clientY)
      const element = event.target instanceof Element ? event.target : null
      if (element === currentElementRef.current) return
      currentElementRef.current = element
      const interactive = element?.closest('a, button, [role="button"], [role="link"], select, input[type="button"], input[type="submit"]')
      const textEntry = element?.closest(TEXT_SELECTOR)
      const documentWithCaret = document as Document & {
        caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node } | null
        caretRangeFromPoint?: (x: number, y: number) => Range | null
      }
      const caretNode = documentWithCaret.caretPositionFromPoint?.(event.clientX, event.clientY)?.offsetNode
        ?? documentWithCaret.caretRangeFromPoint?.(event.clientX, event.clientY)?.startContainer
      const isText = !!textEntry || (!interactive && caretNode?.nodeType === Node.TEXT_NODE)

      if (cursorRef.current) {
        const type = isText ? "text" : "dot"
        if (cursorRef.current.dataset.type !== type) cursorRef.current.dataset.type = type
        if (isText && element) {
          const fontSize = Number.parseFloat(window.getComputedStyle(element).fontSize)
          const textHeight = Math.max(14, Math.min(28, Number.isFinite(fontSize) ? fontSize * 1.12 : 18))
          cursorRef.current.style.setProperty("--cursor-text-height", `${textHeight}px`)
        }
      }
      if (opacity.get() !== 1) opacity.set(1)
    }

    const onPointerLeave = () => {
      currentElementRef.current = null
      opacity.set(0)
    }

    window.addEventListener("pointermove", onPointerMove, { passive: true })
    window.addEventListener("blur", onPointerLeave)
    document.documentElement.addEventListener("pointerleave", onPointerLeave)

    return () => {
      window.removeEventListener("pointermove", onPointerMove)
      window.removeEventListener("blur", onPointerLeave)
      document.documentElement.removeEventListener("pointerleave", onPointerLeave)
      root.classList.remove("has-fixed-cursor")
    }
  }, [opacity, x, y])

  return <motion.div ref={cursorRef} className="adaptive-cursor" data-type="dot" style={{ transform, opacity }} aria-hidden="true" />
}
