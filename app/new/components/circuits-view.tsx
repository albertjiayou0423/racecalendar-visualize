"use client"

import { useState } from "react"
import { Search, ArrowUpRight } from "lucide-react"
import { getAllCircuits, type CircuitDetail } from "@/lib/circuits"
import { SimplePageHeader, SimpleTabs, SimpleSection } from "./data-ui"
import { SimpleFooter } from "./footer"
import { EmptyState } from "./primitives"

const types = [{ value: "all", label: "全部" }, { value: "permanent", label: "永久" }, { value: "street", label: "街道" }, { value: "hybrid", label: "混合" }, { value: "rally", label: "拉力" }] as const
export function SimpleCircuitCard({ circuit }: { circuit: CircuitDetail }) {
  return <article className="s-circuit"><div className="s-between"><div><h2>{circuit.name}</h2><p>{circuit.nameEn} · {circuit.city}，{circuit.country}</p></div><span className="s-muted">{types.find(type => type.value === circuit.type)?.label}</span></div><div className="s-circuit-facts"><span><strong>{circuit.length}</strong> km</span><span><strong>{circuit.turns}</strong> 弯</span><span><strong>{circuit.laps}</strong> 圈</span><span>难度 {circuit.difficulty}/5</span></div><details><summary>赛道资料</summary><p className="s-note">{circuit.description}</p><dl className="s-info-grid"><div><dt>首次使用</dt><dd>{circuit.firstUsed}</dd></div>{circuit.designer && <div><dt>设计者</dt><dd>{circuit.designer}</dd></div>}{circuit.lapRecord && <div><dt>单圈纪录</dt><dd>{circuit.lapRecord.time} · {circuit.lapRecord.driver} ({circuit.lapRecord.year})</dd></div>}{circuit.capacity && <div><dt>容量</dt><dd>{circuit.capacity.toLocaleString()}</dd></div>}</dl>{circuit.wikipediaUrl && <a href={circuit.wikipediaUrl} target="_blank" rel="noopener noreferrer" className="s-link">参考资料<ArrowUpRight size={13} aria-hidden="true" /></a>}</details></article>
}
export function SimpleCircuitsView() {
  const [type, setType] = useState<typeof types[number]["value"]>("all")
  const [query, setQuery] = useState("")
  const circuits = getAllCircuits().filter(circuit => (type === "all" || circuit.type === type) && `${circuit.name} ${circuit.nameEn} ${circuit.city} ${circuit.country}`.toLowerCase().includes(query.trim().toLowerCase()))
  return <main><SimplePageHeader title="赛道数据库" subtitle="长度、弯道、纪录与赛道故事" /><label className="s-search"><Search size={15} aria-hidden="true" /><input aria-label="搜索赛道" placeholder="赛道、城市、国家" value={query} onChange={event => setQuery(event.target.value)} /></label><SimpleTabs label="赛道类型" value={type} options={types} onChange={setType} /><SimpleSection title={`${circuits.length} 个赛道`}>{circuits.length ? circuits.map(circuit => <SimpleCircuitCard key={circuit.id} circuit={circuit} />) : <EmptyState title="没有匹配的赛道" action={<button className="s-link" onClick={() => { setQuery(""); setType("all") }}>清除筛选</button>} />}</SimpleSection><SimpleFooter /></main>
}
