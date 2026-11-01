"use client"

import { useEffect, useRef, useState } from "react"
import { Database, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"

type TableInfo = { name: string; exists: boolean }
type Column = { name: string; type: string; nullable: string }
type TableData = {
  table: string; columns: Column[]; rows: Record<string, string | null>[]
  total: number; page: number; pageSize: number; fetchedAt: string; cellLimit: number
}

const LABELS: Record<string, string> = {
  crawl_snapshots: "抓取快照", crawl_quota: "抓取配额", event_overrides: "人工覆盖",
  service_health_log: "服务检查记录", predictions: "用户投票", ai_usage: "AI 用量",
  feedbacks: "用户反馈", push_subscriptions: "推送订阅",
  client_crawl_jobs: "客户端采集任务与补缺记录",
  notification_health_daily: "邮件通知 · 每日健康采样",
  notification_incidents: "邮件通知 · 故障去重状态",
  notification_monthly_reports: "邮件通知 · 月报发送状态",
  notification_client_error_windows: "邮件通知 · 浏览器故障计数",
  notification_email_log: "邮件通知 · Resend 接受记录",
}

function pretty(value: string | null): string {
  if (value === null) return "NULL"
  try { return JSON.stringify(JSON.parse(value), null, 2) } catch { return value }
}

export function DatabaseInspector({ onUnauthorized }: { onUnauthorized: () => void }) {
  const [tables, setTables] = useState<TableInfo[]>([])
  const [table, setTable] = useState("")
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [data, setData] = useState<TableData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [revision, setRevision] = useState(0)
  const [selected, setSelected] = useState<{ name: string; value: string | null } | null>(null)
  const unauthorized = useRef(onUnauthorized)
  useEffect(() => { unauthorized.current = onUnauthorized }, [onUnauthorized])

  useEffect(() => {
    const controller = new AbortController()
    async function load() {
      setLoading(true)
      setError("")
      setData(null)
      setSelected(null)
      try {
        const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) })
        if (table) params.set("table", table)
        const res = await fetch(`/api/admin/database?${params}`, { cache: "no-store", signal: controller.signal })
        if (res.status === 401) { unauthorized.current(); return }
        const body = await res.json()
        if (!res.ok || !body.ok) throw new Error(body.message || "读取失败")
        if (!controller.signal.aborted) {
          if (!table) {
            setTables(body.tables)
            setTable(body.tables.find((item: TableInfo) => item.exists)?.name || "")
          } else {
            setData(body)
          }
        }
      } catch (err) {
        if (!controller.signal.aborted) setError(err instanceof Error ? err.message : "读取失败")
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }
    void load()
    return () => controller.abort()
  }, [table, page, pageSize, revision])

  const pages = data ? Math.max(1, Math.ceil(data.total / pageSize)) : 1
  return (
    <section className="space-y-4" aria-label="数据库检查">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 font-medium"><Database className="size-4" />数据库检查</h2>
          <p className="mt-1 text-xs text-muted-foreground">查看表结构与记录，点击单元格展开完整内容。此页面只提供查询。</p>
        </div>
        <Button size="sm" variant="outline" disabled={loading} onClick={() => setRevision(value => value + 1)}>
          <RefreshCw className="mr-2 size-4" />刷新
        </Button>
      </div>
      <div className="grid grid-cols-1 gap-3 rounded-xl border border-border bg-card p-4 sm:grid-cols-2">
        <label className="space-y-1 text-sm">数据表
          <select className="block w-full rounded border border-input bg-background p-2" value={table} disabled={loading || !tables.length}
            onChange={event => { setTable(event.target.value); setPage(1) }}>
            <option value="" disabled>请选择数据表</option>
            {tables.map(item => <option key={item.name} value={item.name} disabled={!item.exists}>
              {LABELS[item.name]} · {item.name}{!item.exists ? "（未创建）" : ""}
            </option>)}
          </select>
        </label>
        <label className="space-y-1 text-sm">每页记录数
          <select className="block w-full rounded border border-input bg-background p-2" value={pageSize} disabled={loading}
            onChange={event => { setPageSize(Number(event.target.value)); setPage(1) }}>
            {[10, 25, 50].map(size => <option key={size} value={size}>{size} 条</option>)}
          </select>
        </label>
      </div>
      {error && <div role="alert" className="rounded-lg border border-destructive/30 p-4 text-sm text-destructive">{error}</div>}
      {loading && <p role="status" className="py-8 text-center text-sm text-muted-foreground">正在读取数据库…</p>}
      {!loading && !error && !tables.some(item => item.exists) && <p className="py-8 text-center text-sm text-muted-foreground">数据库中尚无应用业务表。</p>}
      {data && <>
        <div className="flex flex-wrap justify-between gap-2 text-xs text-muted-foreground">
          <span>{data.table} · 共 {data.total} 条记录</span>
          <span>读取时间：{new Date(data.fetchedAt).toLocaleString("zh-CN")}</span>
        </div>
        <details className="rounded-xl border border-border bg-card p-4">
          <summary className="cursor-pointer text-sm font-medium">表结构（{data.columns.length} 个字段）</summary>
          <ul className="mt-3 space-y-2 text-xs">{data.columns.map(column => <li key={column.name} className="flex flex-wrap gap-2">
            <code>{column.name}</code><span className="text-muted-foreground">{column.type} · {column.nullable === "YES" ? "可空" : "不可空"}</span>
          </li>)}</ul>
        </details>
        <div className="overflow-x-auto rounded-xl border border-border bg-card">
          <table className="w-full text-left text-xs">
            <caption className="sr-only">{data.table} 第 {page} 页记录</caption>
            <thead className="bg-secondary"><tr>{data.columns.map(column => <th key={column.name} scope="col" className="whitespace-nowrap p-3 font-medium">{column.name}</th>)}</tr></thead>
            <tbody>{data.rows.map((row, index) => <tr key={`${page}-${index}`} className="border-t border-border">
              {data.columns.map(column => <td key={column.name} className="p-3 align-top">
                <button className="block max-w-56 truncate rounded text-left hover:text-primary focus-visible:outline focus-visible:outline-primary"
                  onClick={() => setSelected({ name: column.name, value: row[column.name] })} aria-label={`展开第 ${index + 1} 条记录的 ${column.name}`}>
                  {row[column.name] === null ? <span className="italic text-muted-foreground">NULL</span> : row[column.name] || "（空字符串）"}
                </button>
              </td>)}
            </tr>)}</tbody>
          </table>
          {!data.rows.length && <p className="p-8 text-center text-sm text-muted-foreground">当前页没有记录。</p>}
        </div>
        <div className="flex items-center justify-between gap-2 text-sm">
          <Button size="sm" variant="outline" disabled={loading || page <= 1} onClick={() => setPage(value => value - 1)}>上一页</Button>
          <span>第 {page} / {pages} 页</span>
          <Button size="sm" variant="outline" disabled={loading || page >= pages} onClick={() => setPage(value => value + 1)}>下一页</Button>
        </div>
        <p className="text-xs text-muted-foreground">单元格最多显示 {data.cellLimit.toLocaleString()} 字符，超出时标记截断。推送订阅的凭据与地址已隐藏。</p>
      </>}
      {selected && <div className="rounded-xl border border-border bg-card p-4">
        <div className="mb-3 flex items-center justify-between gap-3"><h3 className="text-sm font-medium">{selected.name}</h3>
          <Button size="sm" variant="ghost" onClick={() => setSelected(null)}>收起</Button>
        </div>
        <pre className="max-h-96 overflow-auto whitespace-pre-wrap break-all text-xs">{pretty(selected.value)}</pre>
      </div>}
    </section>
  )
}
