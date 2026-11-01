"use client"

import { useEffect, useRef } from "react"
import "./pixel-ripple-wordmark.css"

type Pointer = { x: number; y: number; active: boolean }
const SERIES_PIXEL_COLORS = ["239, 68, 68", "59, 130, 246", "16, 185, 129"]

/** Pixel-grid wordmark with a restrained, cursor-following refraction lens. */
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
      const cell = 5
      pointerCurrent.x += (pointerTarget.x - pointerCurrent.x) * 0.24
      pointerCurrent.y += (pointerTarget.y - pointerCurrent.y) * 0.24
      strength += ((pointerTarget.active ? 1 : 0) - strength) * (pointerTarget.active ? 0.24 : 0.12)

      for (let y = 0; y < height; y += cell) {
        for (let x = 0; x < width; x += cell) {
          const sampleX = Math.min(mask.width - 1, Math.floor(x * dpr))
          const sampleY = Math.min(mask.height - 1, Math.floor(y * dpr))
          const alpha = maskPixels.data[(sampleY * mask.width + sampleX) * 4 + 3]
          if (alpha < 56) continue

          const vx = x - pointerCurrent.x
          const vy = y - pointerCurrent.y
          const lens = Math.exp(-((vx * vx) / (175 * 175) + (vy * vy) / (70 * 70))) * strength
          const dx = vx * lens * 0.075
          const dy = vy * lens * 0.045
          const opacity = 0.1 + lens * 0.25
          const colorIndex = Math.min(2, Math.floor((x / width) * 3))
          ctx.fillStyle = lens > 0.08
            ? `rgba(${SERIES_PIXEL_COLORS[colorIndex]}, ${opacity})`
            : `rgba(221, 228, 239, ${opacity})`
          const size = cell + lens * 0.8
          ctx.fillRect(x + dx, y + dy, size, size)
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
      let fontSize = Number.parseFloat(typeStyle.fontSize)
      maskCtx.font = `${typeStyle.fontWeight} ${fontSize}px ${typeStyle.fontFamily}`
      const measured = maskCtx.measureText("赛道时刻").width
      if (measured > width - 28) {
        fontSize *= (width - 28) / measured
        maskCtx.font = `${typeStyle.fontWeight} ${fontSize}px ${typeStyle.fontFamily}`
      }
      maskCtx.textAlign = "center"
      maskCtx.textBaseline = "middle"
      maskCtx.fillStyle = "#fff"
      maskCtx.fillText("赛道时刻", width / 2, height / 2 + 2)
      maskPixels = maskCtx.getImageData(0, 0, mask.width, mask.height)
      pointerCurrent = { x: -100, y: -100 }
      strength = 0
      render()
    }

    const animateFromPointer = (event: PointerEvent) => {
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
    root.addEventListener("pointermove", animateFromPointer, { passive: true })
    root.addEventListener("pointerdown", animateFromPointer, { passive: true })
    root.addEventListener("pointerleave", resetPointer, { passive: true })
    void document.fonts?.ready.then(redrawMask)

    return () => {
      observer.disconnect()
      root.removeEventListener("pointermove", animateFromPointer)
      root.removeEventListener("pointerdown", animateFromPointer)
      root.removeEventListener("pointerleave", resetPointer)
      cancelAnimationFrame(frame)
    }
  }, [])

  return <div ref={rootRef} className="pixel-ripple-wordmark" aria-label="赛道时刻">
    <span ref={textRef} className="pixel-ripple-wordmark__text" aria-hidden="true">赛道时刻</span>
    <canvas ref={canvasRef} className="pixel-ripple-wordmark__canvas" aria-hidden="true" />
    <span className="pixel-ripple-wordmark__hint" aria-hidden="true">移动指针 · 触发涟漪</span>
    <span className="sr-only">赛道时刻</span>
  </div>
}
