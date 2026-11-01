"use client"

import { useEffect } from "react"
import { motion, useMotionTemplate, useMotionValue } from "motion/react"

const TEXT_SELECTOR = 'input:not([type="button"]):not([type="submit"]), textarea, [contenteditable="true"]'

export function AdaptiveCursor() {
  const x = useMotionValue(-100)
  const y = useMotionValue(-100)
  const opacity = useMotionValue(0)
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
      const target = event.target instanceof Element ? event.target.closest(TEXT_SELECTOR) : null
      opacity.set(target ? 0 : 1)
    }

    const onPointerLeave = () => opacity.set(0)

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

  return <motion.div className="adaptive-cursor" style={{ transform, opacity }} aria-hidden="true" />
}
