"use client"

import { useEffect, useRef } from "react"

const INTERACTIVE_SELECTOR =
  'a, button, [role="button"], [role="link"], summary, select, input[type="button"], input[type="submit"], [data-cursor-target]'
const TEXT_SELECTOR = 'input:not([type="button"]):not([type="submit"]), textarea, [contenteditable="true"]'

export function AdaptiveCursor() {
  const cursorRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const cursor = cursorRef.current
    const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)")
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)")
    if (!cursor || !finePointer.matches || reducedMotion.matches) return

    const root = document.documentElement
    root.classList.add("has-adaptive-cursor")

    const setPosition = (x: number, y: number) => {
      cursor.style.setProperty("--cursor-x", `${x}px`)
      cursor.style.setProperty("--cursor-y", `${y}px`)
    }

    const onPointerMove = (event: PointerEvent) => {
      if (event.pointerType === "touch") return
      setPosition(event.clientX, event.clientY)
      cursor.dataset.visible = "true"

      const target = event.target instanceof Element
        ? event.target.closest<HTMLElement>(INTERACTIVE_SELECTOR)
        : null

      const textEntry = event.target instanceof Element && event.target.closest(TEXT_SELECTOR)
      cursor.dataset.textEntry = textEntry ? "true" : "false"

      if (!target || textEntry) {
        cursor.dataset.morphed = "false"
        cursor.style.setProperty("--cursor-width", "26px")
        cursor.style.setProperty("--cursor-height", "26px")
        return
      }

      const rect = target.getBoundingClientRect()
      // Keep large cards and navigation regions from swallowing the pointer.
      const width = Math.min(Math.max(rect.width + 12, 38), 156)
      const height = Math.min(Math.max(rect.height + 8, 34), 58)
      cursor.dataset.morphed = "true"
      cursor.style.setProperty("--cursor-x", `${rect.left + rect.width / 2}px`)
      cursor.style.setProperty("--cursor-y", `${rect.top + rect.height / 2}px`)
      cursor.style.setProperty("--cursor-width", `${width}px`)
      cursor.style.setProperty("--cursor-height", `${height}px`)
    }

    const onPointerLeave = () => {
      cursor.dataset.visible = "false"
      cursor.dataset.morphed = "false"
      cursor.dataset.textEntry = "false"
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
  }, [])

  return (
    <div
      ref={cursorRef}
      className="adaptive-cursor"
      data-visible="false"
      data-morphed="false"
      data-text-entry="false"
      aria-hidden="true"
    />
  )
}
