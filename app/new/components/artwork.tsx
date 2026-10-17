"use client"

import { useRef, useState, type ReactNode } from "react"
import { Download, Copy } from "lucide-react"
import type { RaceEvent } from "@/lib/types"
import { SERIES_THEME_COLORS } from "@/lib/series-theme"
import { downloadFile } from "@/lib/download"
import { calendarDays, dayStart, isConfirmed, validTime } from "../model"
import { formatDateTime, BEIJING_TZ } from "@/lib/format"

export function SvgExporter({ children, filename, sharePath }: { children: ReactNode; filename: string; sharePath?: string }) {
  const preview = useRef<HTMLDivElement>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState("")
  async function save(format: "png" | "svg") {
    const svg = preview.current?.querySelector("svg")
    if (!svg || busy) return
    setBusy(true); setMessage("")
    let url: string | undefined
    try {
      const serialized = new XMLSerializer().serializeToString(svg)
      const blob = new Blob([serialized], { type: "image/svg+xml;charset=utf-8" })
      url = URL.createObjectURL(blob)
      if (format === "svg") { downloadFile(url, `${filename}.svg`, true); url = undefined; setMessage("已请求下载 SVG") }
      else {
        const image = new Image()
        image.decoding = "async"
        await new Promise<void>((resolve, reject) => { image.onload = () => resolve(); image.onerror = () => reject(new Error("图片生成失败")); image.src = url! })
        const canvas = document.createElement("canvas")
        canvas.width = svg.viewBox.baseVal.width; canvas.height = svg.viewBox.baseVal.height
        const context = canvas.getContext("2d")
        if (!context) throw new Error("当前浏览器无法生成图片")
        context.drawImage(image, 0, 0)
        const png = await new Promise<Blob>((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error("图片导出失败")), "image/png"))
        downloadFile(URL.createObjectURL(png), `${filename}.png`, true); setMessage("已请求下载 PNG")
      }
    } catch (error) { setMessage(error instanceof Error ? error.message : "导出失败，请重试") }
    finally { if (url) URL.revokeObjectURL(url); setBusy(false) }
  }
  async function copy() { try { await navigator.clipboard.writeText(new URL(sharePath!, location.origin).href); setMessage("链接已复制") } catch { setMessage("无法复制，请使用浏览器地址栏分享") } }
  return <div className="s-export"><div ref={preview} className="s-export-preview">{children}</div><div className="s-export-actions"><button className="s-button" type="button" disabled={busy} onClick={() => save("png")}><Download size={14} aria-hidden="true" />{busy ? "生成中…" : "下载 PNG"}</button><button className="s-link" type="button" disabled={busy} onClick={() => save("svg")}>下载 SVG</button>{sharePath && <button type="button" className="s-link" onClick={copy}><Copy size={13} aria-hidden="true" />复制链接</button>}</div><p className="s-note" role="status">{message || "预览与导出使用同一份真实赛程。"}</p></div>
}
function MonthGrid({ year, month, events, x, y, width, compact = false }: { year: number; month: number; events: RaceEvent[]; x: number; y: number; width: number; compact?: boolean }) {
  const key = `${year}-${String(month + 1).padStart(2, "0")}-01`
  const days = calendarDays(key, "month")
  const cell = width / 7
  const dotEvents = (day: string) => events.filter(event => event.sessions.some(session => validTime(session) && new Date(Date.parse(session.utc) + 28800000).toISOString().slice(0, 10) === day))
  return <g transform={`translate(${x} ${y})`}><text x="0" y="0" fill="#f5f5f5" fontSize={compact ? 23 : 48} fontWeight="600">{month + 1}月</text>{["一", "二", "三", "四", "五", "六", "日"].map((day, index) => <text key={day} x={(index + .5) * cell} y={compact ? 30 : 85} textAnchor="middle" fill="#858585" fontSize={compact ? 13 : 24}>{day}</text>)}{days.map((day, index) => { const matches = dotEvents(day); const active = day.slice(0, 7) === key.slice(0, 7); const dayX = (index % 7 + .5) * cell; const dayY = (compact ? 57 : 135) + Math.floor(index / 7) * (compact ? 28 : 83); return <g key={day}><text x={dayX} y={dayY} textAnchor="middle" fill={active ? "#f5f5f5" : "#414141"} fontSize={compact ? 16 : 35}>{Number(day.slice(-2))}</text>{active && Array.from(new Set(matches.map(event => event.series))).map((series, i, list) => <circle key={series} cx={dayX + (i - (list.length - 1) / 2) * (compact ? 6 : 12)} cy={dayY + (compact ? 8 : 18)} r={compact ? 2 : 4} fill={SERIES_THEME_COLORS[series]} />)}</g> })}</g>
}
export function CalendarArtwork({ events, year, month, mode }: { events: RaceEvent[]; year: number; month: number; mode: "phone" | "desktop" }) {
  const phone = mode === "phone"
  const monthEvents = events.map(event => ({ event, session: event.sessions.find(session => session.isMain) ?? event.sessions.filter(validTime).at(-1) })).filter(({ session }) => session && validTime(session) && new Date(Date.parse(session.utc) + 28800000).toISOString().slice(0, 7) === `${year}-${String(month + 1).padStart(2, "0")}`).sort((a, b) => Date.parse(a.session!.utc) - Date.parse(b.session!.utc))
  return <svg xmlns="http://www.w3.org/2000/svg" viewBox={phone ? "0 0 1080 1920" : "0 0 1600 1200"} role="img" aria-label={phone ? `${year}年${month + 1}月赛车日历壁纸` : `${year}年全年赛车日历壁纸`} style={{ fontFamily: "Arial, sans-serif" }}><rect width="100%" height="100%" fill="#111111" /><text x={phone ? 80 : 65} y={phone ? 180 : 85} fill="#f5f5f5" fontSize={phone ? 52 : 38} fontWeight="600">赛道时刻 <tspan fill="#777777" fontWeight="400">/ {year}</tspan></text>{phone ? <><MonthGrid year={year} month={month} events={events} x={80} y={340} width={920} /><line x1="80" x2="1000" y1="1030" y2="1030" stroke="#333333" />{monthEvents.slice(0, 7).map(({ event, session }, index) => <g key={event.id} transform={`translate(80 ${1120 + index * 85})`}><rect x="0" y="-26" width="5" height="42" rx="2" fill={SERIES_THEME_COLORS[event.series]} /><text x="24" y="-4" fill="#eeeeee" fontSize="26">{event.name.length > 23 ? `${event.name.slice(0, 22)}…` : event.name}</text><text x="24" y="30" fill="#999999" fontSize="20">{isConfirmed(event, session!) ? formatDateTime(session!.utc, BEIJING_TZ) : "时间待确认"} · {event.series}</text></g>)}{monthEvents.length > 7 && <text x="80" y="1780" fill="#777777" fontSize="22">另有 {monthEvents.length - 7} 场赛事，请查看网站</text>}</> : Array.from({ length: 12 }, (_, index) => <MonthGrid key={index} year={year} month={index} events={events} x={65 + index % 4 * 382} y={160 + Math.floor(index / 4) * 315} width={320} compact />)}<text x={phone ? 80 : 65} y={phone ? 1840 : 1150} fill="#777777" fontSize={phone ? 20 : 17}>北京时间 · F1 / WRC / FE · 官方赛程可能调整</text></svg>
}
export function EventShareArtwork({ event, now }: { event: RaceEvent; now: number }) {
  const session = event.sessions.filter(session => validTime(session) && Date.parse(session.utc) > now).sort((a, b) => Date.parse(a.utc) - Date.parse(b.utc))[0] ?? event.sessions.find(session => session.isMain)
  return <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1080 1350" role="img" aria-label={`${event.name}分享图`} style={{ fontFamily: "Arial, sans-serif" }}><rect width="1080" height="1350" fill="#111111" /><rect x="80" y="85" width="5" height="40" fill={SERIES_THEME_COLORS[event.series]} /><text x="110" y="115" fill="#b0b0b0" fontSize="26">{event.series} / 第 {event.round} 站</text>{Array.from({ length: Math.ceil(event.name.length / 11) }, (_, index) => event.name.slice(index * 11, (index + 1) * 11)).slice(0, 4).map((line, index) => <text key={index} x="80" y={330 + index * 86} fill="#f5f5f5" fontSize="68" fontWeight="600">{line}</text>)}<text x="80" y="760" fill="#b0b0b0" fontSize="28">{event.circuit.slice(0, 25)}</text><line x1="80" x2="1000" y1="840" y2="840" stroke="#333333" /><text x="80" y="940" fill="#f5f5f5" fontSize="35">{session && isConfirmed(event, session) ? formatDateTime(session.utc, BEIJING_TZ) : "时间待确认"}</text><text x="80" y="995" fill="#888888" fontSize="24">{session?.name || "场次待公布"} · 北京时间</text><text x="80" y="1240" fill="#dddddd" fontSize="28">赛道时刻</text><text x="1000" y="1240" textAnchor="end" fill="#888888" fontSize="21">下一场，一起看。</text></svg>
}
