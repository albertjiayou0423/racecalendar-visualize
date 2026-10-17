"use client"

import { useState } from "react"
import type { Series } from "@/lib/types"
import { useSimpleSchedule } from "../data"
import { SimplePageHeader, SimpleTabs, DataState } from "./data-ui"
import { CalendarArtwork, SvgExporter } from "./artwork"
import { SimpleFooter } from "./footer"
import { SimpleSourceStatus } from "./source-status"

export function SimpleWallpaperView() {
  const { data, error, isLoading, mutate } = useSimpleSchedule()
  const [mode, setMode] = useState<"phone" | "desktop">("phone")
  const [year, setYear] = useState(2026)
  const [month, setMonth] = useState(9)
  const [series, setSeries] = useState<"ALL" | Series>("ALL")
  const events = data?.events.filter(event => series === "ALL" || event.series === series) ?? []
  return <main><SimplePageHeader title="日历壁纸" subtitle="真实赛历，生成可保存的手机与桌面日历" /><SimpleSourceStatus data={data} error={!!error} /><DataState loading={isLoading && !data} error={!data && error} retry={() => mutate()}><div className="s-wallpaper-layout"><div className="s-wallpaper-controls"><SimpleTabs label="壁纸比例" value={mode} options={[{ value: "phone", label: "手机 · 月历" }, { value: "desktop", label: "桌面 · 全年" }]} onChange={setMode} /><div className="s-form-row"><label>年份<input type="number" aria-label="壁纸年份" min={2020} max={2100} value={year} onChange={event => setYear(Math.max(2020, Math.min(2100, Number(event.target.value) || 2026)))} /></label>{mode === "phone" && <label>月份<select aria-label="壁纸月份" value={month} onChange={event => setMonth(Number(event.target.value))}>{Array.from({ length: 12 }, (_, index) => <option key={index} value={index}>{index + 1}月</option>)}</select></label>}</div><label className="s-form-label">赛事系列<select aria-label="壁纸赛事系列" value={series} onChange={event => setSeries(event.target.value as typeof series)}>{["ALL", "F1", "WRC", "FE"].map(value => <option key={value} value={value}>{value === "ALL" ? "全部赛事" : value}</option>)}</select></label><p className="s-note">手机 1080 × 1920<br />桌面 1600 × 1200<br />SVG 可无损缩放。标记待确认的场次不展示精确时间。</p></div><SvgExporter filename={`racecalendar-${year}-${mode === "phone" ? month + 1 : "year"}`}><CalendarArtwork events={events} year={year} month={month} mode={mode} /></SvgExporter></div></DataState><SimpleFooter /></main>
}
