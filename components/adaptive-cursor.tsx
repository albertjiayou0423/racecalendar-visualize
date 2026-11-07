"use client"

import { useEffect, useRef } from "react"
import { motion, useMotionTemplate, useMotionValue } from "motion/react"

const TEXT_SELECTOR = 'input:not([type]), input[type="text"], input[type="search"], input[type="email"], input[type="url"], input[type="tel"], input[type="password"], input[type="number"], textarea, [contenteditable="true"]'

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

    // A native modal dialog is painted in the browser's top layer, above every
    // document z-index. Promote the cursor after a dialog opens so it remains
    // visible over the usage guide and any future native modal overlays.
    const syncTopLayer = () => {
      const cursor = cursorRef.current
      if (!cursor || typeof cursor.showPopover !== "function") return
      const topLayerOverlay =
        document.querySelector("dialog[open]") !== null || document.fullscreenElement !== null
      try {
        const alreadyPromoted = cursor.matches(":popover-open")
        if (topLayerOverlay && alreadyPromoted) cursor.hidePopover()
        if (!alreadyPromoted || topLayerOverlay) cursor.showPopover()
      } catch {
        // Keep the high-z-index fallback on browsers without top-layer popovers.
      }
    }
    const dialogObserver = new MutationObserver(syncTopLayer)
    const observeDialogs = () => {
      document.querySelectorAll("dialog").forEach((dialog) => {
        dialogObserver.observe(dialog, { attributes: true, attributeFilter: ["open"] })
      })
      syncTopLayer()
    }
    const bodyObserver = new MutationObserver(observeDialogs)
    bodyObserver.observe(document.body, { childList: true })
    observeDialogs()
    document.addEventListener("fullscreenchange", syncTopLayer)

    const onPointerMove = (event: PointerEvent) => {
      if (event.pointerType === "touch") return
      x.set(event.clientX)
      y.set(event.clientY)
      const element = event.target instanceof Element ? event.target : null
      if (element === currentElementRef.current) return
      currentElementRef.current = element
      const textEntry = element?.closest(TEXT_SELECTOR)

      if (cursorRef.current) {
        const type = textEntry ? "text" : "dot"
        if (cursorRef.current.dataset.type !== type) cursorRef.current.dataset.type = type
        if (textEntry && element) {
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
      document.removeEventListener("fullscreenchange", syncTopLayer)
      bodyObserver.disconnect()
      dialogObserver.disconnect()
      try {
        if (cursorRef.current?.matches(":popover-open")) cursorRef.current.hidePopover()
      } catch {
        // The element may already have left the top layer during unmount.
      }
      root.classList.remove("has-fixed-cursor")
    }
  }, [opacity, x, y])

  return <motion.div ref={cursorRef} popover="manual" className="adaptive-cursor" data-type="dot" style={{ transform, opacity }} aria-hidden="true" />
}
