import { neon } from "@neondatabase/serverless"

const url = process.env.DATABASE_URL
if (!url) {
  console.log("DATABASE_URL not set")
  process.exit(1)
}

function cleanDbUrl(url) {
  try {
    const u = new URL(url)
    u.searchParams.delete("channel_binding")
    return u.toString()
  } catch {
    return url
  }
}

const sql = neon(cleanDbUrl(url))

console.log("=== 所有表 ===")
const tables = await sql`
  SELECT table_name 
  FROM information_schema.tables 
  WHERE table_schema = 'public'
  ORDER BY table_name
`
for (const t of tables) {
  console.log(`  ${t.table_name}`)
}

console.log("\n=== crawl_snapshots ===")
try {
  const rows = await sql`SELECT series, fetched_at, source FROM crawl_snapshots ORDER BY fetched_at DESC LIMIT 20`
  console.log(`  共 ${rows.length} 条记录`)
  for (const r of rows) {
    console.log(`  [${r.series}] ${r.fetched_at} source=${r.source}`)
  }
} catch (e) {
  console.log(`  表不存在或查询失败: ${e.message}`)
}

console.log("\n=== crawl_quota ===")
try {
  const rows = await sql`SELECT series, date, count FROM crawl_quota ORDER BY date DESC, series`
  console.log(`  共 ${rows.length} 条记录`)
  for (const r of rows) {
    console.log(`  [${r.series}] ${r.date} count=${r.count}`)
  }
} catch (e) {
  console.log(`  表不存在或查询失败: ${e.message}`)
}

console.log("\n=== event_overrides ===")
try {
  const rows = await sql`SELECT event_id, updated_at FROM event_overrides ORDER BY updated_at DESC LIMIT 10`
  console.log(`  共 ${rows.length} 条记录`)
  for (const r of rows) {
    console.log(`  [${r.event_id}] ${r.updated_at}`)
  }
} catch (e) {
  console.log(`  表不存在或查询失败: ${e.message}`)
}

console.log("\n=== predictions ===")
try {
  const rows = await sql`SELECT COUNT(*) as c FROM predictions`
  console.log(`  共 ${rows[0].c} 条记录`)
} catch (e) {
  console.log(`  表不存在或查询失败: ${e.message}`)
}

console.log("\n=== ai_usage ===")
try {
  const rows = await sql`SELECT date, count FROM ai_usage ORDER BY date DESC LIMIT 10`
  console.log(`  共 ${rows.length} 条记录`)
  for (const r of rows) {
    console.log(`  ${r.date} count=${r.count}`)
  }
} catch (e) {
  console.log(`  表不存在或查询失败: ${e.message}`)
}
