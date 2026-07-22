import { neon } from "@neondatabase/serverless"

const url = process.env.DATABASE_URL
function cleanDbUrl(url) {
  try { const u = new URL(url); u.searchParams.delete("channel_binding"); return u.toString() } catch { return url }
}
const sql = neon(cleanDbUrl(url))

console.log("=== 最新 WRC 快照内容 ===")
const wrcRows = await sql`SELECT data, fetched_at FROM crawl_snapshots WHERE series = 'WRC' ORDER BY fetched_at DESC LIMIT 1`
if (wrcRows.length > 0) {
  const data = typeof wrcRows[0].data === "string" ? JSON.parse(wrcRows[0].data) : wrcRows[0].data
  console.log(`fetched_at: ${wrcRows[0].fetched_at}`)
  console.log(`ok: ${data.ok}`)
  console.log(`note: ${data.note}`)
  console.log(`dataSource: ${data.dataSource}`)
  console.log(`events count: ${data.events?.length || 0}`)
  for (const e of (data.events || []).slice(0, 3)) {
    const main = e.sessions?.[e.sessions.length - 1]
    console.log(`  ${e.name}: ${e.sessions?.length || 0} sessions, main=${main?.name || 'none'}, tentative=${e.tentative}`)
  }
} else {
  console.log("无 WRC 快照")
}

console.log("\n=== 最新 F1 快照内容 ===")
const f1Rows = await sql`SELECT data, fetched_at FROM crawl_snapshots WHERE series = 'F1' ORDER BY fetched_at DESC LIMIT 1`
if (f1Rows.length > 0) {
  const data = typeof f1Rows[0].data === "string" ? JSON.parse(f1Rows[0].data) : f1Rows[0].data
  console.log(`fetched_at: ${f1Rows[0].fetched_at}`)
  console.log(`ok: ${data.ok}`)
  console.log(`note: ${data.note}`)
  console.log(`events count: ${data.events?.length || 0}`)
}

console.log("\n=== 今日配额消耗明细 ===")
const quotaRows = await sql`SELECT series, count FROM crawl_quota WHERE date = '2026-07-22' ORDER BY series`
for (const r of quotaRows) {
  console.log(`  ${r.series}: ${r.count}/10`)
}
