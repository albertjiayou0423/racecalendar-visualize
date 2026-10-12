"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import useSWR from "swr"
import { Trophy, CheckCircle2, Users, AlertCircle, Loader2 } from "lucide-react"
import type { RaceEvent } from "@/lib/types"
import { SERIES_META } from "@/lib/format"
import { LEGACY_DRIVER_LABELS, mapFePredictionDrivers, mapWrcPredictionDrivers, predictionRosterUrl } from "@/lib/prediction-roster"
import { cn } from "@/lib/utils"

interface PredictionVoteProps {
  event: RaceEvent
}

type Driver = { code: string; name: string; team: string }

interface PredictionResult {
  driverCode: string
  count: number
}

async function fetchRoster(url: string): Promise<{ drivers: Driver[] }> {
  const response = await fetch(url)
  const data = await response.json().catch(() => ({}))
  if (!response.ok || !data.ok) throw new Error(data.note || "预测候选暂时无法加载，请稍后重试。")

  const drivers = Array.isArray(data.standings)
    ? mapWrcPredictionDrivers(data.standings)
    : Array.isArray(data.drivers) && url.startsWith("/api/fe-drivers")
      ? mapFePredictionDrivers(data.drivers)
      : data.drivers
  if (!Array.isArray(drivers) || !drivers.length) throw new Error(data.note || "当前赛季暂无可用的预测候选。")
  return { drivers }
}

