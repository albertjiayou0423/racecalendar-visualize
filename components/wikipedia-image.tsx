"use client"

import { useState, useEffect } from "react"
import { ImageOff } from "lucide-react"

interface WikipediaImageProps {
  url: string
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

export function WikipediaImage({ url }: WikipediaImageProps) {
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
        if (data?.originalimage?.source) {
          setImageUrl(data.originalimage.source)
        } else if (data?.thumbnail?.source) {
          setImageUrl(data.thumbnail.source)
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [url])

  if (loading) {
    return (
      <div className="flex h-40 items-center justify-center rounded-lg bg-secondary/50 text-sm text-muted-foreground">
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
        className="flex h-40 flex-col items-center justify-center gap-2 rounded-lg bg-secondary/50 text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
      >
        <ImageOff className="size-6" />
        <span>暂无图片，点击访问 Wikipedia</span>
      </a>
    )
  }

  return (
    <a href={url} target="_blank" rel="noopener noreferrer" className="block overflow-hidden rounded-lg">
      <img
        src={imageUrl}
        alt="Wikipedia 赛事图片"
        className="h-auto w-full object-cover transition-transform hover:scale-105"
        loading="lazy"
      />
    </a>
  )
}
