"use client"

import { useEffect, useState } from "react"
import useSWR from "swr"
import { Trophy, Flag } from "lucide-react"
import { countryCodeToFlag } from "@/lib/tz"
import { cn } from "@/lib/utils"

interface FeDriver {
  code: string
  name: string
  team: string
  country: string
  countryCode: string
  photoUrl: string
  points: number
  position: number
}

interface FeDriversResponse {
  drivers: FeDriver[]
  ok: boolean
  note?: string
}

const fetcher = (url: string) => fetch(url).then((r) => r.json() as Promise<FeDriversResponse>)

export function FeDriverStandings() {
  const { data, isLoading, error } = useSWR("/api/fe-drivers", fetcher)

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="flex items-center gap-3 rounded-lg border border-border bg-card p-3">
            <div className="h-10 w-10 animate-pulse rounded-full bg-muted" />
            <div className="flex-1 space-y-1">
              <div className="h-4 w-24 animate-pulse rounded bg-muted" />
              <div className="h-3 w-16 animate-pulse rounded bg-muted/70" />
            </div>
            <div className="h-5 w-12 animate-pulse rounded bg-muted" />
          </div>
        ))}
      </div>
    )
  }

  if (error || !data?.ok) {
    return (
      <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-muted-foreground">
        无法加载 FE 车手积分榜
      </div>
    )
  }

  const drivers = data.drivers ?? []

  if (drivers.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground">
        暂无 FE 车手数据
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-3">
        <Flag className="size-4" />
        Formula E 车手积分榜
      </div>
      {drivers.map((driver) => {
        const flag = countryCodeToFlag(driver.countryCode)
        return (
          <div
            key={driver.code}
            className={cn(
              "flex items-center gap-3 rounded-lg border bg-card p-3 transition-colors hover:border-muted-foreground/30",
              driver.position <= 3 ? "border-primary/20" : "border-border"
            )}
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary text-sm font-bold">
              {driver.position}
            </div>
            {driver.photoUrl ? (
              <img
                src={driver.photoUrl}
                alt={driver.name}
                className="h-10 w-10 rounded-full object-cover"
                loading="lazy"
              />
            ) : (
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted text-xs font-bold">
                {driver.code.slice(0, 2)}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                {flag ? <span className="text-sm">{flag}</span> : null}
                <span className="font-semibold truncate">{driver.name}</span>
              </div>
              <div className="text-xs text-muted-foreground truncate">{driver.team}</div>
            </div>
            <div className="text-right">
              <div className="font-mono font-bold">{driver.points}</div>
              <div className="text-xs text-muted-foreground">分</div>
            </div>
          </div>
        )
      })}
    </div>
  )
}