"use client"

import type { ButtonHTMLAttributes, ReactNode } from "react"
import { RefreshCw } from "lucide-react"
import type { Series } from "@/lib/types"
import { countdownDisplay } from "@/lib/countdown-display"
import { SERIES_THEME_COLORS } from "@/lib/series-theme"

export function SeriesBadge({ series }: { series: Series }) {
  return <span className="s-badge"><i style={{ backgroundColor: SERIES_THEME_COLORS[series] }} aria-hidden="true" />{series}</span>
}
export function IconButton({ label, children, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { label: string; children: ReactNode }) {
  return <button type="button" className="s-icon" aria-label={label} title={label} {...props}>{children}</button>
}
export function CompactCountdown({ utc, now }: { utc: string; now: number }) {
  const { days, hours, minutes, seconds, total } = countdownDisplay(Date.parse(utc) - now)
  return <span className="s-countdown" aria-label={total === 0 ? "已到赛程时间" : `${days}天${hours}小时${minutes}分${seconds}秒后开始`}>
    {total === 0 ? "已到赛程时间" : <>{days > 0 && <span>{days}<small>天</small></span>}{String(hours).padStart(2, "0")}<em>:</em>{String(minutes).padStart(2, "0")}<em>:</em>{String(seconds).padStart(2, "0")}</>}
  </span>
}
export function EmptyState({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return <div className="s-empty"><p>{title}</p>{description && <span>{description}</span>}{action}</div>
}
export function LoadingState() {
  return <div className="s-loading" role="status" aria-label="赛历加载中"><RefreshCw size={15} className="s-spin" aria-hidden="true" />正在加载赛程…</div>
}
