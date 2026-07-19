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
    DI_GRASSI: { color: "#1E90FF", flag: "🇧睿" },
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
    try {
      const cachedVote = localStorage.getItem(cacheKey)
      if (cachedVote) {
        setSelectedDriver(cachedVote)
      }
    } catch (e) {}

    try {
      const res = await fetch(`/api/predictions?eventId=${event.id}`)
      if (res.ok) {
        const data = await res.json()
        setResults(data.results ?? [])
        setTotal(data.total ?? 0)

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
        setSuccessMsg("VOTE SAVED")
        await fetchPredictions()
        setTimeout(() => setSuccessMsg(null), 2000)
      } else {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || "Save failed")
      }
    } catch (err) {
      console.error("Failed to vote:", err)
      setErrorMsg(err instanceof Error ? err.message : "Save failed")
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
    <div className="mt-3 rounded-xl border border-primary/20 bg-primary/5 p-3.5 relative">
      {/* 极简标题栏 */}
      <div className="flex items-center gap-1.5 text-xs font-bold text-foreground/90 font-mono uppercase tracking-wider">
        <Trophy className="size-3.5 text-primary" />
        <span>VOTE</span>
        {total > 0 && (
          <span className="ml-auto flex items-center gap-1 text-[9px] text-muted-foreground bg-secondary/45 px-1.5 py-0.2 rounded-full font-mono font-bold">
            <Users className="size-2.5" />
            <span>{total}</span>
          </span>
        )}
      </div>

      {isLoading ? (
        <div className="mt-2 space-y-1.5">
          <div className="h-9 animate-pulse rounded-lg bg-muted" />
        </div>
      ) : (
        <>
          <div className="mt-2.5 relative">
            {/* 我的选择简洁卡片：少字多单色线条 */}
            {selectedDriver && !errorMsg ? (
              <div
                className="mb-2.5 flex items-center gap-2.5 rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-2 transition-all"
                style={{ borderLeft: `3px solid ${selectedDriverInfo?.color || "#10B981"}` }}
              >
                <div
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[10px] font-black font-mono text-white relative shadow-sm"
                  style={{ backgroundColor: selectedDriverInfo?.color || "#6B7280" }}
                >
                  {selectedDriverInfo?.code}
                  <span className="absolute -bottom-1 -right-1 text-xs">
                    {selectedDriverInfo?.flag}
                  </span>
                </div>
                <div className="min-w-0 flex-1 font-mono">
                  <div className="text-[8px] font-black uppercase text-emerald-500 tracking-wider flex items-center gap-0.5">
                    <CheckCircle2 className="size-2.5" /> MY PICK
                  </div>
                  <div className="font-extrabold text-xs text-foreground truncate">
                    {selectedDriverInfo?.name} <span className="text-[9px] text-muted-foreground font-normal">({selectedDriverInfo?.code})</span>
                  </div>
                </div>
              </div>
            ) : null}

            {/* 下拉选择按钮：单色线条极简风 */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                disabled={isVoting}
                className={cn(
                  "flex w-full items-center justify-between gap-2 rounded-lg border border-border bg-card px-2.5 py-2 text-xs text-foreground font-semibold shadow-sm transition-all hover:border-primary focus:border-primary disabled:opacity-50 disabled:cursor-not-allowed",
                  isOpen && "border-primary"
                )}
              >
                <span className="flex items-center gap-1.5 truncate uppercase tracking-wider font-mono text-[10px] text-muted-foreground">
                  <Award className="size-3.5 text-muted-foreground/80" />
                  {isVoting ? "SYNCING..." : selectedDriver ? "CHANGE PICK" : "SELECT WINNER"}
                </span>
                <ChevronDown className={cn("size-3.5 text-muted-foreground transition-transform", isOpen && "rotate-180")} />
              </button>

              {isOpen && (
                <div className="absolute left-0 right-0 z-20 mt-1 max-h-56 overflow-y-auto rounded-lg border border-border bg-card shadow-lg p-1">
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
                          "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs transition-colors hover:bg-secondary/50",
                          isSelected && "bg-primary/10 font-bold text-primary"
                        )}
                      >
                        <div
                          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[9px] font-black font-mono text-white relative"
                          style={{ backgroundColor: driver.color }}
                        >
                          {driver.code}
                          <span className="absolute -bottom-1 -right-1 text-xs">
                            {driver.flag}
                          </span>
                        </div>
                        <span className="font-extrabold text-[11px] text-foreground truncate">{driver.name}</span>
                        <div className="ml-auto text-right text-[10px] font-mono text-muted-foreground/75 shrink-0">
                          {driverResults ? `${driverResults.count} (${percentage}%)` : "0"}
                        </div>
                        {isSelected && <Check className="size-3.5 text-primary shrink-0 ml-1" />}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>

            {isVoting && (
              <div className="mt-1.5 flex items-center gap-1 text-[9px] text-muted-foreground font-mono font-semibold uppercase">
                <Loader2 className="size-3 animate-spin text-primary" />
                <span>SYNCING...</span>
              </div>
            )}

            {successMsg && (
              <div className="mt-1.5 flex items-center gap-1 text-[9px] text-emerald-500 font-mono font-bold uppercase">
                <CheckCircle2 className="size-3" />
                <span>SAVED</span>
              </div>
            )}

            {errorMsg && (
              <div className="mt-1.5 flex items-center gap-1 text-[9px] text-destructive font-mono font-bold uppercase">
                <AlertCircle className="size-3" />
                <span>ERROR</span>
              </div>
            )}
          </div>

          {/* 预测结果百分比条形图：极简单色化 */}
          {results.length > 0 && (
            <div className="mt-3.5 space-y-1.5 border-t border-border/40 pt-2.5">
              <div className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider font-mono flex items-center gap-1">
                <span>POLL TREND</span>
              </div>
              {results.slice(0, 5).map((result) => {
                const driver = drivers.find((d) => d.code === result.driverCode)
                if (!driver) return null
                const percentage = total > 0 ? Math.round((result.count / total) * 100) : 0
                const isMyVote = selectedDriver === result.driverCode

                return (
                  <div key={result.driverCode} className="space-y-0.5">
                    <div className="flex items-center justify-between text-[10px] font-mono">
                      <span className={cn("truncate flex items-center gap-1 text-muted-foreground", isMyVote && "font-extrabold text-primary")}>
                        <span className="size-1.5 rounded-full shrink-0" style={{ backgroundColor: driver.color }} />
                        <span>{driver.flag}</span>
                        <span>{driver.name}</span>
                      </span>
                      <span className="text-muted-foreground/90 shrink-0 font-mono text-[9px] font-bold">
                        {result.count} ({percentage}%)
                      </span>
                    </div>
                    <div className="h-1 rounded-full bg-muted overflow-hidden relative shadow-inner">
                      <div
                        className="h-full rounded-full transition-all duration-1000 ease-out"
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
