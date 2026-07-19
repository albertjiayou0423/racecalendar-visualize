"use client"

import { useState, useEffect, useCallback } from "react"
import { Trophy, CheckCircle2, Users, AlertCircle, Loader2, Award, ChevronDown, Check } from "lucide-react"
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
  color: string
  flag: string
}

interface PredictionResult {
  driverCode: string
  count: number
}

const DRIVER_METADATA: Record<string, Record<string, { color: string; flag: string }>> = {
  F1: {
    VER: { color: "#3671C6", flag: "🇳🇱" },
    NOR: { color: "#FF8000", flag: "🇬🇧" },
    PIA: { color: "#FF8000", flag: "🇦🇺" },
    LEC: { color: "#E10600", flag: "🇲🇨" },
    HAM: { color: "#E10600", flag: "🇬🇧" },
    RUS: { color: "#27F4D2", flag: "🇬🇧" },
    ANT: { color: "#27F4D2", flag: "🇮🇹" },
    SAI: { color: "#64C4FF", flag: "🇪🇸" },
    ALO: { color: "#229971", flag: "🇪🇸" },
    STR: { color: "#229971", flag: "🇨🇦" },
    HUL: { color: "#C92D80", flag: "🇩🇪" },
    BOT: { color: "#C92D80", flag: "🇫🇮" },
    GAS: { color: "#0093CC", flag: "🇫🇷" },
    DOO: { color: "#0093CC", flag: "🇦🇺" },
    TSU: { color: "#6692FF", flag: "🇯🇵" },
    HAD: { color: "#6692FF", flag: "🇫🇷" },
    ALB: { color: "#64C4FF", flag: "🇹🇭" },
    OCO: { color: "#B6BABD", flag: "🇫🇷" },
    BEA: { color: "#B6BABD", flag: "🇬🇧" },
    LAW: { color: "#6692FF", flag: "🇳🇿" },
  },
  FE: {
    EVANS: { color: "#002F6C", flag: "🇳🇿" },
    BIRD: { color: "#FF8000", flag: "🇬🇧" },
    VANDOORNE: { color: "#004F9F", flag: "🇧🇪" },
    DA_COSTA: { color: "#000000", flag: "🇵🇹" },
    VERGNE: { color: "#C5A059", flag: "🇫🇷" },
    MORTARA: { color: "#FF0000", flag: "🇨🇭" },
    JEV: { color: "#FFFF00", flag: "🇫🇷" },
    DI_GRASSI: { color: "#1E90FF", flag: "🇧🇷" },
    WEHRLEIN: { color: "#000000", flag: "🇩🇪" },
    EVANS_B: { color: "#008080", flag: "🇳🇿" },
  },
  WRC: {
    OGIER: { color: "#E10600", flag: "🇫🇷" },
    LOEB: { color: "#0000FF", flag: "🇫🇷" },
    NEUVILLE: { color: "#004080", flag: "🇧🇪" },
    TÄNAK: { color: "#004080", flag: "🇪🇪" },
    ROVANPERÄ: { color: "#E10600", flag: "🇫🇮" },
    EVANS: { color: "#E10600", flag: "🇬🇧" },
    KATSI: { color: "#004080", flag: "🇫🇷" },
    SUNINEN: { color: "#004080", flag: "🇫🇮" },
    BREEN: { color: "#0080FF", flag: "🇮🇪" },
    FOURNIER: { color: "#E10600", flag: "🇫🇷" },
  }
}

