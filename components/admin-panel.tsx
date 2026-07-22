"use client"

import { useState, useEffect, useCallback } from "react"
import {
  Activity, AlertCircle, CheckCircle, ChevronDown, ChevronRight, Clock,
  Database, Edit3, Eye, Lock, LogOut, MessageSquare, Play, RefreshCw, Save, Server,
  Trash2, X, Zap
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { Series } from "@/lib/types"

// ─── 类型 ───────────────────────────────────────────────

interface ServiceStatus {
  ok: boolean
  eventCount: number
  note: string | undefined
  status: "success" | "error"
}

interface StatusResponse {
  status: string
  timestamp: string
  services: {
    f1: ServiceStatus
    fe: ServiceStatus
    wrc: ServiceStatus
  }
}

interface CrawlStatus {
  lastFetch: string | null
  quotaUsed: number
  quotaLimit: number
}

interface Override {
  eventId: string
  data: Record<string, any>
  updatedAt: string
}

type TabId = "status" | "crawl" | "overrides" | "preview" | "feedback"

// ─── 常量 ───────────────────────────────────────────────

const SERVICE_LABELS: Record<string, { name: string; color: string }> = {
  f1: { name: "F1", color: "#00D2BE" },
  fe: { name: "FE", color: "#FFD500" },
  wrc: { name: "WRC", color: "#E4002B" },
}

const TABS: { id: TabId; label: string; icon: typeof Server }[] = [
  { id: "status", label: "服务状态", icon: Server },
  { id: "crawl", label: "爬虫管理", icon: Zap },
  { id: "overrides", label: "数据覆盖", icon: Database },
  { id: "preview", label: "数据预览", icon: Eye },
  { id: "feedback", label: "用户建议", icon: MessageSquare },
]

const OVERRIDABLE_FIELDS = [
  { key: "highlights.track", label: "看点 · 赛道特点", type: "text" },
  { key: "highlights.championship", label: "看点 · 积分形势", type: "text" },
  { key: "highlights.drivers", label: "看点 · 关注车手", type: "text" },
  { key: "broadcaster.name", label: "转播方名称", type: "text" },
  { key: "broadcaster.note", label: "转播说明", type: "text" },
  { key: "broadcaster.url", label: "转播链接", type: "text" },
  { key: "broadcaster.confirmed", label: "转播已确认", type: "boolean" },
  { key: "broadcastCheckedAt", label: "直播核验时间", type: "text" },
  { key: "extraInfo", label: "额外信息 (JSON)", type: "json" },
]

// ─── 工具 ───────────────────────────────────────────────

function setNestedValue(obj: Record<string, any>, path: string, value: any) {
  const keys = path.split(".")
  let current = obj
  for (let i = 0; i < keys.length - 1; i++) {
    if (!current[keys[i]] || typeof current[keys[i]] !== "object") {
      current[keys[i]] = {}
    }
    current = current[keys[i]]
  }
  current[keys[keys.length - 1]] = value
}

function getNestedValue(obj: Record<string, any>, path: string): any {
  const keys = path.split(".")
  let current = obj
  for (const key of keys) {
    if (!current || typeof current !== "object") return undefined
    current = current[key]
  }
  return current
}

function formatTime(iso: string | null): string {
  if (!iso) return "—"
  return new Date(iso).toLocaleString("zh-CN")
}

// ─── 主组件 ─────────────────────────────────────────────

export function AdminPanel() {
  const [authenticated, setAuthenticated] = useState(false)
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [activeTab, setActiveTab] = useState<TabId>("status")
  const [status, setStatus] = useState<StatusResponse | null>(null)
  const [loading, setLoading] = useState(false)

  // 爬虫管理状态
  const [crawlStatus, setCrawlStatus] = useState<Record<string, CrawlStatus> | null>(null)
  const [crawling, setCrawling] = useState<Series | null>(null)

  // 覆盖管理状态
  const [overrides, setOverrides] = useState<Override[]>([])
  const [editingOverride, setEditingOverride] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<Record<string, any>>({})
  const [newEventId, setNewEventId] = useState("")
  const [saving, setSaving] = useState(false)

  // 预览状态
  const [previewSeries, setPreviewSeries] = useState<Series>("F1")
  const [previewData, setPreviewData] = useState<any>(null)
  const [previewLoading, setPreviewLoading] = useState(false)

  // 快照状态
  const [snapshotData, setSnapshotData] = useState<any>(null)
  const [snapshotLoading, setSnapshotLoading] = useState(false)

  // 反馈状态
  const [feedbacks, setFeedbacks] = useState<any[]>([])
  const [feedbackLoading, setFeedbackLoading] = useState(false)

  useEffect(() => {
    checkAuth()
  }, [])

  const checkAuth = async () => {
    try {
      const res = await fetch("/api/admin/auth")
      const data = await res.json()
      setAuthenticated(data.authenticated)
    } catch {}
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    try {
      const res = await fetch("/api/admin/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      })
      const data = await res.json()
      if (data.ok) {
        setAuthenticated(true)
        setPassword("")
      } else {
        setError(data.message)
      }
    } catch {
      setError("登录失败")
    }
  }

  const handleLogout = () => {
    document.cookie = "admin_auth=; max-age=0; path=/"
    setAuthenticated(false)
    setStatus(null)
    setCrawlStatus(null)
    setOverrides([])
    setPreviewData(null)
    setSnapshotData(null)
  }

  // 统一处理 API 响应，401 时自动登出
  const handleApiResponse = async (res: Response) => {
    if (res.status === 401) {
      handleLogout()
      throw new Error("登录已过期，请重新登录")
    }
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      throw new Error(data.message || `请求失败 (${res.status})`)
    }
    return res.json()
  }

  // ─── 服务状态 ─────────────────────────────────────────

  const fetchStatus = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/admin/status")
      const data = await res.json()
      setStatus(data)
    } catch (e) {
      console.error("Failed to fetch status:", e)
    } finally {
      setLoading(false)
    }
  }, [])

  // ─── 爬虫管理 ─────────────────────────────────────────

  const fetchCrawlStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/crawl")
      const data = await handleApiResponse(res)
      setCrawlStatus(data.data)
    } catch (e) {
      console.error("Failed to fetch crawl status:", e)
      setCrawlStatus(null)
    }
  }, [])

  const triggerCrawl = async (series: Series) => {
    setCrawling(series)
    try {
      const res = await fetch("/api/admin/crawl", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ series }),
      })
      const data = await handleApiResponse(res)
      alert(`${series} 爬取成功：${data.data.eventCount} 场赛事`)
    } catch (e) {
      alert(e instanceof Error ? e.message : "爬取请求失败")
    } finally {
      setCrawling(null)
      fetchCrawlStatus()
    }
  }

  // ─── 覆盖管理 ─────────────────────────────────────────

  const fetchOverrides = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/overrides")
      const data = await handleApiResponse(res)
      setOverrides(data.data ?? [])
    } catch (e) {
      console.error("Failed to fetch overrides:", e)
      setOverrides([])
    }
  }, [])

  const startEditOverride = (eventId: string, existingData?: Record<string, any>) => {
    setEditingOverride(eventId)
    setEditForm(existingData ?? {})
  }

  const saveOverride = async () => {
    const eventId = editingOverride === "__new__" ? newEventId : editingOverride
    if (!eventId) return alert("请输入赛事 ID")

    setSaving(true)
    try {
      const res = await fetch("/api/admin/overrides", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId, data: editForm }),
      })
      await handleApiResponse(res)
      setEditingOverride(null)
      setEditForm({})
      setNewEventId("")
      fetchOverrides()
    } catch (e) {
      alert(e instanceof Error ? e.message : "保存请求失败")
    } finally {
      setSaving(false)
    }
  }

  const deleteOverride = async (eventId: string) => {
    if (!confirm(`确定删除 ${eventId} 的覆盖数据？`)) return
    try {
      const res = await fetch("/api/admin/overrides", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId }),
      })
      await handleApiResponse(res)
      fetchOverrides()
    } catch (e) {
      alert(e instanceof Error ? e.message : "删除失败")
    }
  }

  // ─── 数据预览 ─────────────────────────────────────────

  const fetchPreview = useCallback(async (series: Series) => {
    setPreviewLoading(true)
    try {
      const res = await fetch(`/api/admin/preview?series=${series}`)
      const data = await handleApiResponse(res)
      setPreviewData(data.data)
    } catch (e) {
      console.error("Failed to fetch preview:", e)
      setPreviewData(null)
    } finally {
      setPreviewLoading(false)
    }
  }, [])

  const fetchSnapshot = async (series: Series) => {
    setSnapshotLoading(true)
    try {
      const res = await fetch(`/api/admin/snapshot?series=${series}`)
      const data = await handleApiResponse(res)
      setSnapshotData(data.data)
    } catch (e) {
      console.error("Failed to fetch snapshot:", e)
      setSnapshotData(null)
    } finally {
      setSnapshotLoading(false)
    }
  }

  const fetchFeedbacks = useCallback(async () => {
    setFeedbackLoading(true)
    try {
      const res = await fetch("/api/feedback")
      const data = await handleApiResponse(res)
      setFeedbacks(data.feedbacks ?? [])
    } catch (e) {
      console.error("Failed to fetch feedbacks:", e)
      setFeedbacks([])
    } finally {
      setFeedbackLoading(false)
    }
  }, [])

  const deleteFeedback = async (id: number) => {
    if (!confirm("确定删除这条反馈？")) return
    try {
      const res = await fetch("/api/feedback", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      })
      await handleApiResponse(res)
      fetchFeedbacks()
    } catch (e) {
      alert(e instanceof Error ? e.message : "删除失败")
    }
  }

  // Tab 切换时加载数据
  useEffect(() => {
    if (!authenticated) return
    if (activeTab === "status") fetchStatus()
    if (activeTab === "crawl") fetchCrawlStatus()
    if (activeTab === "overrides") fetchOverrides()
    if (activeTab === "preview") fetchPreview(previewSeries)
    if (activeTab === "feedback") fetchFeedbacks()
  }, [activeTab, authenticated, fetchStatus, fetchCrawlStatus, fetchOverrides, fetchPreview, previewSeries, fetchFeedbacks])

  // ─── 登录页 ─────────────────────────────────────────

  if (!authenticated) {
    return (
      <div className="flex min-h-dvh items-center justify-center px-4">
        <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-lg">
          <div className="flex flex-col items-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
              <Lock className="size-6 text-primary" />
            </div>
            <h1 className="mt-4 text-xl font-bold">后台管理</h1>
            <p className="mt-1 text-sm text-muted-foreground">请输入管理员密码</p>
          </div>
          <form onSubmit={handleLogin} className="mt-6">
            <div className="space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium">密码</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="flex w-full rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-primary focus:ring-1 focus:ring-primary"
                  placeholder="输入密码"
                  autoFocus
                />
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <Button type="submit" className="w-full">登录</Button>
            </div>
          </form>
        </div>
      </div>
    )
  }

  // ─── 主界面 ─────────────────────────────────────────

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-4 px-4 py-6">
      {/* 顶部 */}
      <header className="flex items-center justify-between border-b border-border pb-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
            <Server className="size-5 text-primary" />
          </div>
          <div>
            <h1 className="text-lg font-bold">后台管理</h1>
            <p className="text-xs text-muted-foreground">赛道时刻 · 管理面板</p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={handleLogout} className="gap-2">
          <LogOut className="size-4" />
          退出
        </Button>
      </header>

      {/* Tab 导航 */}
      <nav className="flex gap-1 overflow-x-auto rounded-lg border border-border bg-card p-1">
        {TABS.map((tab) => {
          const Icon = tab.icon
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium transition-colors whitespace-nowrap",
                activeTab === tab.id
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-secondary hover:text-foreground"
              )}
            >
              <Icon className="size-4" />
              {tab.label}
            </button>
          )
        })}
      </nav>

      {/* Tab 内容 */}
      <div className="min-h-[60vh]">
        {activeTab === "status" && (
          <StatusTab status={status} loading={loading} onRefresh={fetchStatus} />
        )}
        {activeTab === "crawl" && (
          <CrawlTab
            crawlStatus={crawlStatus}
            crawling={crawling}
            onRefresh={fetchCrawlStatus}
            onTrigger={triggerCrawl}
            onViewSnapshot={fetchSnapshot}
            snapshotData={snapshotData}
            snapshotLoading={snapshotLoading}
          />
        )}
        {activeTab === "overrides" && (
          <OverridesTab
            overrides={overrides}
            editingOverride={editingOverride}
            editForm={editForm}
            newEventId={newEventId}
            saving={saving}
            onStartEdit={startEditOverride}
            onCancelEdit={() => { setEditingOverride(null); setEditForm({}); setNewEventId("") }}
            onSave={saveOverride}
            onDelete={deleteOverride}
            onEditFormChange={setEditForm}
            onNewEventIdChange={setNewEventId}
          />
        )}
        {activeTab === "preview" && (
          <PreviewTab
            series={previewSeries}
            data={previewData}
            loading={previewLoading}
            onSeriesChange={(s) => { setPreviewSeries(s); setPreviewData(null) }}
            onRefresh={() => fetchPreview(previewSeries)}
          />
        )}
        {activeTab === "feedback" && (
          <FeedbackTab
            feedbacks={feedbacks}
            loading={feedbackLoading}
            onRefresh={fetchFeedbacks}
            onDelete={deleteFeedback}
          />
        )}
      </div>

      <footer className="border-t border-border pt-4 text-xs text-muted-foreground text-center">
        赛道时刻 · 后台管理面板
      </footer>
    </div>
  )
}

