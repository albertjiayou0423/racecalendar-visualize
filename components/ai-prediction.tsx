"use client"

import { useState } from "react"
import { Sparkles, Trophy, Loader2, AlertCircle } from "lucide-react"
import type { RaceEvent } from "@/lib/types"
import { cn } from "@/lib/utils"

interface AIPredictionProps {
  event: RaceEvent
}

interface Prediction {
  position: number
  driver: string
  team: string
  confidence: number
  reason: string
}

export function AIPrediction({ event }: AIPredictionProps) {
  const [loading, setLoading] = useState(false)
  const [predictions, setPredictions] = useState<Prediction[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [rawAnalysis, setRawAnalysis] = useState<string | null>(null)

  const fetchPrediction = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/predictions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventId: event.id,
          series: event.series,
          eventName: event.name,
          circuit: event.circuit,
        }),
      })

      if (!res.ok) {
        throw new Error("预测服务暂时不可用")
      }

      const data = await res.json()
      setPredictions(data.predictions)
      setRawAnalysis(data.rawAnalysis || null)
    } catch (e) {
      setError(e instanceof Error ? e.message : "预测失败")
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className="mt-4 rounded-xl border border-border bg-card overflow-hidden">
      <button
        onClick={fetchPrediction}
        disabled={loading}
        className="flex w-full items-center justify-between gap-2 px-5 py-3 text-left transition-colors hover:bg-secondary/50 disabled:opacity-50"
      >
        <div className="flex items-center gap-2">
          <Sparkles className="size-4 text-primary" />
          <span className="text-sm font-semibold">AI 赛事预测</span>
          {predictions && (
            <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
              已生成
            </span>
          )}
        </div>
        {loading ? (
          <Loader2 className="size-4 animate-spin text-muted-foreground" />
        ) : (
          <span className="text-xs text-muted-foreground">点击生成 →</span>
        )}
      </button>

      {error && (
        <div className="flex items-center gap-2 border-t border-border px-5 py-3 text-sm text-red-500">
          <AlertCircle className="size-4" />
          {error}
        </div>
      )}

      {predictions && predictions.length > 0 && (
        <div className="border-t border-border">
          <div className="px-5 py-3">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Trophy className="size-3" />
              预测前3名完赛者
            </div>
          </div>

          <ul className="divide-y divide-border/60">
            {predictions.map((p, i) => (
              <li
                key={i}
                className={cn(
                  "flex items-center justify-between gap-3 px-5 py-3",
                  i === 0 && "bg-amber-500/5"
                )}
              >
                <div className="flex items-center gap-3">
                  <span
                    className={cn(
                      "flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold",
                      i === 0
                        ? "bg-amber-500 text-white"
                        : i === 1
                        ? "bg-gray-400 text-white"
                        : "bg-amber-700/70 text-white"
                    )}
                  >
                    {p.position}
                  </span>
                  <div>
                    <div className="text-sm font-medium">{p.driver}</div>
                    <div className="text-xs text-muted-foreground">{p.team}</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-muted-foreground">
                    置信度 {p.confidence}%
                  </div>
                  <div className="h-1 w-16 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full bg-primary transition-all"
                      style={{ width: `${p.confidence}%` }}
                    />
                  </div>
                </div>
              </li>
            ))}
          </ul>

          {rawAnalysis && (
            <details className="border-t border-border">
              <summary className="px-5 py-2 text-xs text-muted-foreground cursor-pointer hover:text-foreground">
                查看 AI 分析原文
              </summary>
              <div className="px-5 pb-3">
                <pre className="whitespace-pre-wrap text-xs text-muted-foreground bg-secondary/30 rounded-lg p-3">
                  {rawAnalysis}
                </pre>
              </div>
            </details>
          )}

          <div className="border-t border-border/50 px-5 py-2 text-[10px] text-muted-foreground">
            AI 预测基于历史数据和赛道分析，仅供参考，不构成投注建议
          </div>
        </div>
      )}
    </section>
  )
}