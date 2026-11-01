"use client"

import { useEffect, useRef } from "react"
import "./pixel-ripple-wordmark.css"

type Pointer = { x: number; y: number; active: boolean }
const SERIES_PIXEL_COLORS = ["239, 68, 68", "59, 130, 246", "16, 185, 129"]

/** Large racing wordmark with a local fluid-pixel refraction field. */
export function PixelRippleWordmark() {
  const rootRef = useRef<HTMLDivElement>(null)
  const textRef = useRef<HTMLSpanElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const root = rootRef.current
    const text = textRef.current
    const canvas = canvasRef.current
    const ctx = canvas?.getContext("2d")
    if (!root || !text || !canvas || !ctx) return

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    const mask = document.createElement("canvas")
    const maskCtx = mask.getContext("2d", { willReadFrequently: true })
    if (!maskCtx) return

    let width = 0
    let height = 0
    let dpr = 1
    let maskPixels: ImageData | null = null
    let frame = 0
    let pointerTarget: Pointer = { x: -100, y: -100, active: false }
    let pointerCurrent = { x: -100, y: -100 }
    let strength = 0

    const render = () => {
      frame = 0
      if (!maskPixels || width === 0 || height === 0) return
      ctx.clearRect(0, 0, width, height)
      const cell = 3.5
      pointerCurrent.x += (pointerTarget.x - pointerCurrent.x) * 0.2
      pointerCurrent.y += (pointerTarget.y - pointerCurrent.y) * 0.2
      strength += ((pointerTarget.active ? 1 : 0) - strength) * (pointerTarget.active ? 0.22 : 0.12)

      for (let y = 0; y < height; y += cell) {
        for (let x = 0; x < width; x += cell) {
          const sampleX = Math.min(mask.width - 1, Math.floor(x * dpr))
          const sampleY = Math.min(mask.height - 1, Math.floor(y * dpr))
          const alpha = maskPixels.data[(sampleY * mask.width + sampleX) * 4 + 3]
          if (alpha < 56) continue

          const vx = x - pointerCurrent.x
          const vy = y - pointerCurrent.y
          const influence = Math.exp(-((vx * vx) / (2 * 138 * 138) + (vy * vy) / (2 * 66 * 66))) * strength
          const phase = vx * 0.036 + vy * 0.024
          const fluidX = Math.sin(phase + y * 0.018) * influence * 15
          const fluidY = Math.cos(phase * 0.8 - x * 0.012) * influence * 8
          const opacity = 0.14 + influence * 0.4
          const colorIndex = Math.min(2, Math.floor((x / width) * SERIES_PIXEL_COLORS.length))
          ctx.fillStyle = influence > 0.045
            ? `rgba(${SERIES_PIXEL_COLORS[colorIndex]}, ${opacity})`
            : `rgba(221, 228, 239, ${opacity})`
          const block = cell + influence * 1.4
          ctx.fillRect(x + fluidX, y + fluidY, block, block)
        }
      }

      const pointerSettled = Math.abs(pointerTarget.x - pointerCurrent.x) < 0.5 && Math.abs(pointerTarget.y - pointerCurrent.y) < 0.5
      const strengthSettled = pointerTarget.active ? Math.abs(strength - 1) < 0.015 : strength < 0.015
      if (!pointerSettled || !strengthSettled) frame = requestAnimationFrame(render)
    }

    const redrawMask = () => {
      const rect = root.getBoundingClientRect()
      width = Math.max(1, rect.width)
      height = Math.max(1, rect.height)
      dpr = Math.min(1.5, window.devicePixelRatio || 1)
      canvas.width = Math.round(width * dpr)
      canvas.height = Math.round(height * dpr)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

      mask.width = canvas.width
      mask.height = canvas.height
      maskCtx.setTransform(dpr, 0, 0, dpr, 0, 0)
      maskCtx.clearRect(0, 0, width, height)
      const typeStyle = window.getComputedStyle(text)
      const glyphs = Array.from("赛道时刻")
      const letterSpacing = Number.parseFloat(typeStyle.letterSpacing) || 0
      let fontSize = Number.parseFloat(typeStyle.fontSize)
      maskCtx.font = `${typeStyle.fontWeight} ${fontSize}px ${typeStyle.fontFamily}`
      const textWidth = () => glyphs.reduce((sum, glyph) => sum + maskCtx.measureText(glyph).width, 0) + letterSpacing * (glyphs.length - 1)
      let measured = textWidth()
      if (measured > width - 28) {
        fontSize *= (width - 28) / measured
        maskCtx.font = `${typeStyle.fontWeight} ${fontSize}px ${typeStyle.fontFamily}`
        measured = textWidth()
      }
      maskCtx.textAlign = "left"
      maskCtx.textBaseline = "middle"
      maskCtx.fillStyle = "#fff"
      let cursorX = (width - measured) / 2
      for (const glyph of glyphs) {
        maskCtx.fillText(glyph, cursorX, height / 2 + 2)
        cursorX += maskCtx.measureText(glyph).width + letterSpacing
      }
      maskPixels = maskCtx.getImageData(0, 0, mask.width, mask.height)
      pointerCurrent = { x: -100, y: -100 }
      strength = 0
      render()
    }

    const trackPointer = (event: PointerEvent) => {
      if (reduceMotion) return
      const rect = root.getBoundingClientRect()
      const x = event.clientX - rect.left
      const y = event.clientY - rect.top
      if (x < 0 || y < 0 || x > width || y > height) return
      pointerTarget = { x, y, active: true }
      if (!frame) frame = requestAnimationFrame(render)
    }

    const resetPointer = () => {
      pointerTarget = { ...pointerTarget, active: false }
      if (!frame) frame = requestAnimationFrame(render)
    }

    const observer = new ResizeObserver(redrawMask)
    observer.observe(root)
    root.addEventListener("pointermove", trackPointer, { passive: true })
    root.addEventListener("pointerdown", trackPointer, { passive: true })
    root.addEventListener("pointerleave", resetPointer, { passive: true })
    void document.fonts?.ready.then(redrawMask)

    return () => {
      observer.disconnect()
      root.removeEventListener("pointermove", trackPointer)
      root.removeEventListener("pointerdown", trackPointer)
      root.removeEventListener("pointerleave", resetPointer)
      cancelAnimationFrame(frame)
    }
  }, [])

  return <div ref={rootRef} className="pixel-ripple-wordmark" aria-label="赛道时刻">
    <span ref={textRef} className="pixel-ripple-wordmark__text" aria-hidden="true">赛道时刻</span>
    <canvas ref={canvasRef} className="pixel-ripple-wordmark__canvas" aria-hidden="true" />
    <span className="pixel-ripple-wordmark__legend" aria-hidden="true"><i className="f1">F1</i><i className="wrc">WRC</i><i className="fe">FE</i></span>
    <span className="pixel-ripple-wordmark__hint" aria-hidden="true">移动鼠标 · 扰动像素</span>
    <span className="sr-only">赛道时刻</span>
  </div>
}