// ─── 服务状态 Tab ───────────────────────────────────────

function StatusTab({
  status, loading, onRefresh
}: {
  status: StatusResponse | null
  loading: boolean
  onRefresh: () => void
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Activity className="size-4" />
          服务状态
        </div>
        <Button variant="outline" size="sm" onClick={onRefresh} disabled={loading} className="gap-2">
          <RefreshCw className={cn("size-4", loading && "animate-spin")} />
          {loading ? "刷新中..." : "刷新"}
        </Button>
      </div>

      {!status ? (
        <div className="flex items-center justify-center py-10">
          <Button onClick={onRefresh} className="gap-2">
            <RefreshCw className="size-4" />
            获取状态
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {Object.entries(status.services).map(([key, service]) => (
            <div
              key={key}
              className="rounded-xl border border-border bg-card p-4 transition-colors hover:border-muted-foreground/30"
            >
              <div className="flex items-center gap-3">
                <div
                  className="flex h-9 w-9 items-center justify-center rounded-lg text-sm font-bold"
                  style={{ backgroundColor: `${SERVICE_LABELS[key].color}20`, color: SERVICE_LABELS[key].color }}
                >
                  {SERVICE_LABELS[key].name}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{SERVICE_LABELS[key].name} 数据服务</span>
                    <span
                      className={cn(
                        "flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
                        service.status === "success"
                          ? "bg-emerald-500/15 text-emerald-600"
                          : "bg-destructive/10 text-destructive",
                      )}
                    >
                      {service.status === "success" ? (
                        <><CheckCircle className="size-3" />正常</>
                      ) : (
                        <><AlertCircle className="size-3" />异常</>
                      )}
                    </span>
                  </div>
                  <div className="mt-1 flex items-center gap-4 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Clock className="size-3" />
                      赛事数量：{service.eventCount}
                    </span>
                    {service.note && <span>{service.note}</span>}
                  </div>
                </div>
              </div>
            </div>
          ))}

          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center justify-between">
              <div className="text-sm text-muted-foreground">
                最后更新：{formatTime(status.timestamp)}
              </div>
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <CheckCircle className="size-3 text-emerald-500" />
                系统运行正常
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── 爬虫管理 Tab ───────────────────────────────────────

function CrawlTab({
  crawlStatus, crawling, onRefresh, onTrigger, onViewSnapshot, snapshotData, snapshotLoading
}: {
  crawlStatus: Record<string, CrawlStatus> | null
  crawling: Series | null
  onRefresh: () => void
  onTrigger: (series: Series) => void
  onViewSnapshot: (series: Series) => void
  snapshotData: any
  snapshotLoading: boolean
}) {
  const [expandedSnapshot, setExpandedSnapshot] = useState<Series | null>(null)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Zap className="size-4" />
          爬虫管理 · 每日配额 10 次
        </div>
        <Button variant="outline" size="sm" onClick={onRefresh} className="gap-2">
          <RefreshCw className="size-4" />
          刷新
        </Button>
      </div>

      {!crawlStatus ? (
        <div className="flex items-center justify-center py-10">
          <Button onClick={onRefresh} className="gap-2">
            <RefreshCw className="size-4" />
            获取爬虫状态
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {(["F1", "FE", "WRC"] as Series[]).map((series) => {
            const key = series.toLowerCase()
            const info = crawlStatus[key]
            if (!info) return null
            const isCrawling = crawling === series

            return (
              <div key={series} className="rounded-xl border border-border bg-card p-4">
                <div className="flex items-center gap-3">
                  <div
                    className="flex h-9 w-9 items-center justify-center rounded-lg text-sm font-bold"
                    style={{
                      backgroundColor: `${SERVICE_LABELS[key].color}20`,
                      color: SERVICE_LABELS[key].color,
                    }}
                  >
                    {SERVICE_LABELS[key].name}
                  </div>
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{series} 爬虫</span>
                      {info.lastFetch && (
                        <span className="text-xs text-muted-foreground">
                          上次爬取：{formatTime(info.lastFetch)}
                        </span>
                      )}
                    </div>
                    {/* 配额进度条 */}
                    <div className="flex items-center gap-2">
                      <div className="h-2 flex-1 overflow-hidden rounded-full bg-secondary">
                        <div
                          className={cn(
                            "h-full rounded-full transition-all",
                            info.quotaUsed >= info.quotaLimit
                              ? "bg-destructive"
                              : info.quotaUsed >= 7
                                ? "bg-amber-500"
                                : "bg-emerald-500"
                          )}
                          style={{ width: `${Math.min((info.quotaUsed / info.quotaLimit) * 100, 100)}%` }}
                        />
                      </div>
                      <span className="text-xs tabular-nums text-muted-foreground">
                        {info.quotaUsed}/{info.quotaLimit}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        if (expandedSnapshot === series) {
                          setExpandedSnapshot(null)
                        } else {
                          setExpandedSnapshot(series)
                          onViewSnapshot(series)
                        }
                      }}
                      className="gap-1"
                    >
                      <Eye className="size-3.5" />
                      快照
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => onTrigger(series)}
                      disabled={isCrawling || info.quotaUsed >= info.quotaLimit}
                      className="gap-1"
                    >
                      {isCrawling ? (
                        <RefreshCw className="size-3.5 animate-spin" />
                      ) : (
                        <Play className="size-3.5" />
                      )}
                      {isCrawling ? "爬取中..." : "立即爬取"}
                    </Button>
                  </div>
                </div>

                {/* 快照展开区域 */}
                {expandedSnapshot === series && (
                  <div className="mt-3 border-t border-border pt-3">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
                      <Database className="size-3" />
                      最新快照数据
                    </div>
                    {snapshotLoading ? (
                      <div className="flex items-center justify-center py-4 text-sm text-muted-foreground">
                        <RefreshCw className="size-4 animate-spin mr-2" />
                        加载中...
                      </div>
                    ) : snapshotData ? (
                      <pre className="max-h-80 overflow-auto rounded-lg bg-secondary/50 p-3 text-xs leading-relaxed">
                        {JSON.stringify(snapshotData, null, 2)}
                      </pre>
                    ) : (
                      <div className="py-4 text-center text-sm text-muted-foreground">
                        暂无快照数据
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── 数据覆盖 Tab ───────────────────────────────────────

function OverridesTab({
  overrides, editingOverride, editForm, newEventId, saving,
  onStartEdit, onCancelEdit, onSave, onDelete, onEditFormChange, onNewEventIdChange
}: {
  overrides: Override[]
  editingOverride: string | null
  editForm: Record<string, any>
  newEventId: string
  saving: boolean
  onStartEdit: (eventId: string, data?: Record<string, any>) => void
  onCancelEdit: () => void
  onSave: () => void
  onDelete: (eventId: string) => void
  onEditFormChange: (form: Record<string, any>) => void
  onNewEventIdChange: (id: string) => void
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Database className="size-4" />
          数据覆盖 · 手动修改赛事展示内容
        </div>
        <Button
          size="sm"
          onClick={() => onStartEdit("__new__")}
          disabled={editingOverride !== null}
          className="gap-1"
        >
          <Edit3 className="size-3.5" />
          新增覆盖
        </Button>
      </div>

      {/* 编辑表单 */}
      {editingOverride && (
        <div className="rounded-xl border border-primary/30 bg-card p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-medium">
              {editingOverride === "__new__" ? "新增覆盖" : `编辑：${editingOverride}`}
            </h3>
            <button onClick={onCancelEdit} className="text-muted-foreground hover:text-foreground">
              <X className="size-4" />
            </button>
          </div>

          {editingOverride === "__new__" && (
            <div className="mb-4">
              <label className="mb-1.5 block text-sm font-medium">赛事 ID</label>
              <input
                value={newEventId}
                onChange={(e) => onNewEventIdChange(e.target.value)}
                placeholder="如 f1-2026-1 或 wrc-2026-3"
                className="flex w-full rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-primary focus:ring-1 focus:ring-primary"
              />
            </div>
          )}

          <div className="space-y-3">
            {OVERRIDABLE_FIELDS.map((field) => {
              const value = getNestedValue(editForm, field.key) ?? ""
              return (
                <div key={field.key}>
                  <label className="mb-1 block text-sm font-medium text-muted-foreground">
                    {field.label}
                  </label>
                  {field.type === "boolean" ? (
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={!!value}
                        onChange={(e) => {
                          const next = { ...editForm }
                          setNestedValue(next, field.key, e.target.checked)
                          onEditFormChange(next)
                        }}
                        className="size-4 rounded border-input"
                      />
                      <span className="text-sm">是</span>
                    </label>
                  ) : field.type === "json" ? (
                    <textarea
                      value={typeof value === "string" ? value : JSON.stringify(value, null, 2)}
                      onChange={(e) => {
                        const next = { ...editForm }
                        try {
                          setNestedValue(next, field.key, JSON.parse(e.target.value))
                        } catch {
                          setNestedValue(next, field.key, e.target.value)
                        }
                        onEditFormChange(next)
                      }}
                      rows={4}
                      className="flex w-full rounded-lg border border-input bg-background px-3 py-2 text-sm font-mono shadow-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-primary focus:ring-1 focus:ring-primary"
                    />
                  ) : (
                    <input
                      value={value}
                      onChange={(e) => {
                        const next = { ...editForm }
                        setNestedValue(next, field.key, e.target.value || undefined)
                        onEditFormChange(next)
                      }}
                      placeholder={field.label}
                      className="flex w-full rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-primary focus:ring-1 focus:ring-primary"
                    />
                  )}
                </div>
              )
            })}
          </div>

          <div className="mt-4 flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={onCancelEdit}>取消</Button>
            <Button size="sm" onClick={onSave} disabled={saving} className="gap-1">
              <Save className="size-3.5" />
              {saving ? "保存中..." : "保存"}
            </Button>
          </div>
        </div>
      )}

      {/* 覆盖列表 */}
      {overrides.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
          <Database className="size-8 mb-2 opacity-50" />
          <p className="text-sm">暂无数据覆盖</p>
          <p className="text-xs mt-1">点击「新增覆盖」手动修改赛事展示内容</p>
        </div>
      ) : (
        <div className="space-y-2">
          {overrides.map((ov) => (
            <div
              key={ov.eventId}
              className="rounded-lg border border-border bg-card p-3 flex items-center gap-3"
            >
              <div className="flex-1 min-w-0">
                <div className="font-mono text-sm font-medium truncate">{ov.eventId}</div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  覆盖字段：{Object.keys(ov.data).join(", ") || "（空）"}
                  <span className="ml-2">更新于 {formatTime(ov.updatedAt)}</span>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onStartEdit(ov.eventId, ov.data)}
                  className="gap-1"
                >
                  <Edit3 className="size-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onDelete(ov.eventId)}
                  className="gap-1 text-destructive hover:text-destructive"
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── 数据预览 Tab ───────────────────────────────────────

function PreviewTab({
  series, data, loading, onSeriesChange, onRefresh
}: {
  series: Series
  data: any
  loading: boolean
  onSeriesChange: (s: Series) => void
  onRefresh: () => void
}) {
  const [expandedEvents, setExpandedEvents] = useState<Set<string>>(new Set())

  const toggleEvent = (id: string) => {
    setExpandedEvents((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const events: any[] = data?.events ?? []

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Eye className="size-4" />
          数据预览 · 合并快照与覆盖后的最终数据
        </div>
        <div className="flex items-center gap-2">
          <select
            value={series}
            onChange={(e) => onSeriesChange(e.target.value as Series)}
            className="rounded-lg border border-input bg-background px-2 py-1 text-sm outline-none focus:border-primary"
          >
            <option value="F1">F1</option>
            <option value="FE">FE</option>
            <option value="WRC">WRC</option>
          </select>
          <Button variant="outline" size="sm" onClick={onRefresh} disabled={loading} className="gap-1">
            <RefreshCw className={cn("size-3.5", loading && "animate-spin")} />
            刷新
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-10 text-muted-foreground">
          <RefreshCw className="size-5 animate-spin mr-2" />
          加载中...
        </div>
      ) : !data ? (
        <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
          <Eye className="size-8 mb-2 opacity-50" />
          <p className="text-sm">点击刷新加载预览数据</p>
        </div>
      ) : (
        <div className="space-y-3">
          {/* 摘要 */}
          <div className="rounded-lg border border-border bg-card p-3 flex items-center gap-4 text-sm">
            <span className="font-medium">{series}</span>
            <span className="text-muted-foreground">赛事数：{events.length}</span>
            {data.fetchedAt && (
              <span className="text-muted-foreground">数据时间：{formatTime(data.fetchedAt)}</span>
            )}
          </div>

          {/* 赛事列表 */}
          {events.length === 0 ? (
            <div className="py-6 text-center text-sm text-muted-foreground">无赛事数据</div>
          ) : (
            events.map((event: any) => (
              <div key={event.id} className="rounded-lg border border-border bg-card overflow-hidden">
                <button
                  onClick={() => toggleEvent(event.id)}
                  className="w-full flex items-center gap-2 p-3 text-left hover:bg-secondary/50 transition-colors"
                >
                  {expandedEvents.has(event.id) ? (
                    <ChevronDown className="size-4 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="size-4 text-muted-foreground" />
                  )}
                  <span className="text-sm font-medium">{event.name}</span>
                  <span className="text-xs text-muted-foreground">{event.circuit}</span>
                  <span className="text-xs text-muted-foreground ml-auto">
                    {event.sessions?.length ?? 0} 场次
                  </span>
                </button>
                {expandedEvents.has(event.id) && (
                  <div className="border-t border-border p-3">
                    <pre className="max-h-60 overflow-auto rounded-lg bg-secondary/50 p-2 text-xs leading-relaxed">
                      {JSON.stringify(event, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}

// ─── 用户反馈 Tab ───────────────────────────────────────

function FeedbackTab({
  feedbacks, loading, onRefresh, onDelete
}: {
  feedbacks: any[]
  loading: boolean
  onRefresh: () => void
  onDelete: (id: number) => void
}) {
  const TYPE_LABELS: Record<string, { label: string; color: string }> = {
    bug: { label: "Bug", color: "bg-destructive/10 text-destructive" },
    feature: { label: "功能", color: "bg-blue-500/10 text-blue-600" },
    suggestion: { label: "建议", color: "bg-amber-500/10 text-amber-600" },
    other: { label: "其他", color: "bg-muted/20 text-muted-foreground" },
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <MessageSquare className="size-4" />
          用户反馈 · 共 {feedbacks.length} 条
        </div>
        <Button variant="outline" size="sm" onClick={onRefresh} disabled={loading} className="gap-1">
          <RefreshCw className={cn("size-3.5", loading && "animate-spin")} />
          刷新
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-10 text-muted-foreground">
          <RefreshCw className="size-5 animate-spin mr-2" />
          加载中...
        </div>
      ) : feedbacks.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
          <MessageSquare className="size-8 mb-2 opacity-50" />
          <p className="text-sm">暂无用户反馈</p>
        </div>
      ) : (
        <div className="space-y-2">
          {feedbacks.map((fb) => (
            <div
              key={fb.id}
              className="rounded-lg border border-border bg-card p-4 hover:border-muted-foreground/30 transition-colors"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={cn(
                      "rounded-full px-2 py-0.5 text-xs font-medium",
                      TYPE_LABELS[fb.type]?.color ?? TYPE_LABELS.other.color
                    )}>
                      {TYPE_LABELS[fb.type]?.label ?? TYPE_LABELS.other.label}
                    </span>
                    <span className="text-xs text-muted-foreground">{formatTime(fb.created_at)}</span>
                  </div>
                  <h3 className="font-medium text-sm truncate">{fb.title}</h3>
                  <p className="mt-1 text-sm text-muted-foreground line-clamp-2">{fb.description}</p>
                  {fb.email && (
                    <div className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
                      <span className="opacity-50">邮箱:</span>
                      <span>{fb.email}</span>
                    </div>
                  )}
                  {(fb.browser || fb.system) && (
                    <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                      {fb.browser && <span>{fb.browser}</span>}
                      {fb.system && <span>{fb.system}</span>}
                    </div>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onDelete(fb.id)}
                  className="gap-1 text-destructive hover:text-destructive shrink-0"
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
