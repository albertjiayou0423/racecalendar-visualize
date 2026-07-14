"use client"

import { useState } from "react"
import { Search, X } from "lucide-react"
import type { RaceEvent } from "@/lib/types"
import { cn } from "@/lib/utils"

interface SearchFilterProps {
  events: RaceEvent[]
  onFiltered: (filtered: RaceEvent[]) => void
  placeholder?: string
}

export function SearchFilter({ events, onFiltered, placeholder = "搜索赛事名称、地点、国家..." }: SearchFilterProps) {
  const [query, setQuery] = useState("")
  const [country, setCountry] = useState<string>("")

  // 获取所有国家列表
  const countries = Array.from(
    new Set(events.map((e) => e.country).filter(Boolean)),
  ).sort()

  // 执行搜索过滤
  const filtered = events.filter((event) => {
    const matchQuery = !query || 
      event.name.toLowerCase().includes(query.toLowerCase()) ||
      event.locality.toLowerCase().includes(query.toLowerCase()) ||
      event.country.toLowerCase().includes(query.toLowerCase()) ||
      event.circuit.toLowerCase().includes(query.toLowerCase())

    const matchCountry = !country || event.country === country

    return matchQuery && matchCountry
  })

  // 每次过滤变化时更新父组件
  const hasFilters = query || country
  if (hasFilters) {
    onFiltered(filtered)
  } else {
    onFiltered(events)
  }

  const handleClear = () => {
    setQuery("")
    setCountry("")
  }

  return (
    <div className="space-y-3 rounded-lg border border-border bg-card p-4">
      <div className="flex items-center gap-2">
        <Search className="size-4 text-muted-foreground" aria-hidden />
        <input
          type="text"
          placeholder={placeholder}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          aria-label="搜索赛事"
        />
        {(query || country) && (
          <button
            type="button"
            onClick={handleClear}
            className="rounded p-1 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            aria-label="清除过滤"
          >
            <X className="size-4" aria-hidden />
          </button>
        )}
      </div>

      {/* 国家过滤 */}
      {countries.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {countries.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setCountry(country === c ? "" : c)}
              className={cn(
                "rounded-full px-3 py-1 text-xs font-medium transition-colors",
                country === c
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-secondary-foreground hover:bg-secondary/80",
              )}
            >
              {c}
            </button>
          ))}
        </div>
      )}

      {/* 搜索结果数 */}
      {hasFilters && (
        <div className="text-xs text-muted-foreground">
          找到 {filtered.length} 个赛事
          {query && <span>，关键词："{query}"</span>}
          {country && <span>，国家：{country}</span>}
        </div>
      )}
    </div>
  )
}
