"use client"

import { useState, useEffect } from "react"
import { Trophy, CheckCircle2, Users } from "lucide-react"
import type { RaceEvent } from "@/lib/types"
import { SERIES_META } from "@/lib/format"
import { cn } from "@/lib/utils"

interface PredictionVoteProps {
  event: RaceEvent
}

const VOTE_STORAGE_KEY = "race-predictions"

// F1 2026 车手列表（简化版，实际应该从 API 获取）
const F1_DRIVERS_2026 = [
  { code: "VER", name: "维斯塔潘", team: "红牛" },
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
]

// FE 车手列表（简化版）
const FE_DRIVERS_2026 = [
  { code: "EVANS", name: "Mitch Evans", team: "Jaguar TCS Racing" },
  { code: "BIRD", name: "Sam Bird", team: "McLaren Formula E Team" },
  { code: "VANDOORNE", name: "Stoffel Vandoorne", team: "MASERATI MSG Racing" },
  { code: "DA COSTA", name: "Antonio Felix da Costa", team: "TAG Heuer Porsche Formula E Team" },
  { code: "VERGNE", name: "Jean-Eric Vergne", team: "DS PENSKE" },
]

type Prediction = {
  eventId: string
  driverCode: string
  timestamp: number
}

export function PredictionVote({ event }: PredictionVoteProps) {
  const [selectedDriver, setSelectedDriver] = useState<string | null>(null)
  const [voted, setVoted] = useState(false)
  const [showDropdown, setShowDropdown] = useState(false)

  const meta = SERIES_META[event.series]
  const drivers = event.series === "F1" ? F1_DRIVERS_2026 : event.series === "FE" ? FE_DRIVERS_2026 : []

  useEffect(() => {
    // 从 localStorage 加载已保存的预测
    try {
      const saved = localStorage.getItem(VOTE_STORAGE_KEY)
      if (saved) {
        const predictions: Prediction[] = JSON.parse(saved)
        const existing = predictions.find((p) => p.eventId === event.id)
        if (existing) {
          setSelectedDriver(existing.driverCode)
          setVoted(true)
        }
      }
    } catch {
      // ignore
    }
  }, [event.id])

  const handleVote = (driverCode: string) => {
    setSelectedDriver(driverCode)
    setVoted(true)
    setShowDropdown(false)

    // 保存到 localStorage
    try {
      const saved = localStorage.getItem(VOTE_STORAGE_KEY)
      const predictions: Prediction[] = saved ? JSON.parse(saved) : []
      const existingIndex = predictions.findIndex((p) => p.eventId === event.id)
      const newPrediction: Prediction = {
        eventId: event.id,
        driverCode,
        timestamp: Date.now(),
      }

      if (existingIndex >= 0) {
        predictions[existingIndex] = newPrediction
      } else {
        predictions.push(newPrediction)
      }

      localStorage.setItem(VOTE_STORAGE_KEY, JSON.stringify(predictions))
    } catch {
      // ignore
    }
  }

  if (drivers.length === 0) return null

  const selectedDriverInfo = drivers.find((d) => d.code === selectedDriver)

  return (
    <div className="mt-4 rounded-xl border border-primary/20 bg-primary/5 p-4">
      <div className="flex items-center gap-2 text-sm font-medium text-foreground">
        <Trophy className="size-4 text-primary" />
        <span>预测冠军</span>
      </div>

      {voted && selectedDriverInfo ? (
        <div className="mt-3 flex items-center gap-2">
          <CheckCircle2 className="size-4 text-emerald-500" />
          <span className="text-sm text-muted-foreground">你预测：</span>
          <span className="font-semibold text-foreground">{selectedDriverInfo.name}</span>
          <span className="text-xs text-muted-foreground">({selectedDriverInfo.team})</span>
        </div>
      ) : (
        <div className="mt-3">
          <div className="relative">
            <button
              onClick={() => setShowDropdown((v) => !v)}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-left text-sm text-muted-foreground hover:border-primary"
            >
              {selectedDriverInfo ? (
                <span className="text-foreground">{selectedDriverInfo.name}</span>
              ) : (
                "选择车手..."
              )}
            </button>

            {showDropdown && (
              <div className="absolute left-0 right-0 top-full z-20 mt-1 max-h-60 overflow-auto rounded-lg border border-border bg-card shadow-lg">
                {drivers.map((driver) => (
                  <button
                    key={driver.code}
                    onClick={() => handleVote(driver.code)}
                    className={cn(
                      "flex w-full items-center gap-3 px-3 py-2 text-left text-sm transition-colors hover:bg-secondary",
                      selectedDriver === driver.code && "bg-primary/10"
                    )}
                  >
                    <span className="font-mono text-xs font-bold text-muted-foreground w-10">
                      {driver.code}
                    </span>
                    <div className="flex-1">
                      <div className="font-medium text-foreground">{driver.name}</div>
                      <div className="text-xs text-muted-foreground">{driver.team}</div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            预测结果仅保存在本地，用于个人记录
          </p>
        </div>
      )}
    </div>
  )
}