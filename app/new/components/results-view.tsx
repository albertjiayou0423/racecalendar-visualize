"use client"

import { useState } from "react"
import useSWR from "swr"
import { ChevronDown } from "lucide-react"
import { apiJson } from "../data"
import { DataState, SimplePageHeader, SimpleTable, SimpleTabs } from "./data-ui"
import { SimpleFooter } from "./footer"

type Result = { position: string | number; points: string | number; driver?: string; team?: string; Driver?: { givenName: string; familyName: string }; Constructor?: { name: string }; Time?: { time: string }; status?: string; fastestLap?: string; laps?: string; grid?: string }
type Race = { id?: string; season?: string; round?: string; sequence?: number; raceName?: string; name?: string; date: string; Results?: Result[]; Circuit?: { circuitName: string } }
type RaceData = { races?: Race[]; results?: Record<string, Result[]>; note?: string }
function RaceResultsTable({ race, series, season, initial }: { race: Race; series: "F1" | "FE"; season: string; initial?: Result[] }) {
  const future = Date.parse(race.date) > Date.now()
  const { data, error, isLoading, mutate } = useSWR<RaceData>(series === "FE" && !initial && !future ? `/api/results?series=FE&season=${season}&race=${encodeURIComponent(race.id || "")}` : null, apiJson, { revalidateOnFocus: false, shouldRetryOnError: false })
  const rows = initial ?? race.Results ?? (race.id ? data?.results?.[race.id] : undefined) ?? []
  return <DataState loading={isLoading} error={error} empty={rows.length === 0} retry={() => mutate()}><SimpleTable caption={`${race.raceName || race.name}赛果`} rows={rows} rowKey={(row, index) => `${row.position}-${index}`} columns={[{ key: "position", title: "名次", render: row => row.position }, { key: "name", title: "车手", render: row => <div><strong>{row.driver || `${row.Driver?.givenName ?? ""} ${row.Driver?.familyName ?? ""}`}</strong><small>{row.team || row.Constructor?.name}</small></div> }, { key: "time", title: "时间 / 状态", render: row => row.Time?.time || row.status || row.fastestLap || "—" }, { key: "points", title: "积分", render: row => row.points }]} /></DataState>
}
export function SimpleResultsView() {
  const [series, setSeries] = useState<"F1" | "FE">("F1")
  const [season, setSeason] = useState("2026")
  const [expanded, setExpanded] = useState<string | null>(null)
  const { data, error, isLoading, mutate } = useSWR<RaceData>(`/api/results?series=${series}&season=${season}`, apiJson, { revalidateOnFocus: false, shouldRetryOnError: false })
  return <main><SimplePageHeader title="历史赛果" subtitle="按赛季查看完整成绩，展开后显示赛果" /><div className="s-between"><SimpleTabs label="赛果系列" value={series} options={[{ value: "F1", label: "F1" }, { value: "FE", label: "FE" }]} onChange={value => { setSeries(value); setExpanded(null) }} /><select aria-label="赛果赛季" value={season} onChange={event => { setSeason(event.target.value); setExpanded(null) }}>{Array.from({ length: 12 }, (_, index) => String(2026 - index)).map(year => <option key={year}>{year}</option>)}</select></div><DataState loading={isLoading} error={error} empty={data?.races?.length === 0} retry={() => mutate()}><div className="s-result-list">{data?.races?.map((race, index) => { const id = race.id || `${race.season}-${race.round}`; const open = expanded === id; return <section key={id} className="s-disclosure"><button type="button" aria-expanded={open} aria-controls={`new-race-${index}`} onClick={() => setExpanded(value => value === id ? null : id)}><span className="s-muted">{race.round || race.sequence || index + 1}</span><span><strong>{race.raceName || race.name}</strong><small>{race.date.slice(0, 10)}{race.Circuit ? ` · ${race.Circuit.circuitName}` : ""}</small></span><ChevronDown size={15} className={open ? "s-turned" : ""} aria-hidden="true" /></button>{open && <div id={`new-race-${index}`}><RaceResultsTable race={race} series={series} season={season} initial={race.id ? data.results?.[race.id] : race.Results} /></div>}</section> })}</div></DataState><p className="s-note">F1：Jolpica；FE：Formula E 官方公开赛果。赛果按需展开。</p><SimpleFooter /></main>
}
