"use client"

import { useState, useEffect } from "react"

interface CircuitImageProps {
  src: string
  alt: string
  className?: string
  maxHeight?: number
}

export function CircuitImage({ src, alt, className = "", maxHeight = 180 }: CircuitImageProps) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [currentSrc, setCurrentSrc] = useState(src)
  const [retryCount, setRetryCount] = useState(0)

  useEffect(() => {
    setCurrentSrc(src)
    setLoading(true)
    setError(false)
    setRetryCount(0)
  }, [src])

  const handleLoad = () => {
    setLoading(false)
    setError(false)
  }

  const handleError = () => {
    if (retryCount < 2) {
      setTimeout(() => {
        setRetryCount((prev) => prev + 1)
        setCurrentSrc(`${src}?t=${Date.now()}`)
      }, 500)
    } else {
      setLoading(false)
      setError(true)
    }
  }

  if (error) {
    return (
      <div className={`flex flex-col items-center justify-center rounded-lg bg-secondary/30 p-6 ${className}`}>
        <div className="text-sm text-muted-foreground">赛道图加载失败</div>
        <div className="mt-1 text-xs text-muted-foreground/60 font-mono truncate max-w-full">{src}</div>
      </div>
    )
  }

  return (
    <div className="relative w-full">
      {loading && (
        <div
          className={`absolute inset-0 z-10 flex items-center justify-center rounded-lg bg-secondary/30 ${className}`}
          style={{ minHeight: maxHeight / 2 }}
        >
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      )}
      <img
        key={currentSrc}
        src={currentSrc}
        alt={alt}
        className={`h-auto w-full rounded-lg object-contain transition-opacity ${className} ${loading ? "opacity-0" : "opacity-100"}`}
        style={{ maxHeight }}
        onLoad={handleLoad}
        onError={handleError}
        loading="lazy"
      />
    </div>
  )
}
