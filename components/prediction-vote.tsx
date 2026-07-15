"use client"

import { useState, useEffect, useCallback } from "react"
import { Trophy, CheckCircle2, Users, ChevronDown } from "lucide-react"
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

// 各赛事车手列表
const DRIVERS: Record<string, Driver[]> = {
  // F1 2026
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
  // FE 2026（简化）
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
  // WRC 2026（简化）
  WRC: [
    { code: "OGIER", name: "塞巴斯蒂安·奥吉尔", team: "丰田 Gazoo" },
    { code: "LOEB", name: "塞巴斯蒂安·勒布", team: "现代 N" },
    { code: "NEUVILLE", name: "蒂埃里·诺伊维尔", team: "现代 N" },
    { code: "TÄNAK", name: "奥特·塔纳克", team: "现代 N" },
    { code: "ROVANPERÄ", name: "卡勒·罗万佩拉", team: "丰田 Gazoo" },
    { code: "EVANS", name: "埃尔芬·埃文斯", team: "丰田 Gazoo" },
    { code: "KATSI", name: "格雷瓜尔·穆纳", team: "现代 N" },
    { code: "SUNINEN", name: "蒂莫·苏尼宁", team: "现代 N" },
    { code: "BREEN", name: "克雷格·布林", team: "福特 M-Sport" },
    { code: "FOURNIER", name: "亚多·福尼耶", team: "丰田 Gazoo" },
  ],
}

export function PredictionVote({ event }: PredictionVoteProps) {
  const [selectedDriver, setSelectedDriver] = useState<string | null>(null)
  const [results, setResults] = useState<PredictionResult[]>([])
  const [total, setTotal] = useState(0)
  const [showDropdown, setShowDropdown] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  const drivers = DRIVERS[event.series] ?? []
  const meta = SERIES_META[event.series]

  // 获取投票数据
  const fetchPredictions = useCallback(async () => {
    try {
      const res = await fetch(`/api/predictions?eventId=${event.id}`)
      if (res.ok) {
        const data = await res.json()
        setResults(data.results ?? [])
        setTotal(data.total ?? 0)
        setSelectedDriver(data.myVote)
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

  // 提交投票
  const handleVote = async (driverCode: string) => {
    try {
      const res = await fetch("/api/predictions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId: event.id, driverCode }),
      })

      if (res.ok) {
        setSelectedDriver(driverCode)
        setShowDropdown(false)
        // 刷新投票结果
        await fetchPredictions()
      }
    } catch (err) {
      console.error("Failed to vote:", err)
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
          {/* 投票按钮 / 已投票显示 */}
          <div className="mt-3">
            {selectedDriver ? (
              <div className="flex items-center gap-2">
                <CheckCircle2 className="size-4 text-emerald-500" />
                <span className="text-sm text-muted-foreground">你预测：</span>
                <span className="font-semibold text-foreground">{selectedDriverInfo?.name}</span>
                <button
                  onClick={() => setShowDropdown((v) => !v)}
                  className="ml-2 text-xs text-primary hover:underline"
                >
                  更改
                </button>
              </div>
            ) : (
              <div className="relative">
                <button
                  onClick={() => setShowDropdown((v) => !v)}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-left text-sm text-muted-foreground hover:border-primary"
                >
                  选择你预测的冠军...
                  <ChevronDown className="ml-auto inline size-4" />
                </button>
              </div>
            )}
          </div>

          {/* 下拉选择 */}
          {showDropdown && (
            <div className="mt-2 rounded-lg border border-border bg-card shadow-lg">
              <div className="max-h-48 overflow-auto">
                {drivers.map((driver) => {
                  const driverResults = results.find((r) => r.driverCode === driver.code)
                  const percentage = total > 0 && driverResults
                    ? Math.round((driverResults.count / total) * 100)
                    : 0

                  return (
                    <button
                      key={driver.code}
                      onClick={() => handleVote(driver.code)}
                      className={cn(
                        "flex w-full items-center gap-3 px-3 py-2 text-left text-sm transition-colors hover:bg-secondary",
                        selectedDriver === driver.code && "bg-primary/10"
                      )}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono text-xs font-bold text-muted-foreground w-12 shrink-0">
                            {driver.code}
                          </span>
                          <span className="font-medium text-foreground truncate">{driver.name}</span>
                          {selectedDriver === driver.code && (
                            <CheckCircle2 className="size-3 text-primary shrink-0" />
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground truncate">{driver.team}</div>
                      </div>
                      {driverResults && (
                        <div className="text-right shrink-0">
                          <div className="text-xs font-medium">{driverResults.count} 票</div>
                          <div className="text-[10px] text-muted-foreground">{percentage}%</div>
                        </div>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* 投票结果柱状图 */}
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