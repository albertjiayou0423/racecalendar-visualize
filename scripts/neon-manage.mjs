// /workspace/scripts/neon-manage.mjs
import { neon } from "@neondatabase/serverless";
const DB_URL = "postgresql://neondb_owner:npg_HO9vXaPcTk5y@ep-dawn-lab-at15yp1y-pooler.c-9.us-east-1.aws.neon.tech/neondb?channel_binding=require&sslmode=require";
const sql = neon(DB_URL);

async function main() {
  // 查所有 extensions 先看装了什么
  console.log("📦 PostgreSQL extensions:");
  try {
    const r = await sql`SELECT * FROM pg_extension`;
    console.table(r.map(x => ({ extname: x.extname, extversion: x.extversion, extrelocatable: x.extrelocatable })));
  } catch (e) { console.log(e.message); }

  // 查所有 schemas
  console.log("\n📁 All schemas:");
  try {
    const r = await sql`SELECT schema_name FROM information_schema.schemata ORDER BY schema_name`;
    console.table(r);
  } catch (e) { console.log(e.message); }

  // 所有包含 branch 字样的函数（任何 schema）
  console.log("\n🔎 含 'branch' 关键词的函数:");
  try {
    const r = await sql`
      SELECT n.nspname AS schema, p.proname AS func,
             pg_catalog.pg_get_function_arguments(p.oid) AS args
      FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE p.proname ILIKE '%branch%' OR n.nspname ILIKE '%branch%'
      ORDER BY 1, 2
    `;
    if (r.length === 0) console.log("(没有找到)"); else console.table(r);
  } catch (e) { console.log(e.message); }

  // 查任何可能存储分支信息的表/视图
  console.log("\n📋 含 'branch' 的表/视图:");
  try {
    const r = await sql`
      SELECT table_schema, table_name, table_type
      FROM information_schema.tables
      WHERE table_name ILIKE '%branch%' OR table_schema ILIKE '%branch%'
      ORDER BY 1, 2
    `;
    if (r.length === 0) console.log("(没有找到)"); else console.table(r);
  } catch (e) { console.log(e.message); }

  // 看是否有 neon_servers 这类内部表/视图
  console.log("\n🧠 含 neon 字样的表/视图:");
  try {
    const r = await sql`
      SELECT table_schema, table_name, table_type
      FROM information_schema.tables
      WHERE table_name ILIKE '%neon%' OR table_schema ILIKE '%neon%'
      ORDER BY 1, 2
    `;
    if (r.length === 0) console.log("(没有找到)"); else console.table(r);
  } catch (e) { console.log(e.message); }
}
main();
