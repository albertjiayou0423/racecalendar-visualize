"use client"

import { useEffect } from "react"

const CURSOR_TARGETS = 'a, button, [role="button"], [role="link"], summary, select, input[type="button"], input[type="submit"]'
const TEXT_TARGETS = 'input:not([type="button"]):not([type="submit"]), textarea, [contenteditable="true"]'

export function AdaptiveCursor() {
  useEffect(() => {
    const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)")
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)")
    if (!finePointer.matches || reducedMotion.matches) return

    let cancelled = false
    let cleanup: (() => void) | undefined

    void import("ipad-cursor").then(({ initCursor, updateCursor, disposeCursor }) => {
      if (cancelled) return

      const root = document.documentElement
      const addedAttributes = new Set<HTMLElement>()

      const markTargets = (scope: ParentNode) => {
        const candidates = [
          ...(scope instanceof HTMLElement && scope.matches(`${CURSOR_TARGETS}, ${TEXT_TARGETS}`) ? [scope] : []),
          ...scope.querySelectorAll<HTMLElement>(`${CURSOR_TARGETS}, ${TEXT_TARGETS}`),
        ]
        let changed = false
        for (const element of candidates) {
          if (element.hasAttribute("data-cursor")) continue
          addedAttributes.add(element)
          element.setAttribute("data-cursor", element.matches(TEXT_TARGETS) ? "text" : "block")
          changed = true
        }
        return changed
      }

      markTargets(document.body)
      root.classList.add("has-ipad-cursor")
      initCursor({
        className: "ipad-cursor",
        adsorptionStrength: 0,
        blockPadding: 3,
        enableAutoTextCursor: false,
        enableAutoUpdateCursor: false,
        enableLighting: false,
        normalStyle: {
          width: 22,
          height: 22,
          radius: "50%",
          background: "rgba(255, 255, 255, 0.18)",
          border: "1px solid rgba(255, 255, 255, 0.62)",
          backdropBlur: 0,
          durationBase: "100ms",
          durationPosition: "0ms",
        },
        blockStyle: {
          radius: "auto",
          background: "rgba(255, 255, 255, 0.18)",
          border: "1px solid rgba(255, 255, 255, 0.54)",
          backdropBlur: 0,
          durationBase: "100ms",
          durationPosition: "70ms",
        },
      })

      const observer = new MutationObserver(records => {
        let needsUpdate = false
        for (const record of records) {
          record.addedNodes.forEach(node => {
            if (node instanceof HTMLElement && markTargets(node)) needsUpdate = true
          })
          record.removedNodes.forEach(node => {
            if (node instanceof HTMLElement && (node.matches("[data-cursor]") || node.querySelector("[data-cursor]"))) {
              needsUpdate = true
            }
          })
        }
        if (needsUpdate) updateCursor()
      })
      observer.observe(document.body, { childList: true, subtree: true })

      const reveal = () => { root.dataset.cursorReady = "true" }
      window.addEventListener("mousemove", reveal, { once: true, passive: true })

      cleanup = () => {
        observer.disconnect()
        window.removeEventListener("mousemove", reveal)
        disposeCursor()
        for (const element of addedAttributes) {
          if (!element.isConnected) continue
          element.removeAttribute("data-cursor")
        }
        delete root.dataset.cursorReady
        root.classList.remove("has-ipad-cursor")
      }
    })

    return () => {
      cancelled = true
      cleanup?.()
    }
  }, [])

  return null
}
