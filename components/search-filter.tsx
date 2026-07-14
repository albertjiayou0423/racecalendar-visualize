"use client"

import { useState } from "react"
import { Search, X } from "lucide-react"
import type { RaceEvent } from "@/lib/types"

interface SearchFilterProps {
  events: RaceEvent[]
  onFiltered: (filtered: RaceEvent[]) => void
  placeholder?: string
}

export function SearchFilter({ events, onFiltered, placeholder = "搜索赛事、城市、国家..." }: SearchFilterProps) {
  const [query, setQuery] = useState("")

  // 执行搜索过滤
  const filtered = events.filter((event) => {
    return !query || 
      event.name.toLowerCase().includes(query.toLowerCase()) ||
      event.locality.toLowerCase().includes(query.toLowerCase()) ||
      event.country.toLowerCase().includes(query.toLowerCase()) ||
      event.circuit.toLowerCase().includes(query.toLowerCase())
  })

  // 每次过滤变化时更新父组件
  if (query) {
    onFiltered(filtered)
  } else {
    onFiltered([])  // 无搜索时清空过滤，显示全部
  }

  const handleClear = () => {
    setQuery("")
  }

  return (
    <div className="rounded-lg border border-border bg-card p-3">
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
        {query && (
          <button
            type="button"
            onClick={handleClear}
            className="rounded p-1 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            aria-label="清除搜索"
          >
            <X className="size-4" aria-hidden />
          </button>
        )}
      </div>
    </div>
  )
}
