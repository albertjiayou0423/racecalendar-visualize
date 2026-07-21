"use client"

import { useState } from "react"

interface CircuitImageProps {
  src: string
  alt: string
  className?: string
}

export function CircuitImage({ src, alt, className = "" }: CircuitImageProps) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  const handleLoad = () => {
    setLoading(false)
    setError(false)
  }

  const handleError = () => {
    setLoading(false)
    setError(true)
  }

  if (error) {
    return (
      <div className={`flex items-center justify-center rounded-lg bg-secondary/30 p-4 ${className}`}>
        <div className="text-center text-sm text-muted-foreground">
          赛道图加载失败
        </div>
      </div>
    )
  }

  return (
    <div className="relative">
      {loading && (
        <div className={`absolute inset-0 flex items-center justify-center rounded-lg bg-secondary/30 ${className}`}>
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      )}
      <img
        src={src}
        alt={alt}
        className={`h-auto w-full max-h-[180px] rounded-lg object-contain transition-opacity ${className} ${loading ? "opacity-0" : "opacity-100"}`}
        onLoad={handleLoad}
        onError={handleError}
        loading="lazy"
      />
    </div>
  )
}
