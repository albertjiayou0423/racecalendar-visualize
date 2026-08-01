/**
 * 数据库备份脚本
 * 导出所有表数据为 JSON 格式
 * 使用: node scripts/backup-db.mjs
 */
import { neon } from "@neondatabase/serverless"
import fs from "fs"
import path from "path"

const DB_URL = process.env.DATABASE_URL || "postgresql://neondb_owner:npg_HO9vXaPcTk5y@ep-dawn-lab-at15yp1y-pooler.c-9.us-east-1.aws.neon.tech/neondb?channel_binding=require&sslmode=require"

const TABLES = [
  "predictions",
  "ai_usage",
  "push_subscriptions",
  "service_health_log",
  "crawl_snapshots",
  "crawl_quota",
  "event_overrides",
  "feedbacks",
]

async function backup() {
  console.log("📦 连接数据库...")
  const sql = neon(DB_URL)

  // 获取数据库版本
  const version = await sql`SELECT version()`
  console.log(`✅ 数据库连接成功!`)
  console.log(`   版本: ${version[0].version.split(",")[0]}`)

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-")
  const backupDir = path.join("/workspace", "backups")

  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true })
  }

  const allData = {}

  for (const table of TABLES) {
    try {
      // 使用 sql.query() 支持表名作为字符串参数
      const countResult = await sql.query(`SELECT COUNT(*) as cnt FROM ${table}`)
      const rowCount = Number(countResult[0]?.cnt || 0)

      if (rowCount === 0) {
        console.log(`  ⚠️  ${table}: 空表，跳过`)
        allData[table] = []
        continue
      }

      console.log(`  📊 ${table}: ${rowCount} 条数据，导出中...`)

      // 导出所有数据
      const data = await sql.query(`SELECT * FROM ${table} ORDER BY id`)
      allData[table] = data
      console.log(`  ✅ ${table}: ${data.length} 条已导出`)
    } catch (err) {
      console.log(`  ❌ ${table}: 导出失败 - ${err.message}`)
      allData[table] = { error: err.message }
    }
  }

  // 保存为 JSON
  const backupFile = path.join(backupDir, `db-backup-${timestamp}.json`)
  fs.writeFileSync(backupFile, JSON.stringify(allData, null, 2))
  console.log(`\n💾 备份已保存到: ${backupFile}`)

  // 统计
  let totalRows = 0
  for (const table of TABLES) {
    const data = allData[table]
    if (Array.isArray(data)) {
      totalRows += data.length
    }
  }
  console.log(`📈 总计导出: ${totalRows} 条数据`)

  // 显示各表数据量
  console.log("\n📊 各表数据详情:")
  for (const table of TABLES) {
    const data = allData[table]
    if (Array.isArray(data)) {
      console.log(`   ${table}: ${data.length} 条`)
    } else {
      console.log(`   ${table}: 空 (可能不存在)`)
    }
  }

  console.log("\n🎉 备份完成!")
}

backup().catch(console.error)
