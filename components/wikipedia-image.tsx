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
    const title = extractWikiTitle(url)
    if (!title) {
      setLoading(false)
      return
    }

    fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data: WikiSummary | null) => {
        if (data?.thumbnail?.source) {
          setImageUrl(data.thumbnail.source.replace(/\/[^/]+$/, `/page-width-${Math.min(800, data.thumbnail.width)}`))
        } else if (data?.originalimage?.source) {
          setImageUrl(data.originalimage.source)
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [url])

  if (loading) {
    return (
      <div className="flex h-32 items-center justify-center rounded-lg bg-secondary/50 text-sm text-muted-foreground">
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
        className="h-auto w-full max-h-[200px] object-cover transition-transform hover:scale-[1.02]"
        loading="lazy"
      />
    </a>
  )
}
