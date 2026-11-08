"use client"

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react"
import { AlertTriangle, Check, CircleHelp, Clock3, RefreshCw } from "lucide-react"

const STATUS_API_URL = "https://racecalendar-api-monitor.tangjiayou23.workers.dev/api/status"

type CheckStatus = "up" | "degraded" | "down" | "unknown"

type MonitorHistoryPoint = {
  status: Exclude<CheckStatus, "unknown">
  checkedAt: string
  latencyMs: number
  httpStatus?: number | null
  message?: string
}

type ApiMonitor = {
  id: string
  name: string
  status: CheckStatus
  checkedAt: string | null
  latencyMs: number | null
  httpStatus: number | null
  message: string
  history: MonitorHistoryPoint[]
}

type StatusResponse = {
  ok: boolean
  message?: string
  overall: CheckStatus
  intervalMinutes: number
  checkedAt: string | null
  monitors: ApiMonitor[]
  budget?: {
    statusExecutionsUsed: number
    statusExecutionLimit: number
    scheduledRunsUsed: number | null
    scheduledRunLimit: number
    resetsAt: string
  }
}

const STATUS_REFRESH_MS = 10 * 60_000
const statusTimeFormatter = new Intl.DateTimeFormat("zh-CN", {
  timeZone: "Asia/Shanghai",
  month: "numeric",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
})

const statusLabels: Record<CheckStatus, string> = {
  up: "正常",
  degraded: "较慢",
  down: "不可用",
  unknown: "等待检查",
}

function formatTime(value: string | null) {
  if (!value) return "尚无检查记录"
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) return "时间未知"
  return statusTimeFormatter.format(date)
}

function formatLatency(value: number | null) {
  if (value === null) return "—"
  return value >= 1000 ? `${(value / 1000).toFixed(1)} 秒` : `${value} 毫秒`
}

function statusTone(status: CheckStatus) {
  if (status === "up") return "text-emerald-400"
  if (status === "degraded") return "text-amber-400"
  if (status === "down") return "text-red-400"
  return "text-muted-foreground"
}

function bannerTone(status: CheckStatus) {
  if (status === "up") return "border-emerald-500/50 bg-emerald-500/10"
  if (status === "degraded") return "border-amber-500/50 bg-amber-500/10"
  if (status === "down") return "border-red-500/50 bg-red-500/10"
  return "border-border/70 bg-muted/30"
}

function summary(monitors: ApiMonitor[], hasError: boolean) {
  if (monitors.length === 0) return hasError ? "监控服务暂不可用" : "等待首次自动检查"
  const unavailable = monitors.filter((monitor) => monitor.status === "down").length
  const incomplete = monitors.filter((monitor) => monitor.status === "degraded").length
  const unknown = monitors.filter((monitor) => monitor.status === "unknown").length
  if (unavailable === monitors.length) return "所有受监控功能暂时不可用"
  if (unavailable > 0 && unknown > 0) return `${unavailable} 项功能不可用，${unknown} 项等待首次检查`
  if (unavailable > 0) return `${unavailable} 项功能暂时不可用`
  if (incomplete > 0 && unknown > 0) return `${incomplete} 项功能需要关注，${unknown} 项等待首次检查`
  if (incomplete > 0) return `${incomplete} 项功能数据不完整或响应较慢`
  if (unknown > 0) return `${unknown} 项功能等待首次检查`
  return "所有受监控功能运行正常"
}

function uptimeStats(history: MonitorHistoryPoint[], intervalMinutes: number) {
  const start = Date.now() - 24 * 60 * 60_000
  const recent = history.filter((point) => {
    const timestamp = Date.parse(point.checkedAt)
    return Number.isFinite(timestamp) && timestamp >= start && timestamp <= Date.now()
  })
  const expectedChecks = Math.ceil((24 * 60) / Math.max(1, intervalMinutes))

  return {
    availability: recent.length === 0
      ? "—"
      : `${((recent.filter((point) => point.status !== "down").length / recent.length) * 100).toFixed(1)}%`,
    coverage: `${recent.length}/${expectedChecks}`,
  }
}

function historySlots(history: MonitorHistoryPoint[], intervalMinutes: number) {
  const intervalMs = Math.max(1, intervalMinutes) * 60_000
  const count = Math.ceil((24 * 60) / Math.max(1, intervalMinutes))
  const start = Date.now() - 24 * 60 * 60_000
  const slots: (MonitorHistoryPoint | null)[] = Array.from({ length: count }, () => null)

  for (const point of history) {
    const timestamp = Date.parse(point.checkedAt)
    if (!Number.isFinite(timestamp) || timestamp < start || timestamp > Date.now()) continue
    const index = Math.min(count - 1, Math.floor((timestamp - start) / intervalMs))
    const existing = slots[index]
    if (!existing || Date.parse(point.checkedAt) > Date.parse(existing.checkedAt)) slots[index] = point
  }

  return slots
}

