"use client"

import useSWR from "swr"
import { ScheduleView } from "@/components/schedule-view"
import type { ScheduleResponse } from "@/lib/types"
import { TriangleAlert, LoaderCircle } from "lucide-react"

const fetcher = (url: string) => fetch(url).then((r) => r.json())

export default function Page() {
  const { data, error, isLoading } = useSWR<ScheduleResponse>("/api/schedule", fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 60_000,
  })

  return (
    <main className="min-h-dvh">
      {isLoading ? (
        <div className="flex min-h-dvh flex-col items-center justify-center gap-3 text-muted-foreground">
          <LoaderCircle className="size-8 animate-spin text-primary" />
          <p className="text-sm">正在获取赛程数据…</p>
        </div>
      ) : error ? (
        <div className="flex min-h-dvh flex-col items-center justify-center gap-3 text-muted-foreground">
          <TriangleAlert className="size-8 text-primary" />
          <p className="text-sm">数据加载失败，请稍后重试。</p>
        </div>
      ) : data ? (
        <ScheduleView data={data} />
      ) : null}
    </main>
  )
}
