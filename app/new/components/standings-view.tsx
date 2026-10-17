"use client"

import { useState } from "react"
import useSWR from "swr"
import { apiJson } from "../data"
import { DataState, SimpleBarChart, SimplePageHeader, SimpleTable, SimpleTabs } from "./data-ui"
import { SimpleFooter } from "./footer"

type Entry = { position: string | number; points: string | number; wins?: string; name?: string; team?: string; Driver?: { givenName: string; familyName: string }; Constructors?: { name: string }[]; Constructor?: { name: string } }
type Standings = { drivers?: Entry[]; constructors?: Entry[]; standings?: Entry[]; note?: string; season?: string | { year: number }; round?: string; seasons?: { seasonId: number; year: number }[]; championships?: { championshipId: number; name: string }[]; championship?: { championshipId: number } }
const tabs = [{ value: "drivers", label: "F1 车手" }, { value: "constructors", label: "F1 车队" }, { value: "wrc", label: "WRC" }, { value: "fe", label: "FE" }] as const
const entryName = (row: Entry) => row.name || row.Driver && `${row.Driver.givenName} ${row.Driver.familyName}` || row.Constructor?.name || row.team || "—"
const entryTeam = (row: Entry) => row.team || row.Constructors?.map(team => team.name).join(" / ") || ""
export function SimpleStandingsView() {
  const [tab, setTab] = useState<typeof tabs[number]["value"]>("drivers")
  const [season, setSeason] = useState(2026)
  const [championship, setChampionship] = useState("")
  const [metric, setMetric] = useState<"points" | "wins">("points")
  const url = tab === "wrc" ? `/api/wrc-standings?season=${season}${championship ? `&championship=${championship}` : ""}` : tab === "fe" ? "/api/fe-drivers" : `/api/f1-standings?type=${tab}`
  const { data, error, isLoading, mutate } = useSWR<Standings>(url, apiJson, { revalidateOnFocus: false, shouldRetryOnError: false })
  const rows = tab === "constructors" ? data?.constructors ?? [] : tab === "wrc" ? data?.standings ?? [] : data?.drivers ?? []
  return <main><SimplePageHeader title="积分榜" subtitle="车手、车队与冠军争夺" /><SimpleTabs label="积分榜类别" value={tab} options={tabs} onChange={value => { setTab(value); setMetric("points") }} />
    {tab === "wrc" && <div className="s-form-row"><label>赛季<select aria-label="WRC 赛季" value={season} onChange={event => { setSeason(Number(event.target.value)); setChampionship("") }}>{(data?.seasons ?? [{ year: 2026, seasonId: 0 }]).map(item => <option key={item.year} value={item.year}>{item.year}</option>)}</select></label><label>类别<select aria-label="WRC 锦标赛类别" value={championship || data?.championship?.championshipId || ""} onChange={event => setChampionship(event.target.value)}>{data?.championships?.map(item => <option key={item.championshipId} value={item.championshipId}>{item.name.replace(/^FIA\s+/, "")}</option>)}</select></label></div>}
    <DataState loading={isLoading} error={error} empty={!!data && rows.length === 0} retry={() => mutate()}><div className="s-score-heading"><span>{typeof data?.season === "string" ? `${data.season} 赛季` : tab === "wrc" ? `${season} 赛季` : "本赛季"}{data?.round ? ` · 第 ${data.round} 轮后` : ""}</span>{(tab === "drivers" || tab === "constructors") && <SimpleTabs label="积分对比指标" value={metric} options={[{ value: "points", label: "积分" }, { value: "wins", label: "胜场" }]} onChange={setMetric} />}</div><SimpleBarChart label={metric === "points" ? "积分对比 · 前十" : "胜场对比 · 前十"} rows={rows.map(row => ({ name: entryName(row), value: Number(row[metric]) || 0 }))} /><SimpleTable caption="积分排名" rows={rows} rowKey={(row, index) => `${entryName(row)}-${index}`} columns={[{ key: "position", title: "排名", render: row => row.position }, { key: "driver", title: tab === "constructors" ? "车队" : "车手 / 车队", render: row => <div><strong>{entryName(row)}</strong><small>{entryTeam(row)}</small></div> }, { key: "points", title: "积分", render: row => row.points }, ...(tab === "drivers" || tab === "constructors" ? [{ key: "wins", title: "胜场", render: (row: Entry) => row.wins || "0" }] : [])]} /></DataState><p className="s-note">数据来源：{tab === "wrc" ? "WRC 官网公开积分榜" : tab === "fe" ? "Formula E 官网公开数据" : "Jolpica F1 API"}。无数据不代表积分为零。</p><SimpleFooter /></main>
}