function StatusIcon({ status }: { status: CheckStatus }) {
  if (status === "up") return <Check className="size-4" aria-hidden="true" />
  if (status === "down" || status === "degraded") return <AlertTriangle className="size-4" aria-hidden="true" />
  return <CircleHelp className="size-4" aria-hidden="true" />
}

const ApiMonitorRow = memo(function ApiMonitorRow({
  monitor,
  intervalMinutes,
  selectedCheckedAt,
  onSelect,
}: {
  monitor: ApiMonitor
  intervalMinutes: number
  selectedCheckedAt: string | null
  onSelect: (monitorId: string, checkedAt: string) => void
}) {
  const slots = useMemo(() => historySlots(monitor.history, intervalMinutes), [monitor.history, intervalMinutes])
  const uptime = useMemo(() => uptimeStats(monitor.history, intervalMinutes), [monitor.history, intervalMinutes])
  const activePoint = selectedCheckedAt
    ? monitor.history.find((point) => point.checkedAt === selectedCheckedAt)
    : undefined

  return (
    <article className="min-w-0 py-4 first:pt-1 last:pb-1">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <div className="flex min-w-0 items-center gap-2.5">
          <h3 className="truncate text-sm font-medium">{monitor.name}</h3>
          <span className={`inline-flex shrink-0 items-center gap-1 text-xs ${statusTone(monitor.status)}`}>
            <StatusIcon status={monitor.status} />
            {statusLabels[monitor.status]}
          </span>
        </div>
        <span className="text-xs text-muted-foreground">
          <span className="font-medium text-foreground">{uptime.availability}</span>
          <span className="ml-1">24h 可用率</span>
          <span className="ml-2 text-[10px]">检查 {uptime.coverage}</span>
        </span>
      </div>

      <div className="mt-3 flex h-8 items-stretch gap-[3px] sm:h-9" aria-label={`${monitor.name} 最近24小时检查记录`}>
        {slots.map((point, index) => point ? (
          <button
            key={`${point.checkedAt}-${index}`}
            type="button"
            title={`${formatTime(point.checkedAt)} · ${statusLabels[point.status]} · ${formatLatency(point.latencyMs)}`}
            aria-label={`${monitor.name}，${formatTime(point.checkedAt)}，${statusLabels[point.status]}，${formatLatency(point.latencyMs)}。点击查看检查详情`}
            aria-pressed={selectedCheckedAt === point.checkedAt}
            onClick={() => onSelect(monitor.id, point.checkedAt)}
            className={`min-w-[2px] flex-1 transition-opacity hover:opacity-70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground ${
              point.status === "up" ? "bg-emerald-500" : point.status === "degraded" ? "bg-amber-400" : "bg-red-500"
            }`}
          />
        ) : (
          <span key={`empty-${index}`} className="min-w-[2px] flex-1 bg-muted" aria-hidden="true" />
        ))}
      </div>

      <div className="mt-1.5 flex justify-between text-[10px] text-muted-foreground">
        <span>24 小时前</span>
        <span>现在</span>
      </div>

      {activePoint && (
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 bg-muted/30 px-3 py-2 text-xs" role="status" aria-live="polite">
          <span className={statusTone(activePoint.status)}>{statusLabels[activePoint.status]}</span>
          <span>{formatTime(activePoint.checkedAt)}</span>
          {activePoint.httpStatus !== null && activePoint.httpStatus !== undefined && <span>HTTP {activePoint.httpStatus}</span>}
          <span>{formatLatency(activePoint.latencyMs)}</span>
          {activePoint.message && <span className="basis-full text-muted-foreground">{activePoint.message}</span>}
        </div>
      )}

      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
        <span>{monitor.message}</span>
        {monitor.httpStatus !== null && <span>HTTP {monitor.httpStatus}</span>}
        {monitor.latencyMs !== null && <span>{formatLatency(monitor.latencyMs)}</span>}
      </div>
    </article>
  )
})

