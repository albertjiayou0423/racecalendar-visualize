"use client"

import { useEffect, useRef } from "react"
import { animate, motion, useMotionTemplate, useMotionValue } from "motion/react"

const INTERACTIVE_SELECTOR = 'a, button, [role="button"], [role="link"], summary, select, input[type="button"], input[type="submit"]'
const TEXT_SELECTOR = 'input:not([type="button"]):not([type="submit"]), textarea, [contenteditable="true"]'
const SHAPE_TRANSITION = { type: "spring" as const, stiffness: 880, damping: 48, mass: 0.38 }

export function AdaptiveCursor() {
  const x = useMotionValue(-100)
  const y = useMotionValue(-100)
  const width = useMotionValue(22)
  const height = useMotionValue(22)
  const radius = useMotionValue(999)
  const opacity = useMotionValue(0)
  const activeTargetRef = useRef<Element | null>(null)
  const transform = useMotionTemplate`translate3d(${x}px, ${y}px, 0) translate(-50%, -50%)`

  useEffect(() => {
    const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)")
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)")
    if (!finePointer.matches || reducedMotion.matches) return

    const root = document.documentElement
    root.classList.add("has-adaptive-cursor")

    const morphTo = (target: Element | null) => {
      if (target === activeTargetRef.current) return
      activeTargetRef.current = target

      const rect = target?.getBoundingClientRect()
      const isLargeTarget = rect && (rect.width > 180 || rect.height > 64)
      const isTextEntry = target instanceof HTMLElement && target.matches(TEXT_SELECTOR)
      if (!target || !rect || isLargeTarget || isTextEntry) {
        animate(width, 22, SHAPE_TRANSITION)
        animate(height, 22, SHAPE_TRANSITION)
        animate(radius, 999, SHAPE_TRANSITION)
        return
      }

      const targetStyle = window.getComputedStyle(target)
      const controlRadius = Number.parseFloat(targetStyle.borderTopLeftRadius)
      const nextRadius = Number.isFinite(controlRadius)
        ? Math.min(controlRadius, rect.height / 2)
        : Math.min(10, rect.height / 2)

      // Keep the pointer where the user placed it; only its shape responds to the control.
      animate(width, Math.max(30, rect.width + 8), SHAPE_TRANSITION)
      animate(height, Math.max(28, rect.height + 8), SHAPE_TRANSITION)
      animate(radius, nextRadius, SHAPE_TRANSITION)
    }

    const onPointerMove = (event: PointerEvent) => {
      if (event.pointerType === "touch") return
      x.set(event.clientX)
      y.set(event.clientY)
      opacity.set(1)

      const element = event.target instanceof Element ? event.target : null
      const target = element?.closest(INTERACTIVE_SELECTOR) ?? null
      const textEntry = element?.closest(TEXT_SELECTOR)
      if (textEntry) {
        morphTo(null)
        opacity.set(0)
      } else {
        morphTo(target)
      }
    }

    const onPointerLeave = () => {
      activeTargetRef.current = null
      opacity.set(0)
      animate(width, 22, SHAPE_TRANSITION)
      animate(height, 22, SHAPE_TRANSITION)
      animate(radius, 999, SHAPE_TRANSITION)
    }

    window.addEventListener("pointermove", onPointerMove, { passive: true })
    window.addEventListener("blur", onPointerLeave)
    document.documentElement.addEventListener("pointerleave", onPointerLeave)

    return () => {
      window.removeEventListener("pointermove", onPointerMove)
      window.removeEventListener("blur", onPointerLeave)
      document.documentElement.removeEventListener("pointerleave", onPointerLeave)
      root.classList.remove("has-adaptive-cursor")
    }
  }, [height, opacity, radius, width, x, y])

  return (
    <motion.div
      className="adaptive-cursor"
      style={{ transform, width, height, borderRadius: radius, opacity }}
      aria-hidden="true"
    />
  )
}
