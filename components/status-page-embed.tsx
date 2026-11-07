"use client"

import { useEffect } from "react"

type StatusPageEmbedProps = {
  src: string
}

export function StatusPageEmbed({ src }: StatusPageEmbedProps) {
  const setNativeCursor = (enabled: boolean) => {
    document.documentElement.classList.toggle("cursor-native-over-embed", enabled)
  }

  useEffect(() => () => document.documentElement.classList.remove("cursor-native-over-embed"), [])

  return (
    <div
      className="status-page-embed"
      onPointerEnter={() => setNativeCursor(true)}
      onPointerLeave={() => setNativeCursor(false)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setNativeCursor(false)
      }}
    >
      <iframe
        src={src}
        title="赛道时刻服务状态"
        className="h-[280px] w-full border-0 bg-background sm:h-[300px]"
        loading="lazy"
        referrerPolicy="strict-origin-when-cross-origin"
      />
    </div>
  )
}
