"use client"

import { useState, useEffect, useCallback } from "react"
import { Trophy, CheckCircle2, Users, AlertCircle, Loader2 } from "lucide-react"
import type { RaceEvent } from "@/lib/types"
import { SERIES_META } from "@/lib/format"
import { cn } from "@/lib/utils"

interface PredictionVoteProps {
  event: RaceEvent
}

interface Driver {
  code: string
  name: string
  team: string
}

interface PredictionResult {
  driverCode: string
  count: number
}

const DRIVERS: Record<string, Driver[]> = {
  F1: [
    { code: "VER", name: "维斯塔潘", team: "红牛 Racing" },
    { code: "NOR", name: "诺里斯", team: "迈凯伦" },
    { code: "PIA", name: "皮亚斯特里", team: "迈凯伦" },
    { code: "LEC", name: "勒克莱尔", team: "法拉利" },
    { code: "HAM", name: "汉密尔顿", team: "法拉利" },
    { code: "RUS", name: "拉塞尔", team: "梅赛德斯" },
    { code: "ANT", name: "安东内利", team: "梅赛德斯" },
    { code: "SAI", name: "塞恩斯", team: "威廉姆斯" },
    { code: "ALO", name: "阿隆索", team: "阿斯顿马丁" },
    { code: "STR", name: "斯特罗尔", team: "阿斯顿马丁" },
    { code: "HUL", name: "霍肯伯格", team: "奥迪/索伯" },
    { code: "BOT", name: "博塔斯", team: "奥迪/索伯" },
    { code: "GAS", name: "加斯利", team: "Alpine" },
    { code: "DOO", name: "杜汉", team: "Alpine" },
    { code: "TSU", name: "角田裕毅", team: "红牛二队" },
    { code: "HAD", name: "哈贾尔", team: "红牛二队" },
    { code: "ALB", name: "阿尔本", team: "威廉姆斯" },
    { code: "OCO", name: "奥康", team: "哈斯" },
    { code: "BEA", name: "比尔曼", team: "哈斯" },
    { code: "LAW", name: "劳森", team: "Racing Bulls" },
  ],
  FE: [
    { code: "EVANS", name: "Mitch Evans", team: "Jaguar TCS Racing" },
    { code: "BIRD", name: "Sam Bird", team: "McLaren Formula E" },
    { code: "VANDOORNE", name: "Stoffel Vandoorne", team: "MASERATI MSG" },
    { code: "DA_COSTA", name: "Antonio Felix da Costa", team: "TAG Heuer Porsche" },
    { code: "VERGNE", name: "Jean-Eric Vergne", team: "DS PENSKE" },
    { code: "MORTARA", name: "Edoardo Mortara", team: "Mahindra Racing" },
    { code: "JEV", name: "Nicolas Prost", team: "Renault e.dams" },
    { code: "DI_GRASSI", name: "Lucas di Grassi", team: "ROKiT Venturi" },
    { code: "WEHRLEIN", name: "Pascal Wehrlein", team: "Porsche Formula E" },
    { code: "EVANS_B", name: "Nick Cassidy", team: "Envision Racing" },
  ],
  WRC: [
    { code: "OGIER", name: "塞巴斯蒂安·奥吉尔 / 文森特·兰布拉斯", team: "丰田 Gazoo Racing" },
    { code: "LOEB", name: "塞巴斯蒂安·勒布 / 伊夫·穆勒", team: "现代 N" },
    { code: "NEUVILLE", name: "蒂埃里·诺伊维尔 / 马蒂亚斯·韦伊勒", team: "现代 N" },
    { code: "TÄNAK", name: "奥特·塔纳克 / 马丁·亚尔韦", team: "现代 N" },
    { code: "ROVANPERÄ", name: "卡勒·罗万佩拉 / 乔尼·哈尔塔宁", team: "丰田 Gazoo Racing" },
    { code: "EVANS", name: "埃尔芬·埃文斯 / 斯科特·马丁", team: "丰田 Gazoo Racing" },
    { code: "KATSI", name: "格雷瓜尔·穆纳 / 塞巴斯蒂安·德尔普拉多", team: "现代 N" },
    { code: "SUNINEN", name: "蒂莫·苏尼宁 / 米卡·安蒂拉", team: "现代 N" },
    { code: "BREEN", name: "克雷格·布林 / 詹姆斯·富尔顿", team: "福特 M-Sport" },
    { code: "FOURNIER", name: "亚多·福尼耶 / 文森特·兰布拉斯", team: "丰田 Gazoo Racing" },
  ],
}

export function PredictionVote({ event }: PredictionVoteProps) {
  const [selectedDriver, setSelectedDriver] = useState<string>("")
  const [results, setResults] = useState<PredictionResult[]>([])
  const [total, setTotal] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [isVoting, setIsVoting] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  const drivers = DRIVERS[event.series] ?? []
  const meta = SERIES_META[event.series]

  const fetchPredictions = useCallback(async () => {
    try {
      const res = await fetch(`/api/predictions?eventId=${event.id}`)
      if (res.ok) {
        const data = await res.json()
        setResults(data.results ?? [])
        setTotal(data.total ?? 0)
        if (data.myVote) {
          setSelectedDriver(data.myVote)
        }
      }
    } catch (err) {
      console.error("Failed to fetch predictions:", err)
    } finally {
      setIsLoading(false)
    }
  }, [event.id])

  useEffect(() => {
    fetchPredictions()
  }, [fetchPredictions])

  const handleChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const driverCode = e.target.value
    if (!driverCode) return

    setErrorMsg(null)
    setSuccessMsg(null)
    setIsVoting(true)
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
      setSelectedDriver("")
    } finally {
      setIsVoting(false)
    }
  }

  if (drivers.length === 0) return null

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
                <span className="font-semibold text-foreground">{selectedDriverInfo?.name}</span>
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
                        {driver?.name ?? result.driverCode}
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