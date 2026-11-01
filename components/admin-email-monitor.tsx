"use client"

import { useCallback, useEffect, useState } from "react"
import { Activity, AlertTriangle, Check, Clock3, Mail, RefreshCw, Send } from "lucide-react"
import { Button } from "@/components/ui/button"

type MonitorData = {
  config: { apiKey: boolean; from: boolean; recipient: boolean }
  health: { day: string; series: string; check_count: number; failure_count: number }[]
  incidents: { incident_key: string; last_sent_at: string }[]
  monthly: { month: string; sent_at: string }[]
  clientErrors: { kind: string; report_count: number; latest_at: string }[]
  emails: { category: string; accepted_at: string }[]
  fetchedAt: string
}

const CATEGORY_LABELS: Record<string, string> = {
  "schedule-incident": "全系列赛历异常",
  "database-incident": "数据库异常",
  "client-incident": "浏览器加载异常",
  "monthly-report": "月度摘要",
  "admin-test": "管理员测试",
}

const INCIDENT_LABELS: Record<string, string> = {
  "all-schedule-series-unavailable": "F1、FE、WRC 同时不可用",
  "client-schedule-load-failures": "多次浏览器赛历加载失败",
}

function formatTime(value: string | null | undefined) {
  return value ? new Date(value).toLocaleString("zh-CN") : "暂无记录"
}