export function ApiMonitorStatus() {
  const [data, setData] = useState<StatusResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [selectedCheck, setSelectedCheck] = useState<{ monitorId: string; checkedAt: string } | null>(null)
  const inFlightRef = useRef(false)
  const dataFingerprintRef = useRef<string | null>(null)

  const refresh = useCallback(async (manual = false) => {
    if (inFlightRef.current) return
    inFlightRef.current = true
    if (manual) setRefreshing(true)
    try {
      const response = await fetch(STATUS_API_URL, { cache: "default" })
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      const next = await response.json() as StatusResponse
      if (!next.ok || !Array.isArray(next.monitors)) {
        throw new Error(typeof next.message === "string"
          ? next.message
          : "监控数据格式无效")
      }
      const fingerprint = JSON.stringify(next)
      if (fingerprint !== dataFingerprintRef.current) {
        dataFingerprintRef.current = fingerprint
        setData(next)
      }
      setError(null)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "暂时无法连接云端监控，稍后会自动重试。")
    } finally {
      inFlightRef.current = false
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") void refresh()
    }
    refreshWhenVisible()
    const timer = window.setInterval(refreshWhenVisible, STATUS_REFRESH_MS)
    document.addEventListener("visibilitychange", refreshWhenVisible)
    return () => {
      window.clearInterval(timer)
      document.removeEventListener("visibilitychange", refreshWhenVisible)
    }
  }, [refresh])

  const selectCheck = useCallback((monitorId: string, checkedAt: string) => {
    setSelectedCheck((current) => current?.monitorId === monitorId && current.checkedAt === checkedAt
      ? null
      : { monitorId, checkedAt })
  }, [])

  const overall = data?.overall ?? "unknown"

  return (
    <section aria-labelledby="api-monitor-title" className="space-y-4">
      <h2 id="api-monitor-title" className="sr-only">接口状态</h2>
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => void refresh(true)}
          disabled={refreshing}
          className="inline-flex size-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
          aria-label="刷新监控状态"
          title="刷新监控状态"
        >
          <RefreshCw className={`size-3.5 ${refreshing ? "animate-spin" : ""}`} aria-hidden="true" />
        </button>
      </div>

      <div className={`flex items-center justify-between gap-3 border px-3 py-3 sm:px-4 ${bannerTone(overall)}`} role="status" aria-live="polite">
        <div className="flex min-w-0 items-center gap-3">
          <span className={`flex size-8 shrink-0 items-center justify-center ${overall === "up" ? "bg-emerald-500 text-black" : overall === "degraded" ? "bg-amber-400 text-black" : overall === "down" ? "bg-red-500 text-white" : "bg-muted text-muted-foreground"}`}>
            <StatusIcon status={overall} />
          </span>
          <span className="truncate text-sm font-semibold">{summary(data?.monitors ?? [], Boolean(error))}</span>
        </div>
        <span className="shrink-0 text-right text-[11px] text-muted-foreground sm:text-xs">{formatTime(data?.checkedAt ?? null)}</span>
      </div>

      {error && <p className="text-xs text-amber-400">{error}</p>}

      <div className="divide-y divide-border/60">
        {(data?.monitors ?? []).map((monitor) => (
          <ApiMonitorRow
            key={monitor.id}
            monitor={monitor}
            intervalMinutes={data?.intervalMinutes ?? 30}
            selectedCheckedAt={selectedCheck?.monitorId === monitor.id ? selectedCheck.checkedAt : null}
            onSelect={selectCheck}
          />
        ))}

        {loading && !data && Array.from({ length: 13 }, (_, index) => (
          <div key={index} className="py-4 first:pt-1" aria-hidden="true">
            <div className="flex justify-between gap-4">
              <div className="h-4 w-36 animate-pulse bg-muted/70" />
              <div className="h-4 w-20 animate-pulse bg-muted/50" />
            </div>
            <div className="mt-3 h-8 w-full animate-pulse bg-muted/40" />
          </div>
        ))}
      </div>

      {!loading && !data && (
        <p role="status" className="border-t border-border/70 py-4 text-sm text-muted-foreground">
          云端检查结果暂不可用；页面会在 10 分钟后自动重试。
        </p>
      )}

      <div className="flex flex-wrap items-center gap-x-2 text-[11px] text-muted-foreground">
        <Clock3 className="size-3" aria-hidden="true" />
        <span>检查间隔 {data?.intervalMinutes ?? 30} 分钟</span>
        <span aria-hidden="true">·</span>
        <span>历史保留 30 天</span>
        {data?.budget && (
          <>
            <span aria-hidden="true">·</span>
            <span>未缓存状态查询 {data.budget.statusExecutionsUsed.toLocaleString()}/{data.budget.statusExecutionLimit.toLocaleString()} 次</span>
          </>
        )}
      </div>
    </section>
  )
}
