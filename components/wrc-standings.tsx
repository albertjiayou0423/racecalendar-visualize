"use client"

import { useState } from "react"
import useSWR from "swr"
import { LoaderCircle, Trophy, TriangleAlert } from "lucide-react"

interface WrcSeason { seasonId: number; name: string; year: number }
interface WrcChampionship { championshipId: number; name: string; type: string }
interface WrcStanding {
  id: number
  position: number | string
  points: number | string
  name: string
  countryCode: string
  team: string
  profileUrl: string | null
  rounds: Array<{ eventId: number; totalPoints: number | string; position: string }>
}
interface WrcResponse {
  ok: boolean
  note?: string
  season: WrcSeason
  seasons: WrcSeason[]
  championship: WrcChampionship
  championships: WrcChampionship[]
  standings: WrcStanding[]
}

const fetcher = (url: string) => fetch(url).then(async (response) => {
  const data = await response.json() as WrcResponse
  if (!response.ok || !data.ok) throw new Error(data.note || "Failed to load WRC standings")
  return data
})

export function WrcStandings() {
  const [seasonYear, setSeasonYear] = useState(2026)
  const [championshipId, setChampionshipId] = useState<number | null>(null)
  const query = `/api/wrc-standings?season=${seasonYear}${championshipId ? `&championship=${championshipId}` : ""}`
  const { data, error, isLoading, mutate } = useSWR<WrcResponse>(query, fetcher)

  if (isLoading && !data) {
    return <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground"><LoaderCircle className="size-5 animate-spin" />加载 WRC 官方积分榜…</div>
  }
  if (error && !data) {
    return <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-muted-foreground"><div className="flex items-center gap-2"><TriangleAlert className="size-4 text-destructive" />{error.message}</div><button onClick={() => mutate()} className="mt-3 underline">重试</button></div>
  }
  if (!data) return null

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm font-medium"><Trophy className="size-4 text-primary" />WRC 官方积分榜</div>
        <div className="flex flex-wrap gap-2">
          <select aria-label="WRC 赛季" value={data.season.year} onChange={(event) => { setSeasonYear(Number(event.target.value)); setChampionshipId(null) }} className="rounded-lg border border-border bg-card px-3 py-2 text-sm">
            {data.seasons.map((season) => <option key={season.seasonId} value={season.year}>{season.year} 赛季</option>)}
          </select>
          <select aria-label="WRC 锦标赛类别" value={data.championship.championshipId} onChange={(event) => setChampionshipId(Number(event.target.value))} className="max-w-[260px] rounded-lg border border-border bg-card px-3 py-2 text-sm">
            {data.championships.map((championship) => <option key={championship.championshipId} value={championship.championshipId}>{championship.name.replace(/^FIA\s+/, "")}</option>)}
          </select>
        </div>
      </div>
      {error && <p className="text-xs text-muted-foreground">刷新失败，当前显示上次成功的数据。</p>}
      {data.standings.length === 0 ? (
        <div className="rounded-lg border border-border bg-card p-5 text-sm text-muted-foreground">本赛季暂时没有积分数据。</div>
      ) : (
        <div className="space-y-1.5">
          {data.standings.map((standing, index) => {
            const name = standing.name || standing.team || `Entry ${standing.id}`
            return (
              <div key={standing.id} className={`flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 ${index < 3 ? "bg-primary/[0.03]" : ""}`}>
                <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold ${index < 3 ? "text-primary" : "text-muted-foreground"}`}>{standing.position}</div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 truncate font-medium">
                    {standing.countryCode && <span className="text-xs text-muted-foreground">{standing.countryCode}</span>}
                    {standing.profileUrl ? <a href={standing.profileUrl} target="_blank" rel="noreferrer" className="truncate hover:underline">{name}</a> : <span className="truncate">{name}</span>}
                  </div>
                  {standing.team && standing.name !== standing.team && <div className="truncate text-xs text-muted-foreground">{standing.team}</div>}
                </div>
                <div className="text-right"><div className="font-mono text-lg font-bold tabular-nums">{standing.points}</div><div className="text-[10px] text-muted-foreground">PTS</div></div>
              </div>
            )
          })}
        </div>
      )}
      <p className="text-center text-[11px] text-muted-foreground">数据来源：WRC 官网公开积分榜，约每小时更新</p>
    </section>
  )
}
