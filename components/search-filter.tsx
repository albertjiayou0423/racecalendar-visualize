"use client"

import { useState, useEffect } from "react"
import { Search, X } from "lucide-react"
import type { RaceEvent } from "@/lib/types"

interface SearchFilterProps {
  events: RaceEvent[]
  onFiltered: (filtered: RaceEvent[]) => void
  placeholder?: string
}

export function SearchFilter({ events, onFiltered, placeholder = "搜索赛事、城市、国家..." }: SearchFilterProps) {
  const [query, setQuery] = useState("")

  // 当搜索词变化时，更新过滤结果
  useEffect(() => {
    if (!query.trim()) {
      onFiltered([])
      return
    }

    const filtered = events.filter((event) => {
      const lowerQuery = query.toLowerCase()
      return (
        event.name.toLowerCase().includes(lowerQuery) ||
        event.locality.toLowerCase().includes(lowerQuery) ||
        event.country.toLowerCase().includes(lowerQuery) ||
        event.circuit.toLowerCase().includes(lowerQuery)
      )
    })

    onFiltered(filtered)
  }, [query, events, onFiltered])

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
