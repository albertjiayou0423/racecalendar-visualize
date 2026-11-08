"use client"

import useSWR from "swr"
import Link from "next/link"
import { Info } from "lucide-react"

const STATUS_URL = "https://api.openstatus.dev/public/status/racecalendar-huosai"

type OpenStatusResponse = {
  status?: string
}

const fetchStatus = async (url: string): Promise<OpenStatusResponse> => {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`OpenStatus HTTP ${response.status}`)
  const data = await response.json() as OpenStatusResponse
  if (typeof data?.status !== "string") throw new Error("Invalid OpenStatus response")
  return data
}

const STATUS_PRESENTATION: Record<string, { label: string; color: string }> = {
  success: { label: "服务正常", color: "bg-emerald-500" },
  operational: { label: "服务正常", color: "bg-emerald-500" },
  degraded_performance: { label: "服务波动", color: "bg-amber-500" },
  partial_outage: { label: "部分中断", color: "bg-amber-500" },
  major_outage: { label: "服务中断", color: "bg-red-500" },
  maintenance: { label: "维护中", color: "bg-sky-500" },
}

export function OpenStatusBadge() {
  const { data } = useSWR<OpenStatusResponse>(STATUS_URL, fetchStatus, {
    refreshInterval: 5 * 60 * 1000,
    dedupingInterval: 60 * 1000,
    revalidateOnFocus: false,
    shouldRetryOnError: false,
  })

  const status = data?.status ? STATUS_PRESENTATION[data.status] : undefined
  const label = status?.label ?? "服务状态"

  return (
    <Link
      href="/status"
      aria-label={`查看赛道时刻服务状态：${label}`}
      title={`查看服务状态${status ? `：${label}` : ""}`}
      className="inline-flex min-h-7 w-fit items-center gap-1.5 rounded-full border border-border/70 px-2.5 text-xs text-muted-foreground transition-colors hover:border-border hover:bg-muted/50 hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
    >
      <span aria-hidden className={`size-1.5 rounded-full ${status?.color ?? "bg-muted-foreground/50"}`} />
      <span>{label}</span>
      <Info aria-hidden="true" className="size-3 shrink-0 opacity-70" />
    </Link>
  )
}