export function PredictionVote({ event }: PredictionVoteProps) {
  const [selectedDriver, setSelectedDriver] = useState<string>("")
  const [results, setResults] = useState<PredictionResult[]>([])
  const [total, setTotal] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [isVoting, setIsVoting] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  const rosterUrl = predictionRosterUrl(event.series, event.id)
  const { data: roster, error: rosterError, isLoading: rosterLoading, mutate: retryRoster } = useSWR<{ drivers: Driver[] }>(
    rosterUrl,
    fetchRoster,
    { shouldRetryOnError: false, revalidateOnFocus: false },
  )
  const drivers = roster?.drivers ?? []
  const meta = SERIES_META[event.series]
  const activeEventId = useRef(event.id)
  activeEventId.current = event.id

  const fetchPredictions = useCallback(async () => {
    try {
      const res = await fetch(`/api/predictions?eventId=${event.id}`)
      if (res.ok) {
        const data = await res.json()
        if (activeEventId.current !== event.id) return
        setResults(data.results ?? [])
        setTotal(data.total ?? 0)
        if (data.myVote) {
          setSelectedDriver(data.myVote)
        }
      }
    } catch (err) {
      console.error("Failed to fetch predictions:", err)
    } finally {
      if (activeEventId.current === event.id) setIsLoading(false)
    }
  }, [event.id])

  useEffect(() => {
    setSelectedDriver("")
    setResults([])
    setTotal(0)
    setErrorMsg(null)
    setSuccessMsg(null)
    setIsLoading(true)
    fetchPredictions()
  }, [fetchPredictions])

  const handleChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const driverCode = e.target.value
    if (!driverCode) return

    setErrorMsg(null)
    setSuccessMsg(null)
    setIsVoting(true)
    const previousDriver = selectedDriver
    // 先乐观更新，让用户有即时反馈
    setSelectedDriver(driverCode)

    try {
      const res = await fetch("/api/predictions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId: event.id, driverCode }),
      })

      if (res.ok) {
        setSuccessMsg("预测已保存！")
        await fetchPredictions()
        setTimeout(() => setSuccessMsg(null), 2000)
      } else {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || "投票失败")
      }
    } catch (err) {
      console.error("Failed to vote:", err)
      setErrorMsg(err instanceof Error ? err.message : "投票失败，请重试")
      // 失败时回滚
      setSelectedDriver(previousDriver)
    } finally {
      setIsVoting(false)
    }
  }

  if (!drivers.length) return <div className="mt-4 rounded-xl border border-border p-4 text-sm text-muted-foreground">
    {rosterLoading ? "加载赛季预测候选…" : rosterError?.message || "当前赛季暂无可用的预测候选。"}
    {!rosterLoading && <button className="ml-2 underline" onClick={() => retryRoster()}>重试</button>}
  </div>

  const selectedDriverInfo = drivers.find((d) => d.code === selectedDriver)

  return (
    <div className="mt-4 rounded-xl border border-primary/20 bg-primary/5 p-4">
      <div className="flex items-center gap-2 text-sm font-medium text-foreground">
        <Trophy className="size-4 text-primary" />
        <span>预测 {meta.label} 冠军</span>
        {total > 0 && (
          <span className="ml-auto flex items-center gap-1 text-xs text-muted-foreground">
            <Users className="size-3" />
            {total} 人预测
          </span>
        )}
      </div>

      {isLoading ? (
        <div className="mt-3 space-y-2">
          <div className="h-10 animate-pulse rounded-lg bg-muted" />
          <div className="h-4 w-24 animate-pulse rounded bg-muted/70" />
        </div>
      ) : (
        <>
          <div className="mt-3">
            {selectedDriver && !errorMsg ? (
              <div className="flex items-center gap-2 flex-wrap">
                <CheckCircle2 className="size-4 text-emerald-500 shrink-0" />
                <span className="text-sm text-muted-foreground">你预测：</span>
                <span className="font-semibold text-foreground">{selectedDriverInfo?.name ?? selectedDriver}</span>
              </div>
            ) : null}

            <div className={selectedDriver && !errorMsg ? "mt-2" : ""}>
              <select
                value={isVoting ? "" : selectedDriver}
                onChange={handleChange}
                disabled={isVoting}
                className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground outline-none transition-colors hover:border-primary focus:border-primary disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <option value="" disabled>
                  {isVoting ? "提交中..." : selectedDriver ? "更改预测..." : "选择你预测的冠军..."}
                </option>
                {drivers.map((driver) => {
                  const driverResults = results.find((r) => r.driverCode === driver.code)
                  const percentage = total > 0 && driverResults
                    ? Math.round((driverResults.count / total) * 100)
                    : 0
                  return (
                    <option key={driver.code} value={driver.code}>
                      {driver.name}
                      {driverResults ? ` (${driverResults.count}票 ${percentage}%)` : ""}
                    </option>
                  )
                })}
              </select>
            </div>

            {isVoting && (
              <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="size-3.5 animate-spin" />
                正在提交预测...
              </div>
            )}

            {successMsg && (
              <div className="mt-2 flex items-center gap-2 text-xs text-emerald-500">
                <CheckCircle2 className="size-3.5" />
                {successMsg}
              </div>
            )}

            {errorMsg && (
              <div className="mt-2 flex items-center gap-2 text-xs text-destructive">
                <AlertCircle className="size-3.5" />
                {errorMsg}
              </div>
            )}
          </div>

          {results.length > 0 && (
            <div className="mt-4 space-y-2">
              <div className="text-xs text-muted-foreground">预测分布</div>
              {results.slice(0, 5).map((result) => {
                const driver = drivers.find((d) => d.code === result.driverCode)
                const percentage = total > 0 ? Math.round((result.count / total) * 100) : 0
                const isMyVote = selectedDriver === result.driverCode

                return (
                  <div key={result.driverCode} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className={cn("truncate", isMyVote && "font-medium text-primary")}>
                        {driver?.name ?? LEGACY_DRIVER_LABELS[event.series]?.[result.driverCode] ?? result.driverCode}
                        {isMyVote && " (你的预测)"}
                      </span>
                      <span className="text-muted-foreground shrink-0 ml-2">
                        {result.count} 票 ({percentage}%)
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                      <div
                        className={cn(
                          "h-full rounded-full transition-all",
                          isMyVote ? "bg-primary" : "bg-secondary"
                        )}
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}
    </div>
  )
}
