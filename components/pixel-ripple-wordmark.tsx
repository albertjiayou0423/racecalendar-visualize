"use client"

import { useEffect, useRef } from "react"
import "./pixel-ripple-wordmark.css"

type Ripple = { x: number; y: number; at: number; strength: number }

/** Pixel-grid wordmark with short, pointer-driven distortion ripples. */
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
    let ripples: Ripple[] = []
    let lastPoint = { x: -100, y: -100 }

    const render = (now = performance.now()) => {
      frame = 0
      if (!maskPixels || width === 0 || height === 0) return
      ctx.clearRect(0, 0, width, height)
      const cell = 4
      const maxAge = 1150
      ripples = ripples.filter((ripple) => now - ripple.at < maxAge)

      for (let y = 0; y < height; y += cell) {
        for (let x = 0; x < width; x += cell) {
          const sampleX = Math.min(mask.width - 1, Math.floor(x * dpr))
          const sampleY = Math.min(mask.height - 1, Math.floor(y * dpr))
          const alpha = maskPixels.data[(sampleY * mask.width + sampleX) * 4 + 3]
          if (alpha < 56) continue

          let dx = 0
          let dy = 0
          let energy = 0
          let colorShift = 0
          for (const ripple of ripples) {
            const vx = x - ripple.x
            const vy = y - ripple.y
            const distance = Math.max(1, Math.hypot(vx, vy))
            const age = now - ripple.at
            const envelope = Math.exp(-distance / 150) * Math.exp(-age / 510) * ripple.strength
            const wave = Math.sin(distance * 0.105 - age * 0.018) * envelope
            dx += (vx / distance) * wave * 15
            dy += (vy / distance) * wave * 11
            energy = Math.max(energy, Math.abs(wave))
            colorShift += wave
          }

          const opacity = 0.13 + Math.min(0.74, energy * 0.82)
          ctx.fillStyle = colorShift > 0.12
            ? `rgba(244, 82, 72, ${opacity})`
            : energy > 0.06
              ? `rgba(91, 164, 255, ${opacity})`
              : `rgba(221, 228, 239, ${opacity})`
          const size = cell + Math.min(1.6, energy * 1.4)
          ctx.fillRect(x + dx, y + dy, size, size)
        }
      }

      if (ripples.length) frame = requestAnimationFrame(render)
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
      ripples = []
      render()
    }

    const animateFromPointer = (event: PointerEvent) => {
      if (reduceMotion) return
      if (event.pointerType === "mouse" && Math.hypot(event.clientX - lastPoint.x, event.clientY - lastPoint.y) < 10) return
      const rect = root.getBoundingClientRect()
      const x = event.clientX - rect.left
      const y = event.clientY - rect.top
      if (x < 0 || y < 0 || x > width || y > height) return
      lastPoint = { x: event.clientX, y: event.clientY }
      ripples.push({ x, y, at: performance.now(), strength: event.pointerType === "touch" ? 1.15 : 1 })
      if (ripples.length > 4) ripples.shift()
      if (!frame) frame = requestAnimationFrame(render)
    }

    const observer = new ResizeObserver(redrawMask)
    observer.observe(root)
    root.addEventListener("pointermove", animateFromPointer, { passive: true })
    root.addEventListener("pointerdown", animateFromPointer, { passive: true })
    void document.fonts?.ready.then(redrawMask)

    return () => {
      observer.disconnect()
      root.removeEventListener("pointermove", animateFromPointer)
      root.removeEventListener("pointerdown", animateFromPointer)
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