export function AdminEmailMonitor({ onUnauthorized }: { onUnauthorized: () => void }) {
  const [data, setData] = useState<MonitorData | null>(null)
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState("")
  const [notice, setNotice] = useState("")

  const refresh = useCallback(async () => {
    setLoading(true)
    setError("")
    try {
      const response = await fetch("/api/admin/notifications", { cache: "no-store" })
      if (response.status === 401) { onUnauthorized(); return }
      const body = await response.json()
      if (!response.ok || !body.ok) throw new Error(body.message || "读取邮件监控失败")
      setData(body.data)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "读取邮件监控失败")
    } finally {
      setLoading(false)
    }
  }, [onUnauthorized])

  useEffect(() => { void refresh() }, [refresh])

  const sendTest = async () => {
    setSending(true)
    setError("")
    setNotice("")
    try {
      const response = await fetch("/api/admin/notifications", { method: "POST" })
      if (response.status === 401) { onUnauthorized(); return }
      const body = await response.json()
      if (!response.ok || !body.ok) throw new Error(body.message || "测试邮件发送失败")
      setNotice(body.message)
      await refresh()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "测试邮件发送失败")
    } finally {
      setSending(false)
    }
  }

  const totals = new Map<string, { checks: number; failures: number }>()
  for (const row of data?.health ?? []) {
    const total = totals.get(row.series) ?? { checks: 0, failures: 0 }
    total.checks += Number(row.check_count)
    total.failures += Number(row.failure_count)
    totals.set(row.series, total)
  }

  const configured = data && Object.values(data.config).every(Boolean)
  return (
    <section className="space-y-4" aria-label="邮件监控">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 font-medium"><Mail className="size-4" />邮件通知</h2>
          <p className="mt-1 text-xs text-muted-foreground">检查 Resend 配置、事件记录，并向已配置收件地址发送测试邮件。</p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => void refresh()} disabled={loading}>
            <RefreshCw className={`mr-2 size-4 ${loading ? "animate-spin" : ""}`} />刷新
          </Button>
          <Button size="sm" onClick={() => void sendTest()} disabled={sending || loading || !configured}>
            <Send className="mr-2 size-4" />{sending ? "发送中…" : "发送测试邮件"}
          </Button>
        </div>
      </div>

      {error && <div role="alert" className="rounded-lg border border-destructive/30 p-3 text-sm text-destructive">{error}</div>}
      {notice && <div role="status" className="rounded-lg border border-emerald-500/30 p-3 text-sm text-emerald-600">{notice}</div>}
      {loading && !data && <p role="status" className="py-8 text-center text-sm text-muted-foreground">正在读取邮件状态…</p>}

      {data && <>
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="flex items-center gap-2 text-sm font-medium">
              {configured ? <Check className="size-4 text-emerald-500" /> : <AlertTriangle className="size-4 text-amber-500" />}
              {configured ? "Resend 配置齐全" : "Resend 配置不完整"}
            </p>
            <span className="text-xs text-muted-foreground">状态检查：{formatTime(data.fetchedAt)}</span>
          </div>
          <div className="mt-3 grid gap-2 text-xs sm:grid-cols-3">
            {([["apiKey", "API Key"], ["from", "发件地址"], ["recipient", "收件地址"]] as const).map(([key, label]) => (
              <div key={key} className="flex items-center gap-2 rounded-lg bg-secondary/60 px-3 py-2">
                <span className={`size-1.5 rounded-full ${data.config[key] ? "bg-emerald-500" : "bg-destructive"}`} />
                {label} · {data.config[key] ? "已配置" : "缺失"}
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs text-muted-foreground">测试邮件会发送到服务器配置的收件地址；页面不会读取或显示邮箱地址和密钥。每分钟最多发送一次测试邮件。</p>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          {["F1", "FE", "WRC"].map(series => {
            const total = totals.get(series) ?? { checks: 0, failures: 0 }
            return <div key={series} className="rounded-xl border border-border p-4">
              <div className="flex items-center gap-2 text-sm font-medium"><Activity className="size-4 text-muted-foreground" />{series} · 近 30 天采样</div>
              <p className="mt-2 text-sm">{total.checks} 次检查</p>
              <p className="text-xs text-muted-foreground">不可用 {total.failures} 次</p>
            </div>
          })}
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-xl border border-border bg-card p-4">
            <h3 className="flex items-center gap-2 text-sm font-medium"><Clock3 className="size-4" />最近发送记录</h3>
            {data.emails.length ? <ul className="mt-3 space-y-2">
              {data.emails.map((item, index) => <li key={`${item.category}-${item.accepted_at}-${index}`} className="flex justify-between gap-3 border-t border-border pt-2 text-xs">
                <span>{CATEGORY_LABELS[item.category] ?? item.category} · Resend 已接受</span><time className="shrink-0 text-muted-foreground">{formatTime(item.accepted_at)}</time>
              </li>)}
            </ul> : <p className="mt-3 text-xs text-muted-foreground">还没有邮件发送记录。</p>}
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <h3 className="text-sm font-medium">通知与月报</h3>
            <ul className="mt-3 space-y-2">
              {data.incidents.map(item => <li key={item.incident_key} className="flex justify-between gap-3 border-t border-border pt-2 text-xs">
                <span>{INCIDENT_LABELS[item.incident_key] ?? item.incident_key}</span><time className="shrink-0 text-muted-foreground">{formatTime(item.last_sent_at)}</time>
              </li>)}
              {data.monthly.map(item => <li key={item.month} className="flex justify-between gap-3 border-t border-border pt-2 text-xs">
                <span>{item.month} 月报</span><time className="shrink-0 text-muted-foreground">{formatTime(item.sent_at)}</time>
              </li>)}
              {!data.incidents.length && !data.monthly.length && <li className="text-xs text-muted-foreground">暂无通知或月报记录。</li>}
            </ul>
            {data.clientErrors.map(item => <p key={item.kind} className="mt-3 text-xs text-amber-600">近 24 小时浏览器赛历加载失败报告：{Number(item.report_count)} 次，最近 {formatTime(item.latest_at)}</p>)}
          </div>
        </div>
        <p className="text-xs text-muted-foreground">“Resend 已接受”表示服务商接受了发送请求，不等同于邮件已送达或进入收件箱。健康数据是用户访问时的采样，不是持续探活。</p>
      </>}
    </section>
  )
}
