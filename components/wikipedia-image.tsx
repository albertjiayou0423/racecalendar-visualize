"use client"

import { useState, useEffect } from "react"
import { ImageOff } from "lucide-react"

interface WikipediaImageProps {
  url: string
  maxHeight?: number
}

interface WikiSummary {
  thumbnail?: { source: string; width: number; height: number }
  originalimage?: { source: string; width: number; height: number }
}

function extractWikiTitle(url: string): string | null {
  try {
    const u = new URL(url)
    const path = u.pathname
    const match = path.match(/^\/wiki\/(.*)$/)
    if (match) return decodeURIComponent(match[1])
    return null
  } catch {
    return null
  }
}

export function WikipediaImage({ url, maxHeight = 200 }: WikipediaImageProps) {
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const controller = new AbortController()
    setImageUrl(null)
    setLoading(true)

    const title = extractWikiTitle(url)
    if (!title) {
      setLoading(false)
      return () => controller.abort()
    }

    let active = true
    const timeout = window.setTimeout(() => controller.abort(), 8000)
    const summaryUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`

    fetch(summaryUrl, { signal: controller.signal })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: WikiSummary | null) => {
        if (controller.signal.aborted) return
        if (data?.thumbnail?.source) {
          const rawUrl = data.thumbnail.source.replace(/\/[^/]+$/, `/page-width-${Math.min(800, data.thumbnail.width)}`)
          setImageUrl(`/api/image-proxy?url=${encodeURIComponent(rawUrl)}`)
        } else if (data?.originalimage?.source) {
          setImageUrl(`/api/image-proxy?url=${encodeURIComponent(data.originalimage.source)}`)
        }
      })
      .catch(() => {})
      .finally(() => {
        window.clearTimeout(timeout)
        if (active) setLoading(false)
      })

    return () => {
      active = false
      window.clearTimeout(timeout)
      controller.abort()
    }
  }, [url])

  if (loading) {
    return (
      <div
        style={{ maxHeight }}
        className="flex h-32 items-center justify-center rounded-lg bg-secondary/50 text-sm text-muted-foreground"
      >
        加载图片...
      </div>
    )
  }

  if (!imageUrl) {
    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        style={{ maxHeight }}
        className="flex h-32 flex-col items-center justify-center gap-2 rounded-lg bg-secondary/50 text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
      >
        <ImageOff className="size-5" />
        <span>暂无图片</span>
      </a>
    )
  }

  return (
    <a href={url} target="_blank" rel="noopener noreferrer" className="block overflow-hidden rounded-lg">
      <img
        src={imageUrl}
        alt="Wikipedia 赛道图片"
        style={{ maxHeight }}
        onError={() => setImageUrl(null)}
        className="h-auto w-full object-cover"
        loading="lazy"
      />
    </a>
  )
}
