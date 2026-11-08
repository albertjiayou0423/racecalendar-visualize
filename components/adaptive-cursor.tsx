"use client"

import { useEffect, useRef } from "react"

const TEXT_SELECTOR = 'input:not([type]), input[type="text"], input[type="search"], input[type="email"], input[type="url"], input[type="tel"], input[type="password"], input[type="number"], textarea, [contenteditable="true"]'

export function AdaptiveCursor() {
  const cursorRef = useRef<HTMLDivElement>(null)
  const currentTextEntryRef = useRef<Element | null>(null)

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

    let pointerFrame = 0
    let pointerPosition: { x: number; y: number } | null = null
    const applyPointerPosition = () => {
      pointerFrame = 0
      const cursor = cursorRef.current
      if (!cursor || !pointerPosition) return
      cursor.style.transform = `translate3d(${pointerPosition.x}px, ${pointerPosition.y}px, 0) translate(-50%, -50%)`
      cursor.style.opacity = "1"
    }

    const onPointerMove = (event: PointerEvent) => {
      if (event.pointerType === "touch") return
      pointerPosition = { x: event.clientX, y: event.clientY }
      if (!pointerFrame) pointerFrame = window.requestAnimationFrame(applyPointerPosition)

      const element = event.target instanceof Element ? event.target : null
      const textEntry = element?.closest(TEXT_SELECTOR) ?? null
      if (textEntry === currentTextEntryRef.current) return
      currentTextEntryRef.current = textEntry

      const cursor = cursorRef.current
      if (!cursor) return
      cursor.dataset.type = textEntry ? "text" : "dot"
      if (textEntry) {
        const fontSize = Number.parseFloat(window.getComputedStyle(textEntry).fontSize)
        const textHeight = Math.max(14, Math.min(28, Number.isFinite(fontSize) ? fontSize * 1.12 : 18))
        cursor.style.setProperty("--cursor-text-height", `${textHeight}px`)
      }
    }

    const onPointerLeave = () => {
      currentTextEntryRef.current = null
      pointerPosition = null
      if (pointerFrame) window.cancelAnimationFrame(pointerFrame)
      pointerFrame = 0
      if (cursorRef.current) cursorRef.current.style.opacity = "0"
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
      if (pointerFrame) window.cancelAnimationFrame(pointerFrame)
      try {
        if (cursorRef.current?.matches(":popover-open")) cursorRef.current.hidePopover()
      } catch {
        // The element may already have left the top layer during unmount.
      }
      root.classList.remove("has-fixed-cursor")
    }
  }, [])

  return <div ref={cursorRef} popover="manual" className="adaptive-cursor" data-type="dot" style={{ opacity: 0 }} aria-hidden="true" />
}
