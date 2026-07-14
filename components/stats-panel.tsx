import type { RaceEvent, Series } from "@/lib/types"
import { isPast, SERIES_META } from "@/lib/format"
import { Trophy, Zap, Radio } from "lucide-react"

interface StatItem {
  label: string
  value: string | number
  icon: React.ReactNode
  color?: string
}

export function StatsPanel({ events, now }: { events: RaceEvent[]; now: number }) {
  const totalEvents = events.length
  const upcomingEvents = events.filter((e) => !isPast(e, now)).length
  const pastEvents = events.filter((e) => isPast(e, now)).length

  // 按系列统计
  const seriesCounts: Record<Series, number> = {
    F1: events.filter((e) => e.series === "F1").length,
    WRC: events.filter((e) => e.series === "WRC").length,
    FE: events.filter((e) => e.series === "FE").length,
  }

  // 获取最近的赛事
  const upcoming = events.filter((e) => !isPast(e, now)).sort((a, b) => {
    const aMain = a.sessions.find((s) => s.isMain) ?? a.sessions[a.sessions.length - 1]
    const bMain = b.sessions.find((s) => s.isMain) ?? b.sessions[b.sessions.length - 1]
    if (!aMain || !bMain) return 0
    return new Date(aMain.utc).getTime() - new Date(bMain.utc).getTime()
  })

  const nextEvent = upcoming[0]

  const stats: StatItem[] = [
    {
      label: "总赛事数",
      value: totalEvents,
      icon: <Trophy className="size-5" aria-hidden />,
    },
    {
      label: "即将开始",
      value: upcomingEvents,
      icon: <Zap className="size-5 text-yellow-500" aria-hidden />,
      color: "bg-yellow-500/10",
    },
    {
      label: "已结束",
      value: pastEvents,
      icon: <Radio className="size-5 text-muted-foreground" aria-hidden />,
    },
  ]

  return (
    <div className="space-y-5">
      {/* 快速统计卡片 */}
      <div className="grid grid-cols-3 gap-3">
        {stats.map((stat, idx) => (
          <div
            key={idx}
            className={`rounded-lg border border-border p-3 ${stat.color || "bg-secondary/30"}`}
          >
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
              {stat.icon}
              <span className="font-medium">{stat.label}</span>
            </div>
            <div className="text-2xl font-bold">{stat.value}</div>
          </div>
        ))}
      </div>

      {/* 系列统计 */}
      <div className="rounded-lg border border-border bg-card p-4">
        <h3 className="mb-3 text-xs font-bold uppercase tracking-wide text-muted-foreground">
          系列分布
        </h3>
        <div className="grid grid-cols-3 gap-3">
          {(["F1", "WRC", "FE"] as const).map((series) => {
            const meta = SERIES_META[series]
            const count = seriesCounts[series]
            return (
              <div key={series} className="rounded-lg bg-secondary/50 p-3">
                <div
                  className="mb-2 inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs font-bold"
                  style={{ backgroundColor: meta.color, color: meta.textColor }}
                >
                  <span>{meta.label}</span>
                </div>
                <div className="text-xl font-bold">{count}</div>
                <div className="text-xs text-muted-foreground">赛站</div>
              </div>
            )
          })}
        </div>
      </div>

      {/* 下一场赛事快览 */}
      {nextEvent ? (
        <div className="rounded-lg border border-border bg-gradient-to-br from-primary/5 to-primary/10 p-4">
          <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">
            下一场赛事
          </h3>
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-semibold">{nextEvent.name}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {nextEvent.locality}，{nextEvent.country}
              </p>
            </div>
            <span
              className="shrink-0 rounded px-2 py-1 text-xs font-bold"
              style={{
                backgroundColor: SERIES_META[nextEvent.series].color,
                color: SERIES_META[nextEvent.series].textColor,
              }}
            >
              {SERIES_META[nextEvent.series].label}
            </span>
          </div>
        </div>
      ) : null}
    </div>
  )
}
