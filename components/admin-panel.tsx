"use client"

import { useState, useEffect } from "react"
import { Activity, AlertCircle, CheckCircle, Clock, Lock, LogOut, RefreshCw, Server } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

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

const SERVICE_LABELS: Record<string, { name: string; color: string }> = {
  f1: { name: "F1", color: "#00D2BE" },
  fe: { name: "FE", color: "#FFD500" },
  wrc: { name: "WRC", color: "#E4002B" },
}

export function AdminPanel() {
  const [authenticated, setAuthenticated] = useState(false)
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [status, setStatus] = useState<StatusResponse | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    checkAuth()
  }, [])

  const checkAuth = async () => {
    const res = await fetch("/api/admin/auth")
    const data = await res.json()
    setAuthenticated(data.authenticated)
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
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
  }

  const handleLogout = async () => {
    document.cookie = "admin_auth=; max-age=0; path=/admin"
    setAuthenticated(false)
    setStatus(null)
  }

  const fetchStatus = async () => {
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
  }

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
              {error && (
                <p className="text-sm text-destructive">{error}</p>
              )}
              <Button type="submit" className="w-full">
                登录
              </Button>
            </div>
          </form>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-8">
      <header className="flex items-center justify-between border-b border-border pb-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
            <Server className="size-5 text-primary" />
          </div>
          <div>
            <h1 className="text-lg font-bold">后台管理</h1>
            <p className="text-xs text-muted-foreground">服务状态监控与管理</p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={handleLogout} className="gap-2">
          <LogOut className="size-4" />
          退出
        </Button>
      </header>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Activity className="size-4" />
          服务状态
        </div>
        <Button variant="outline" size="sm" onClick={fetchStatus} disabled={loading} className="gap-2">
          <RefreshCw className={cn("size-4", loading && "animate-spin")} />
          {loading ? "刷新中..." : "刷新"}
        </Button>
      </div>

      {!status ? (
        <div className="flex items-center justify-center py-10">
          <Button onClick={fetchStatus} className="gap-2">
            <RefreshCw className="size-4" />
            获取状态
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
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
                        <>
                          <CheckCircle className="size-3" />
                          正常
                        </>
                      ) : (
                        <>
                          <AlertCircle className="size-3" />
                          异常
                        </>
                      )}
                    </span>
                  </div>
                  <div className="mt-1 flex items-center gap-4 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Clock className="size-3" />
                      赛事数量：{service.eventCount}
                    </span>
                    {service.note && (
                      <span>{service.note}</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}

          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center justify-between">
              <div className="text-sm text-muted-foreground">
                最后更新：{new Date(status.timestamp).toLocaleString("zh-CN")}
              </div>
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <CheckCircle className="size-3 text-emerald-500" />
                系统运行正常
              </div>
            </div>
          </div>
        </div>
      )}

      <footer className="border-t border-border pt-4 text-xs text-muted-foreground text-center">
        赛道时刻 - 后台管理面板
      </footer>
    </div>
  )
}