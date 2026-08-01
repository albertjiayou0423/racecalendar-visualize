"use client"

import { useEffect } from "react"

/**
 * 焦点陷阱：active 时将 Tab/Shift+Tab 限制在容器内循环，
 * 打开时自动聚焦首个可聚焦元素，卸载时恢复原焦点。
 * 用于模态框与全屏浮层，提升键盘无障碍体验。
 */
export function useFocusTrap(
  containerRef: React.RefObject<HTMLElement | null>,
  active: boolean,
) {
  useEffect(() => {
    if (!active) return
    const container = containerRef.current
    if (!container) return

    const previouslyFocused = document.activeElement as HTMLElement | null

    if (container.tabIndex < 0) container.tabIndex = -1

    const focusables = getFocusables(container)
    if (focusables.length > 0) {
      focusables[0].focus()
    } else {
      container.focus()
    }

    const handleKeydown = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return
      const items = getFocusables(container)
      if (items.length === 0) {
        e.preventDefault()
        return
      }
      const first = items[0]
      const last = items[items.length - 1]
      const activeEl = document.activeElement

      if (e.shiftKey) {
        if (activeEl === first || !container.contains(activeEl)) {
          e.preventDefault()
          last.focus()
        }
      } else {
        if (activeEl === last || !container.contains(activeEl)) {
          e.preventDefault()
          first.focus()
        }
      }
    }

    container.addEventListener("keydown", handleKeydown)
    return () => {
      container.removeEventListener("keydown", handleKeydown)
      previouslyFocused?.focus?.()
    }
  }, [active, containerRef])
}

function getFocusables(container: HTMLElement): HTMLElement[] {
  const selectors =
    'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])'
  return Array.from(
    container.querySelectorAll<HTMLElement>(selectors),
  ).filter((el) => el.offsetParent !== null || el.getClientRects().length > 0)
}
