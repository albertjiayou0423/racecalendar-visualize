import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/admin-auth"
import { getSql } from "@/lib/db"
import { CELL_LIMIT, HIDDEN_COLUMNS, INSPECTABLE_TABLES, isInspectableTable, pageNumber, quoteIdentifier } from "@/lib/database-browser"

export const dynamic = "force-dynamic"
const headers = { "Cache-Control": "private, no-store" }

export async function GET(request: Request) {
  const authErr = requireAdmin(request)
  if (authErr) return authErr
  const sql = getSql()
  if (!sql) return NextResponse.json({ ok: false, message: "数据库未配置，请检查 DATABASE_URL" }, { status: 503, headers })
  const params = new URL(request.url).searchParams
  const table = params.get("table")
  const page = pageNumber(params.get("page"), 1, 100000)
  const pageSize = pageNumber(params.get("pageSize"), 10, 50)
  if ((table !== null && !isInspectableTable(table)) || page === null || pageSize === null) {
    return NextResponse.json({ ok: false, message: "表名或分页参数无效" }, { status: 400, headers })
  }
  try {
    if (!table) {
      const rows = await sql`
        SELECT table_name AS name FROM information_schema.tables
        WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
        ORDER BY table_name
      `
      const existing = new Set(rows.map(row => row.name))
      const tables = INSPECTABLE_TABLES.map(name => ({ name, exists: existing.has(name) }))
      return NextResponse.json({ ok: true, tables }, { headers })
    }
    const columns = await sql`
      SELECT column_name AS name, data_type AS type, is_nullable AS nullable
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = ${table}
      ORDER BY ordinal_position
    `
    if (columns.length === 0) {
      return NextResponse.json({ ok: false, message: "该表尚未创建" }, { status: 404, headers })
    }
    const keys = await sql`
      SELECT k.column_name AS name FROM information_schema.table_constraints t
      JOIN information_schema.key_column_usage k
        ON t.constraint_name = k.constraint_name AND t.table_schema = k.table_schema AND t.table_name = k.table_name
      WHERE t.table_schema = 'public' AND t.table_name = ${table} AND t.constraint_type = 'PRIMARY KEY'
      ORDER BY k.ordinal_position
    `
    // Only allowlisted tables, quoted catalog identifiers, and parameterized values enter SQL.
    // Limit large JSON/text cells before transfer; subscription credentials never leave the server.
    const projection = columns.map(column => {
      const name = quoteIdentifier(column.name)
      return HIDDEN_COLUMNS.has(column.name)
        ? `'[已隐藏]' AS ${name}`
        : `CASE WHEN length(${name}::text) > ${CELL_LIMIT} THEN left(${name}::text, ${CELL_LIMIT}) || '…[内容已截断]' ELSE ${name}::text END AS ${name}`
    }).join(", ")
    const order = keys.length ? keys.map(key => `${quoteIdentifier(key.name)} DESC`).join(", ") : "ctid"
    const relation = `public.${quoteIdentifier(table)}`
    const [countRows, rows] = await Promise.all([
      sql.query(`SELECT count(*)::text AS count FROM ${relation}`),
      sql.query(`SELECT ${projection} FROM ${relation} ORDER BY ${order} LIMIT $1 OFFSET $2`, [pageSize, (page - 1) * pageSize]),
    ])
    return NextResponse.json({
      ok: true, table, columns, rows, page, pageSize,
      total: Number(countRows[0].count), cellLimit: CELL_LIMIT,
      fetchedAt: new Date().toISOString(),
    }, { headers })
  } catch (error) {
    console.error("Database inspection failed", error instanceof Error ? error.name : "unknown")
    return NextResponse.json({ ok: false, message: "数据库查询失败，请稍后重试" }, { status: 503, headers })
  }
}
