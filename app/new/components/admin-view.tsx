"use client"

import { useCallback, useState } from "react"
import useSWR, { SWRConfig } from "swr"
import type { Series } from "@/lib/types"
import { SimplePageHeader, SimpleTabs, SimpleTable, DataState, SimpleSection } from "./data-ui"
import { SimpleFooter } from "./footer"

type AdminRequest = <T>(url: string, init?: RequestInit) => Promise<T>
type JsonRecord = Record<string, unknown>
type Override = { eventId: string; data: JsonRecord; updatedAt: string }
const adminTabs = [{ value: "status", label: "快照状态" }, { value: "crawl", label: "采集管理" }, { value: "overrides", label: "人工覆盖" }, { value: "preview", label: "数据预览" }, { value: "database", label: "数据库" }, { value: "feedback", label: "用户反馈" }] as const
const postBody = (value: unknown, method = "POST"): RequestInit => ({ method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(value) })
const displayCell = (value: unknown) => value === null ? "NULL" : typeof value === "object" ? JSON.stringify(value) : String(value ?? "—")

function AdminDatabase({ request }: { request: AdminRequest }) {
  const [table, setTable] = useState("")
  const [page, setPage] = useState(1)
  const list = useSWR<{ tables: { name: string; exists: boolean }[] }>("/api/admin/database", request, { revalidateOnFocus: false, shouldRetryOnError: false })
  const result = useSWR<{ columns: { name: string; type: string }[]; rows: Record<string, string | null>[]; total: number; pageSize: number }>(table ? `/api/admin/database?table=${encodeURIComponent(table)}&page=${page}&pageSize=10` : null, request, { revalidateOnFocus: false, shouldRetryOnError: false })
  return <SimpleSection title="数据库检查" description="只读查询。受保护字段由服务端隐藏，长内容按服务端上限截断。"><DataState loading={list.isLoading} error={list.error} retry={() => list.mutate()}><label className="s-form-label">业务表<select aria-label="数据库表" value={table} onChange={event => { setTable(event.target.value); setPage(1) }}><option value="">选择表</option>{list.data?.tables.map(item => <option key={item.name} value={item.name} disabled={!item.exists}>{item.name}{item.exists ? "" : "（未创建）"}</option>)}</select></label></DataState>{table && <DataState loading={result.isLoading} error={result.error} retry={() => result.mutate()}><SimpleTable caption={table} rows={result.data?.rows ?? []} rowKey={(_, index) => `${page}-${index}`} columns={result.data?.columns.map(column => ({ key: column.name, title: `${column.name} (${column.type})`, render: (row: Record<string, string | null>) => <details className="s-cell-detail"><summary>{String(row[column.name] ?? "NULL").slice(0, 70)}</summary><pre>{row[column.name] ?? "NULL"}</pre></details> })) ?? []} /><div className="s-between"><button className="s-button" disabled={page <= 1 || result.isLoading} onClick={() => setPage(value => value - 1)}>上一页</button><span className="s-note">第 {page} 页 · {result.data?.total ?? 0} 条</span><button className="s-button" disabled={result.isLoading || !result.data || page * 10 >= result.data.total} onClick={() => setPage(value => value + 1)}>下一页</button></div></DataState>}</SimpleSection>
}
function AdminOverrides({ request }: { request: AdminRequest }) {
  const { data, error, isLoading, mutate } = useSWR<{ data: Override[] }>("/api/admin/overrides", request, { revalidateOnFocus: false, shouldRetryOnError: false })
  const [eventId, setEventId] = useState("")
  const [json, setJson] = useState("{}")
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState("")
  async function save(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setMessage("")
    try {
      const parsed: unknown = JSON.parse(json)
      if (!parsed || Array.isArray(parsed) || typeof parsed !== "object") throw new Error("覆盖内容必须是 JSON 对象")
      await request("/api/admin/overrides", postBody({ eventId: eventId.trim(), data: parsed })); setMessage("覆盖已保存"); await mutate()
    } catch (error) { setMessage(error instanceof Error ? error.message : "保存失败") }
    finally { setBusy(false) }
  }
  async function remove(id: string) {
    if (busy || !window.confirm(`删除 ${id} 的人工覆盖？这不会删除官方快照。`)) return
    setBusy(true)
    try { await request("/api/admin/overrides", postBody({ eventId: id }, "DELETE")); await mutate(); setMessage("覆盖已删除") }
    catch (error) { setMessage(error instanceof Error ? error.message : "删除失败") }
    finally { setBusy(false) }
  }
  return <SimpleSection title="人工覆盖" description="顶层浅合并；sessions 等数组整体替换。修改前先查看现有覆盖和快照。"><DataState loading={isLoading} error={error} retry={() => mutate()}><SimpleTable caption="人工覆盖列表" rows={data?.data ?? []} rowKey={row => row.eventId} columns={[{ key: "id", title: "赛事", render: row => row.eventId }, { key: "time", title: "更新时间", render: row => row.updatedAt }, { key: "action", title: "操作", render: row => <div className="s-inline"><button className="s-link" disabled={busy} onClick={() => { setEventId(row.eventId); setJson(JSON.stringify(row.data, null, 2)); setMessage("") }}>编辑</button><button className="s-link" disabled={busy} onClick={() => remove(row.eventId)}>删除</button></div> }]} /></DataState><form className="s-form" onSubmit={save}><label>赛事 ID<input required value={eventId} onChange={event => setEventId(event.target.value)} placeholder="f1-2026-17" /></label><label>覆盖数据（JSON）<textarea aria-label="人工覆盖JSON" rows={9} spellCheck={false} value={json} onChange={event => setJson(event.target.value)} /></label><button type="submit" className="s-button" disabled={busy}>{busy ? "处理中…" : "保存覆盖"}</button></form><p role="status" className="s-note">{message}</p></SimpleSection>
}
function AdminFeedback({ request }: { request: AdminRequest }) {
  type Feedback = { id: number; type: string; title: string; description: string; email?: string; createdAt?: string; created_at?: string }
  const { data, error, isLoading, mutate } = useSWR<{ feedbacks: Feedback[] }>("/api/feedback", request, { revalidateOnFocus: false, shouldRetryOnError: false })
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState("")
  async function remove(id: number) {
    if (busy || !window.confirm("确定删除这条反馈？此操作不可恢复。")) return
    setBusy(true)
    try { await request("/api/feedback", postBody({ id }, "DELETE")); await mutate() } catch (error) { setMessage(error instanceof Error ? error.message : "删除失败") } finally { setBusy(false) }
  }
  return <SimpleSection title="用户反馈"><DataState loading={isLoading} error={error} empty={data?.feedbacks.length === 0} retry={() => mutate()}>{data?.feedbacks.map(item => <article key={item.id} className="s-feedback-item"><div className="s-between"><h3>{item.title}</h3><button className="s-link" disabled={busy} onClick={() => remove(item.id)}>删除</button></div><p className="s-note">{item.type} · {item.createdAt || item.created_at || ""}</p><p className="s-prose s-pre-line">{item.description}</p>{item.email && <p className="s-note">联系：{item.email}</p>}</article>)}</DataState><p role="status" className="s-note">{message}</p></SimpleSection>
}
function AdminReadPanel({ request, tab }: { request: AdminRequest; tab: "status" | "crawl" | "preview" }) {
  const [series, setSeries] = useState<Series>("F1")
  const [preview, setPreview] = useState<JsonRecord>()
  const [history, setHistory] = useState<JsonRecord[]>()
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState("")
  type Status = { services?: Record<string, { ok: boolean; eventCount: number; note: string }>; data?: Record<string, { lastFetch: string | null; quotaUsed: number; quotaLimit: number }> }
  const url = tab === "status" ? "/api/admin/status" : tab === "crawl" ? "/api/admin/crawl" : `/api/admin/snapshot?series=${series}`
  const { data, error, isLoading, mutate } = useSWR<Status & JsonRecord>(url, request, { revalidateOnFocus: false, shouldRetryOnError: false })
  async function run(action: "crawl" | "preview" | "history", target = series) {
    if (busy) return
    setBusy(true); setMessage("")
    try {
      if (action === "crawl") { const response = await request<JsonRecord>("/api/admin/crawl", { ...postBody({ series: target }), signal: AbortSignal.timeout(290000) }); setPreview(response); setMessage(`${target} 采集已完成`); await mutate() }
      else if (action === "history") { const response = await request<{ data: JsonRecord[] }>("/api/admin/health-history?hours=24"); setHistory(response.data) }
      else setPreview(await request(`/api/admin/preview?series=${target}`))
    } catch (error) { setMessage(error instanceof Error ? error.message : "操作失败") }
    finally { setBusy(false) }
  }
  return <SimpleSection title={tab === "status" ? "最近成功快照" : tab === "crawl" ? "采集与配额" : "快照与合并预览"} description={tab === "status" ? "读取已持久化数据，不触发上游采集。" : tab === "crawl" ? "只有点击采集才会请求上游并保存成功结果。失败时保留已有快照。" : "预览读取原有接口，人工覆盖遵循现有合并规则。"}>{tab === "preview" && <select aria-label="预览系列" value={series} onChange={event => { setSeries(event.target.value as Series); setPreview(undefined) }}>{["F1", "WRC", "FE"].map(value => <option key={value}>{value}</option>)}</select>}<DataState loading={isLoading} error={error} retry={() => mutate()}>{tab === "status" ? <div className="s-admin-status">{Object.entries(data?.services ?? {}).map(([key, service]) => <article key={key}><div className="s-between"><h3>{key.toUpperCase()}</h3><span>{service.ok ? "有成功快照" : "暂无快照"}</span></div><strong>{service.eventCount}<small> 场赛事</small></strong><p className="s-note">{service.note}</p></article>)}</div> : tab === "crawl" ? Object.entries(data?.data ?? {}).map(([key, value]) => <div key={key} className="s-crawl-row"><div><strong>{key.toUpperCase()}</strong><p className="s-note">最近采集：{value.lastFetch || "暂无"}<br />今日用量：{value.quotaUsed} / {value.quotaLimit}</p></div><button className="s-button" disabled={busy} onClick={() => run("crawl", key.toUpperCase() as Series)}>{busy ? "处理中…" : "采集并保存"}</button></div>) : <pre className="s-json">{JSON.stringify(data, null, 2)}</pre>}</DataState><div className="s-inline"><button className="s-link" disabled={busy} onClick={() => mutate()}>刷新读取</button>{tab === "status" && <button className="s-link" disabled={busy} onClick={() => run("history")}>查看 24 小时记录</button>}{tab === "preview" && <button className="s-button" disabled={busy} onClick={() => run("preview")}>读取合并预览</button>}</div>{preview && <pre className="s-json">{JSON.stringify(preview, null, 2)}</pre>}{history && <SimpleTable<JsonRecord> caption="状态记录" rows={history} rowKey={(_, index) => String(index)} columns={["checked_at", "service", "ok", "event_count", "note"].map(key => ({ key, title: key, render: row => displayCell(row[key]) }))} />}<p className="s-note" role="status">{message}</p></SimpleSection>
}
function PrivateDashboard({ request }: { request: AdminRequest }) {
  const [tab, setTab] = useState<typeof adminTabs[number]["value"]>("status")
  return <><SimpleTabs label="管理功能" value={tab} options={adminTabs} onChange={setTab} />{tab === "database" ? <AdminDatabase request={request} /> : tab === "overrides" ? <AdminOverrides request={request} /> : tab === "feedback" ? <AdminFeedback request={request} /> : <AdminReadPanel key={tab} tab={tab} request={request} />}</>
}
export function SimpleAdminView() {
  const [authenticated, setAuthenticated] = useState<boolean | null>(null)
  const [password, setPassword] = useState("")
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState("")
  const request = useCallback(async <T,>(url: string, init?: RequestInit): Promise<T> => {
    const response = await fetch(url, { ...init, cache: "no-store", signal: init?.signal ?? AbortSignal.timeout(20000) })
    const payload = await response.json().catch(() => ({}))
    if ((response.status === 401 || response.status === 403) && url !== "/api/admin/auth") { setAuthenticated(false); setPassword(""); throw new Error("管理员会话已过期，请重新登录") }
    if (!response.ok || payload.ok === false) throw new Error(payload.message || payload.error || "操作失败，请重试")
    return payload as T
  }, [])
  const auth = useSWR<{ authenticated: boolean }>("new-admin-session", () => request("/api/admin/auth"), { revalidateOnFocus: true, shouldRetryOnError: false, onSuccess: data => setAuthenticated(data.authenticated) })
  async function login(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setMessage("")
    try { await request("/api/admin/auth", postBody({ password })); setPassword(""); setAuthenticated(true); await auth.mutate({ authenticated: true }, false) }
    catch (error) { setMessage(error instanceof Error ? error.message : "登录失败") }
    finally { setBusy(false) }
  }
  async function logout() {
    setBusy(true)
    try { await request("/api/admin/auth", { method: "DELETE" }); setAuthenticated(false); await auth.mutate({ authenticated: false }, false) }
    catch (error) { setMessage(error instanceof Error ? error.message : "退出失败") }
    finally { setBusy(false) }
  }
  return <main><SimplePageHeader title="管理后台" subtitle="复用受保护的管理接口，私有数据不写浏览器缓存" action={authenticated ? <button className="s-link" disabled={busy} onClick={logout}>退出</button> : undefined} />{authenticated === null && !auth.error ? <DataState loading>{null}</DataState> : !authenticated ? <form className="s-form s-login" onSubmit={login}><h2>管理员登录</h2><label>密码<input type="password" autoComplete="current-password" value={password} required onChange={event => setPassword(event.target.value)} /></label><button className="s-button" disabled={busy}>{busy ? "验证中…" : "登录"}</button><p role="status" className="s-note">{message || auth.error?.message || "使用原有管理员密码，会话有效期保持不变。"}</p></form> : <SWRConfig value={{ provider: () => new Map() }}><PrivateDashboard request={request} /></SWRConfig>}<p role="status" className="s-note">{authenticated ? message : ""}</p><SimpleFooter /></main>
}
