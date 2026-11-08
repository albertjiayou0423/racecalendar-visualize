"use client"

import { useEffect } from "react"

type StatusPageEmbedProps = {
  src: string
  title?: string
  heightClassName?: string
}

export function StatusPageEmbed({ src, title = "赛道时刻服务状态", heightClassName = "h-[320px] w-full sm:h-[360px]" }: StatusPageEmbedProps) {
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
        title={title}
        className={`${heightClassName} border-0 bg-background`}
        loading="lazy"
        referrerPolicy="strict-origin-when-cross-origin"
      />
    </div>
  )
}
