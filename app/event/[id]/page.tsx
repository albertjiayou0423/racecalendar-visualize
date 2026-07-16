"use client"

import { useState, useEffect } from "react"
import { useParams } from "next/navigation"
import type { RaceEvent } from "@/lib/types"

export default function EventDetailPage() {
  const params = useParams()
  const id = params?.id as string
  const [event, setEvent] = useState<RaceEvent | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id) return
    fetch(`/api/schedule`)
      .then((r) => r.json())
      .then((data) => {
        const found = data.events.find((e: RaceEvent) => e.id === id)
        setEvent(found || null)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [id])

  if (loading) return <div className="p-10 text-center">加载中...</div>
  if (!event) return <div className="p-10 text-center">赛事不存在</div>

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="mx-auto max-w-2xl">
        <h1 className="text-2xl font-bold">{event.name}</h1>
        <p className="mt-2 text-muted-foreground">{event.circuit} · {event.locality}</p>
        <div className="mt-4 space-y-2">
          {event.sessions.map((s, i) => (
            <div key={i} className="rounded border p-2 text-sm">
              {s.name}: {s.utc}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
