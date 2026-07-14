import type { RaceEvent } from "@/lib/types"
import { BEIJING_TZ, SERIES_META, formatDate, mainSession } from "@/lib/format"
import { CalendarDays } from "lucide-react"

interface DateGroup {
  date: string // "M月D日 周X"
  events: RaceEvent[]
}

/**
 * 按赛事主赛事的北京时间日期分组
 */
function groupEventsByDate(events: RaceEvent[]): DateGroup[] {
  const groups = new Map<string, RaceEvent[]>()

  for (const event of events) {
    const main = mainSession(event)
    if (!main) continue
    const date = formatDate(main.utc, BEIJING_TZ)
    if (!groups.has(date)) {
      groups.set(date, [])
    }
    groups.get(date)!.push(event)
  }

  // 按日期排序
  const sorted = Array.from(groups.entries()).sort((a, b) => {
    const aDate = new Date(a[1][0].sessions[0]?.utc || 0)
    const bDate = new Date(b[1][0].sessions[0]?.utc || 0)
    return aDate.getTime() - bDate.getTime()
  })

  return sorted.map(([date, events]) => ({ date, events }))
}

export function DateGroupedView({ events }: { events: RaceEvent[] }) {
  const groups = groupEventsByDate(events)

  if (groups.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-border bg-secondary/30 py-12">
        <CalendarDays className="size-8 text-muted-foreground" aria-hidden />
        <p className="text-sm text-muted-foreground">暂无赛事</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {groups.map(({ date, events: dateEvents }) => (
        <section key={date}>
          <h3 className="sticky top-0 z-10 flex items-center gap-2 bg-background px-1 py-2 font-mono text-xs font-bold uppercase tracking-wide text-muted-foreground">
            <CalendarDays className="size-4" aria-hidden />
            {date}
          </h3>
          <div className="space-y-2 border-l border-border/50 pl-4 py-2">
            {dateEvents.map((event) => {
              const main = mainSession(event)
              if (!main) return null
              const meta = SERIES_META[event.series]
              return (
                <div
                  key={event.id}
                  className="rounded-lg border border-border/60 bg-card/50 p-3 text-sm transition-colors hover:bg-card hover:border-border"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span
                          className="rounded px-1.5 py-0.5 text-xs font-bold"
                          style={{ backgroundColor: meta.color, color: meta.textColor }}
                        >
                          {meta.label}
                        </span>
                        <span className="truncate font-medium">{event.name}</span>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">{event.locality}，{event.country}</p>
                    </div>
                    <div className="shrink-0 text-right font-mono text-xs font-semibold">
                      北京 {main.utc.split("T")[1]?.slice(0, 5)}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      ))}
    </div>
  )
}
