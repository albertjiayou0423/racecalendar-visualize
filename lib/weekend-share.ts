import type { weekendSessions } from "./weekend"
type Row = ReturnType<typeof weekendSessions>[number]
const escape = (text: string) => text.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" }[c]!))
const text = (x: number, y: number, value: string, size = 28, fill = "#f5f1e9", weight = 500, extra = "") => `<text x="${x}" y="${y}" font-size="${size}" fill="${fill}" font-weight="${weight}" ${extra}>${escape(value)}</text>`
const cut = (value: string, max: number) => Array.from(value).length > max ? Array.from(value).slice(0, max).join("") + "…" : value
export const SHARE_ROWS_PER_PAGE = 8
export function weekendShareSvg(rows: Row[], title: string, page: number) {
  const pages = Math.max(1, Math.ceil(rows.length / SHARE_ROWS_PER_PAGE))
  const selected = rows.slice(page * SHARE_ROWS_PER_PAGE, (page + 1) * SHARE_ROWS_PER_PAGE)
  const colors = { F1: "#ff414b", WRC: "#51a7ff", FE: "#29cfad" }
  const blocks = selected.map((row, i) => {
    const y = 354 + i * 106
    const color = colors[row.event.series]
    const date = new Date(row.start + 8 * 3600000)
    const day = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"][date.getUTCDay()]
    const clock = row.estimated ? "待确认" : `${String(date.getUTCHours()).padStart(2, "0")}:${String(date.getUTCMinutes()).padStart(2, "0")}`
    return `<rect x="56" y="${y}" width="968" height="92" rx="16" fill="${row.session.isMain ? "#25252b" : "#1b1c20"}" stroke="${row.session.isMain ? "#66626a" : "#303137"}"/>
      <path d="M58 ${y + 20}V${y + 72}" stroke="${color}" stroke-width="4" stroke-linecap="round"/>
      ${text(84, y + 29, `${date.getUTCMonth() + 1}/${date.getUTCDate()} ${day}`, 18, "#a9a7ad")}
      ${text(84, y + 66, clock, row.estimated ? 26 : 34, "#f5f1e9", 700, 'font-family="Arial, sans-serif"')}
      <path d="M222 ${y + 19}V${y + 73}" stroke="#38393e"/>
      <rect x="248" y="${y + 16}" width="68" height="26" rx="7" fill="${color}" fill-opacity=".16"/>${text(282, y + 35, row.event.series, 16, color, 700, 'text-anchor="middle"')}
      ${text(331, y + 37, cut(row.event.name, 24), 25, "#f5f1e9", 650)}
      ${text(248, y + 70, cut(row.session.name, 35), 22, "#b9b5bf")}
      ${row.session.isMain ? `<circle cx="986" cy="${y + 46}" r="5" fill="${color}"/>` : ""}`
  }).join("")
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1440" viewBox="0 0 1080 1440"><defs>
    <linearGradient id="bg" x2="1" y2="1"><stop stop-color="#17181d"/><stop offset="1" stop-color="#0c0d10"/></linearGradient>
    <radialGradient id="glow"><stop stop-color="#ff414b" stop-opacity=".15"/><stop offset="1" stop-color="#ff414b" stop-opacity="0"/></radialGradient>
    <pattern id="grid" width="60" height="60" patternUnits="userSpaceOnUse"><path d="M60 0H0V60" fill="none" stroke="#fff" stroke-opacity=".024"/></pattern>
    </defs><rect width="1080" height="1440" fill="url(#bg)"/><rect width="1080" height="1440" fill="url(#grid)"/><ellipse cx="990" cy="90" rx="400" ry="300" fill="url(#glow)"/>
    <path d="M765 86 981 86Q1023 86 1010 122L975 212Q964 246 919 237L830 220Q788 212 809 179L851 120Q865 100 840 100H765" fill="none" stroke="#77737e" stroke-opacity=".15" stroke-width="12"/>
    <g font-family="Microsoft YaHei, PingFang SC, sans-serif">
      <path d="m56 55 10-20h9L65 55zm15 0 10-20h9L80 55zm15 0 10-20h9L95 55z" fill="#ff414b"/>
      ${text(118, 56, "赛道时刻", 27, "#f5f1e9", 700)}${text(1024, 54, "WEEKEND WATCHLIST", 15, "#a5a0ab", 500, 'text-anchor="end" letter-spacing="2"')}
      ${text(56, 167, "这个周末", 76, "#f5f1e9", 800)}${text(56, 256, "看什么比赛？", 76, "#f5f1e9", 800)}
      <rect x="58" y="290" width="5" height="25" rx="2" fill="#ff414b"/>${text(78, 310, `${title}  /  北京时间`, 25, "#c7c1ca")}
      ${text(1024, 310, `${rows.length} 场次 · ${page + 1}/${pages}`, 22, "#a5a0ab", 500, 'text-anchor="end"')}
      ${blocks}
      <path d="M56 1250H1024" stroke="#39383f"/>
      ${text(56, 1287, "F1", 19, colors.F1, 700)}${text(121, 1287, "WRC", 19, colors.WRC, 700)}${text(204, 1287, "FORMULA E", 19, colors.FE, 700)}
      ${text(1024, 1287, "你的周末观赛清单", 20, "#aaa3af", 500, 'text-anchor="end"')}
      ${text(56, 1339, "racecalendar-visualize.vercel.app", 27, "#f5f1e9", 600)}
      ${text(56, 1382, "赛程可能调整；待确认场次不展示具体时间，以官方信息为准。", 18, "#8f8995")}
    </g></svg>`
}