const DRIVERS_RAW: Record<string, Omit<Driver, "color" | "flag">[]> = {
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
    { code: "EVANS", name: "埃文斯", team: "Jaguar TCS Racing" },
    { code: "BIRD", name: "萨姆·伯德", team: "McLaren Formula E" },
    { code: "VANDOORNE", name: "范多恩", team: "MASERATI MSG" },
    { code: "DA_COSTA", name: "达科斯塔", team: "TAG Heuer Porsche" },
    { code: "VERGNE", name: "维尔涅", team: "DS PENSKE" },
    { code: "MORTARA", name: "莫塔拉", team: "Mahindra Racing" },
    { code: "JEV", name: "普罗斯特", team: "Renault e.dams" },
    { code: "DI_GRASSI", name: "迪格拉西", team: "ROKiT Venturi" },
    { code: "WEHRLEIN", name: "维尔莱茵", team: "Porsche Formula E" },
    { code: "EVANS_B", name: "卡西迪", team: "Envision Racing" },
  ],
  WRC: [
    { code: "OGIER", name: "奥吉尔", team: "丰田 Gazoo Racing" },
    { code: "LOEB", name: "勒布", team: "现代 N" },
    { code: "NEUVILLE", name: "诺伊维尔", team: "现代 N" },
    { code: "TÄNAK", name: "塔纳克", team: "现代 N" },
    { code: "ROVANPERÄ", name: "罗万佩拉", team: "丰田 Gazoo Racing" },
    { code: "EVANS", name: "埃文斯", team: "丰田 Gazoo Racing" },
    { code: "KATSI", name: "穆纳", team: "现代 N" },
    { code: "SUNINEN", name: "苏尼宁", team: "现代 N" },
    { code: "BREEN", name: "布林", team: "福特 M-Sport" },
    { code: "FOURNIER", name: "福尼耶", team: "丰田 Gazoo Racing" },
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
  const [isOpen, setIsOpen] = useState(false)

  const meta = SERIES_META[event.series]
  const cacheKey = `prediction_voted_${event.id}`

  // 初始化带有完整样式的车手对象
  const drivers: Driver[] = (DRIVERS_RAW[event.series] ?? []).map((d) => {
    const defaultMeta = { color: "#A0AEC0", flag: "🏁" }
    const customMeta = DRIVER_METADATA[event.series]?.[d.code] ?? defaultMeta
    return {
      ...d,
      color: customMeta.color,
      flag: customMeta.flag,
    }
  })

  const fetchPredictions = useCallback(async () => {
    // 优先从 localStorage 提取本地缓存，实现零延迟渲染 (optimistic rendering)
    try {
      const cachedVote = localStorage.getItem(cacheKey)
      if (cachedVote) {
        setSelectedDriver(cachedVote)
      }
    } catch (e) {
      // localStorage 不可用
    }

    try {
      const res = await fetch(`/api/predictions?eventId=${event.id}`)
      if (res.ok) {
        const data = await res.json()
        setResults(data.results ?? [])
        setTotal(data.total ?? 0)

        // 假如数据库中有更新的投票，则以数据库为准，同步更新本地缓存
        if (data.myVote) {
          setSelectedDriver(data.myVote)
          try {
            localStorage.setItem(cacheKey, data.myVote)
          } catch {}
        }
      }
    } catch (err) {
      console.error("Failed to fetch predictions:", err)
    } finally {
      setIsLoading(false)
    }
  }, [event.id, cacheKey])

  useEffect(() => {
    fetchPredictions()
  }, [fetchPredictions])

  const handleVote = async (driverCode: string) => {
    if (!driverCode || isVoting) return

    setErrorMsg(null)
    setSuccessMsg(null)
    setIsVoting(true)
    setIsOpen(false)

    // 1. 客户端立即乐观更新 (Optimistic UI Update) 并写入 LocalStorage 缓存
    const oldDriver = selectedDriver
    setSelectedDriver(driverCode)
    try {
      localStorage.setItem(cacheKey, driverCode)
    } catch {}

    try {
      const res = await fetch("/api/predictions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId: event.id, driverCode }),
      })

      if (res.ok) {
        setSuccessMsg("预测已保存！")
        await fetchPredictions()
        setTimeout(() => setSuccessMsg(null), 2500)
      } else {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || "预测保存失败")
      }
    } catch (err) {
      console.error("Failed to vote:", err)
      setErrorMsg(err instanceof Error ? err.message : "预测保存失败，请重试")
      // 失败时回滚
      setSelectedDriver(oldDriver)
      try {
        if (oldDriver) {
          localStorage.setItem(cacheKey, oldDriver)
        } else {
          localStorage.removeItem(cacheKey)
        }
      } catch {}
    } finally {
      setIsVoting(false)
    }
  }

  if (drivers.length === 0) return null

  const selectedDriverInfo = drivers.find((d) => d.code === selectedDriver)

  return (
    <div className="mt-4 rounded-xl border border-primary/20 bg-primary/5 p-4 relative">
      <div className="flex items-center gap-2 text-sm font-medium text-foreground">
        <Trophy className="size-4 text-primary animate-pulse" />
        <span>预测 {meta.label} 本站冠军</span>
        {total > 0 && (
          <span className="ml-auto flex items-center gap-1.5 text-xs text-muted-foreground bg-secondary/40 px-2 py-0.5 rounded-full">
            <Users className="size-3" />
            {total} 人参与
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
          <div className="mt-3 relative">
            {/* 已投车手展示卡片 */}
            {selectedDriver && !errorMsg ? (
              <div
                className="mb-3 flex items-center gap-3 rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-2.5 transition-all"
                style={{ borderLeft: `4px solid ${selectedDriverInfo?.color || "#10B981"}` }}
              >
                <div
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xs font-bold font-mono text-white relative shadow-sm"
                  style={{ backgroundColor: selectedDriverInfo?.color || "#6B7280" }}
                >
                  {selectedDriverInfo?.code}
                  <span className="absolute -bottom-1 -right-1 text-sm bg-card rounded-full p-0.5 shadow-sm leading-none">
                    {selectedDriverInfo?.flag}
                  </span>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[10px] uppercase font-bold tracking-wider text-emerald-500 flex items-center gap-1">
                    <CheckCircle2 className="size-3" /> 我的冠军预测
                  </div>
                  <div className="font-semibold text-sm text-foreground flex items-center gap-1">
                    <span>{selectedDriverInfo?.name}</span>
                    <span className="text-xs text-muted-foreground">({selectedDriverInfo?.team})</span>
                  </div>
                </div>
              </div>
            ) : null}

            {/* 自定义精美下拉选择框 */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                disabled={isVoting}
                className={cn(
                  "flex w-full items-center justify-between gap-2 rounded-lg border border-border bg-card px-3 py-2.5 text-sm text-foreground shadow-sm transition-all hover:border-primary focus:border-primary disabled:opacity-50 disabled:cursor-not-allowed",
                  isOpen && "border-primary ring-1 ring-primary"
                )}
              >
                <span className="flex items-center gap-2 truncate">
                  <Award className="size-4 text-muted-foreground" />
                  {isVoting ? (
                    <span className="text-muted-foreground">正在提交预测...</span>
                  ) : selectedDriver ? (
                    <span>更改冠军预测...</span>
                  ) : (
                    <span className="text-muted-foreground">选择你预测的冠军车手...</span>
                  )}
                </span>
                <ChevronDown className={cn("size-4 text-muted-foreground transition-transform", isOpen && "rotate-180")} />
              </button>

              {isOpen && (
                <div className="absolute left-0 right-0 z-20 mt-1 max-h-64 overflow-y-auto rounded-lg border border-border bg-card shadow-lg p-1">
                  {drivers.map((driver) => {
                    const driverResults = results.find((r) => r.driverCode === driver.code)
                    const percentage = total > 0 && driverResults
                      ? Math.round((driverResults.count / total) * 100)
                      : 0
                    const isSelected = selectedDriver === driver.code

                    return (
                      <button
                        key={driver.code}
                        type="button"
                        onClick={() => handleVote(driver.code)}
                        className={cn(
                          "flex w-full items-center gap-3 rounded-md px-2 py-2 text-left text-sm transition-colors hover:bg-secondary/50",
                          isSelected && "bg-primary/10 font-medium text-primary"
                        )}
                      >
                        <div
                          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[10px] font-bold font-mono text-white relative"
                          style={{ backgroundColor: driver.color }}
                        >
                          {driver.code}
                          <span className="absolute -bottom-1 -right-1 text-xs">
                            {driver.flag}
                          </span>
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="font-semibold text-xs flex items-center gap-1.5">
                            <span>{driver.name}</span>
                            <span className="text-[10px] text-muted-foreground truncate font-normal">
                              {driver.team}
                            </span>
                          </div>
                        </div>
                        <div className="text-right shrink-0 text-xs text-muted-foreground font-mono">
                          {driverResults ? (
                            <span>{driverResults.count}票 ({percentage}%)</span>
                          ) : (
                            <span className="opacity-40">0票</span>
                          )}
                        </div>
                        {isSelected && <Check className="size-4 text-primary shrink-0" />}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>

            {isVoting && (
              <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="size-3.5 animate-spin text-primary" />
                正在同步云端数据库...
              </div>
            )}

            {successMsg && (
              <div className="mt-2 flex items-center gap-2 text-xs text-emerald-500 font-medium">
                <CheckCircle2 className="size-3.5" />
                {successMsg}
              </div>
            )}

            {errorMsg && (
              <div className="mt-2 flex items-center gap-2 text-xs text-destructive font-medium">
                <AlertCircle className="size-3.5" />
                {errorMsg}
              </div>
            )}
          </div>

          {/* 预测结果环比百分比图表 */}
          {results.length > 0 && (
            <div className="mt-4 space-y-2 border-t border-border/40 pt-3">
              <div className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                <span>实时预测大盘</span>
                <span className="text-[10px] font-normal text-muted-foreground/60">(取前 5 位最高得票)</span>
              </div>
              {results.slice(0, 5).map((result) => {
                const driver = drivers.find((d) => d.code === result.driverCode)
                if (!driver) return null
                const percentage = total > 0 ? Math.round((result.count / total) * 100) : 0
                const isMyVote = selectedDriver === result.driverCode

                return (
                  <div key={result.driverCode} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className={cn("truncate flex items-center gap-1.5", isMyVote && "font-semibold text-primary")}>
                        <span
                          className="inline-block size-2 rounded-full shrink-0"
                          style={{ backgroundColor: driver.color }}
                        />
                        <span>{driver.flag}</span>
                        <span>{driver.name}</span>
                        {isMyVote && <span className="text-[10px] bg-primary/20 text-primary px-1 py-0.1 rounded font-normal">你的选择</span>}
                      </span>
                      <span className="text-muted-foreground shrink-0 ml-2 font-mono text-[11px] tabular-nums">
                        {result.count} 票 ({percentage}%)
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-muted overflow-hidden relative shadow-inner">
                      <div
                        className={cn(
                          "h-full rounded-full transition-all duration-1000 ease-out"
                        )}
                        style={{
                          width: `${percentage}%`,
                          backgroundColor: driver.color
                        }}
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
