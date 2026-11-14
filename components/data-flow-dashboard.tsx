"use client"

import Link from "next/link"
import { AnimatePresence, motion } from "motion/react"
import { useCallback, useEffect, useMemo, useState } from "react"
import {
  Activity, ArrowDown, ArrowLeft, ArrowRight, Check, CircleHelp, Clock3,
  Database, ExternalLink, GitBranch, Globe2, Radio, RefreshCw,
  ShieldCheck, Sparkles, TriangleAlert, Wifi,
} from "lucide-react"
import type { RaceEvent, ScheduleResponse, Series } from "@/lib/types"
import type { DataFlowSample } from "@/lib/data-flow-telemetry"

type Run = {
  series: Series
  runId: string
  status: "active" | "complete" | "fallback" | "failed"
  stage: string
  triggeredBy: string
  startedAt: string
  updatedAt: string
  finishedAt: string | null
  eventCount: number
  sampleEvent: DataFlowSample | null
  diagnostics?: { requests: number; networkFailures: number; cacheHits: number; durationMs: number; budgetExpired: boolean } | null
  note: string
}

type FlowSnapshot = {
  series: Series
  fetchedAt: string
  source: string | null
  eventCount: number
  tentativeCount: number
  sourceEvent: DataFlowSample | null
}

type FlowResponse = {
  configured: boolean
  telemetryAvailable: boolean
  generatedAt?: string
  runs: Run[]
  snapshots: FlowSnapshot[]
  quotas: { series: Series; used: number; limit: number }[]
  clientCrawl: { series: Series; status: string; createdAt: string | null; receivedAt: string | null; filled: number }[]
}

const SERIES_META: Record<Series, { label: string; tint: string; endpoint: string; description: string }> = {
  F1: { label: "FORMULA 1", tint: "text-f1", endpoint: "Jolpica → F1 官网回退", description: "赛历、场次 UTC、上年赛果补充" },
  FE: { label: "FORMULA E", tint: "text-fe", endpoint: "Formula E PulseLive", description: "赛季目录 → 赛事 → 场次" },
  WRC: { label: "WORLD RALLY", tint: "text-wrc", endpoint: "WRC 官网 GraphQL / itinerary", description: "赛季发现 → 赛事目录 → 逐站行程" },
}

const STAGE_LABEL: Record<string, string> = {
  fetching: "正在请求来源",
  checking: "解析与完整性检查",
  fallback: "检查最近成功快照",
  persisting: "保存数据库快照",
  complete: "本轮处理完成",
  failed: "本轮未获得新数据",
}

const STAGE_ORDER = ["fetching", "checking", "persisting", "complete"]

function dateTime(value?: string | null) {
  if (!value) return "暂无记录"
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) return "时间未知"
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
  }).format(date)
}

function visibleSample(event: RaceEvent | undefined): DataFlowSample | null {
  if (!event) return null
  const session = event.sessions.find(item => item.isMain) ?? event.sessions[0]
  const tentative = Boolean(event.tentative || event.sessions.some(item => item.tentative))
  return {
    id: event.id,
    series: event.series,
    round: event.round,
    name: event.name,
    country: event.country,
    circuit: event.circuit,
    sessionCount: event.sessions.length,
    mainSession: session ? { name: session.name, utc: tentative || session.tentative ? null : session.utc, tentative: Boolean(tentative || session.tentative) } : null,
    tentative,
  }
}

function sameSample(a: DataFlowSample | null, b: DataFlowSample | null) {
  if (!a || !b) return []
  const fields: [string, unknown, unknown][] = [
    ["赛事名称", a.name, b.name],
    ["比赛地点", `${a.circuit} · ${a.country}`, `${b.circuit} · ${b.country}`],
    ["场次数量", a.sessionCount, b.sessionCount],
    ["主场次", a.mainSession?.name ?? "无", b.mainSession?.name ?? "无"],
    ["时间可信度", a.tentative ? "待确认" : "已确认", b.tentative ? "待确认" : "已确认"],
  ]
  return fields.filter(([, before, after]) => JSON.stringify(before) !== JSON.stringify(after)).map(([label]) => label)
}

function runFresh(run: Run | undefined) {
  if (!run) return false
  return run.status === "active" && Date.now() - new Date(run.updatedAt).getTime() < 5 * 60_000
}

function flowStageIndex(run: Run | undefined) {
  if (!run) return -1
  if (run.stage === "fallback") return 2
  return STAGE_ORDER.indexOf(run.stage)
}

function StatusMark({ run, fresh }: { run?: Run; fresh: boolean }) {
  if (fresh) return <Activity className="size-4 text-primary" aria-label="正在处理" />
  if (run?.status === "active") return <TriangleAlert className="size-4 text-amber-400" aria-label="运行记录已停更" />
  if (run?.status === "complete") return <Check className="size-4 text-emerald-400" aria-label="完成" />
  if (run?.status === "fallback") return <RefreshCw className="size-4 text-amber-400" aria-label="使用快照回退" />
  if (run?.status === "failed") return <TriangleAlert className="size-4 text-amber-400" aria-label="本轮失败" />
  return <CircleHelp className="size-4 text-muted-foreground" aria-label="等待首次记录" />
}

function FlowNode({
  index, title, caption, icon: Icon, active, complete, warning,
}: {
  index: number; title: string; caption: string; icon: typeof Globe2; active: boolean; complete: boolean; warning?: boolean
}) {
  return (
    <motion.div
      layout
      aria-current={active ? "step" : undefined}
      className={`relative flex min-w-0 items-center gap-3 rounded-2xl border px-3 py-3.5 transition-colors sm:px-4 ${
        active ? "border-primary/55 bg-primary/[0.07]" : complete ? "border-emerald-400/20 bg-emerald-400/[0.035]" : "border-border/70 bg-card/35"
      }`}
    >
      <div className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${active ? "bg-primary/15 text-primary" : complete ? "bg-emerald-400/10 text-emerald-300" : warning ? "bg-amber-400/10 text-amber-300" : "bg-secondary text-muted-foreground"}`}>
        <Icon className="size-[18px]" />
      </div>
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-mono text-[10px] tracking-[0.16em] text-muted-foreground/70">0{index + 1}</span>
          <p className="truncate text-sm font-semibold">{title}</p>
        </div>
        <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{caption}</p>
      </div>
      {active && <span className="absolute right-3 top-3 size-1.5 rounded-full bg-primary" aria-label="当前阶段" />}
    </motion.div>
  )
}

function SectionTitle({ eyebrow, title, detail }: { eyebrow: string; title: string; detail?: string }) {
  return <div className="mb-5 flex flex-wrap items-end justify-between gap-3"><div><p className="font-mono text-[10px] tracking-[0.2em] text-primary/80">{eyebrow}</p><h2 className="mt-1 text-xl font-semibold tracking-tight sm:text-2xl">{title}</h2></div>{detail && <p className="max-w-lg text-xs leading-relaxed text-muted-foreground">{detail}</p>}</div>
}

export function DataFlowDashboard() {
  const [schedule, setSchedule] = useState<ScheduleResponse | null>(null)
  const [scheduleError, setScheduleError] = useState(false)
  const [selectedId, setSelectedId] = useState("")
  const [flow, setFlow] = useState<FlowResponse | null>(null)
  const [flowUpdatedAt, setFlowUpdatedAt] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    let timer: ReturnType<typeof setTimeout> | undefined
    const loadSchedule = async () => {
      try {
        const response = await fetch("/api/schedule", { cache: "no-store" })
        if (!response.ok) throw new Error("schedule-unavailable")
        const data = await response.json() as ScheduleResponse
        if (!alive) return
        setSchedule(data)
        setScheduleError(false)
        const upcoming = [...(data.events ?? [])].sort((a, b) => {
          const aTime = Math.min(...a.sessions.map(session => Date.parse(session.utc)).filter(Number.isFinite))
          const bTime = Math.min(...b.sessions.map(session => Date.parse(session.utc)).filter(Number.isFinite))
          return aTime - bTime
        }).find(event => event.sessions.some(session => Date.parse(session.utc) > Date.now())) ?? data.events?.[0]
        setSelectedId(current => current || upcoming?.id || "")
      } catch {
        if (alive) {
          setScheduleError(true)
          timer = setTimeout(loadSchedule, 60_000)
        }
      }
    }
    void loadSchedule()
    return () => { alive = false; if (timer) clearTimeout(timer) }
  }, [])

  const loadFlow = useCallback(async (signal?: AbortSignal) => {
    const query = selectedId ? `?eventId=${encodeURIComponent(selectedId)}` : ""
    try {
      const response = await fetch(`/api/data-flow${query}`, { cache: "no-store", signal })
      if (!response.ok) return
      const data = await response.json() as FlowResponse
      setFlow(data)
      setFlowUpdatedAt(data.generatedAt ?? new Date().toISOString())
    } catch {
      // A read-only monitoring view should quietly retain its last good display.
    }
  }, [selectedId])

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined
    let controller: AbortController | undefined
    let alive = true
    const poll = async () => {
      if (!alive) return
      if (document.visibilityState === "visible") {
        controller = new AbortController()
        await loadFlow(controller.signal)
      }
      if (alive) timer = setTimeout(poll, document.visibilityState === "visible" ? 15_000 : 45_000)
    }
    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        if (timer) clearTimeout(timer)
        void poll()
      }
    }
    void poll()
    document.addEventListener("visibilitychange", onVisibility)
    return () => {
      alive = false
      if (timer) clearTimeout(timer)
      controller?.abort()
      document.removeEventListener("visibilitychange", onVisibility)
    }
  }, [loadFlow])

  const events = useMemo(() => schedule?.events ?? [], [schedule])
  const selectedEvent = events.find(event => event.id === selectedId) ?? events[0]
  const picked = visibleSample(selectedEvent)
  const trackedSeries = selectedEvent?.series
  const activeRuns = (flow?.runs ?? []).filter(run => runFresh(run))
  const currentRun = flow?.runs.find(run => run.series === trackedSeries)
  const currentRunActive = runFresh(currentRun)
  const currentSnapshot = flow?.snapshots.find(snapshot => snapshot.series === trackedSeries)
  const sourceEvent = currentSnapshot?.sourceEvent ?? null
  const differences = sameSample(sourceEvent, picked)
  const trackerJson = JSON.stringify({ serverSnapshot: sourceEvent, scheduleApiResponse: picked }, null, 2)

  return (
    <main className="mx-auto min-h-screen w-full max-w-[1160px] px-4 pb-20 pt-5 sm:px-7 sm:pt-8 lg:px-10">
      <header className="mb-8 flex items-center justify-between">
        <Link href="/" className="inline-flex size-9 items-center justify-center rounded-full text-muted-foreground transition hover:bg-secondary hover:text-foreground" aria-label="返回首页"><ArrowLeft className="size-4" /></Link>
        <div className="flex items-center gap-2 rounded-full border border-border/70 bg-card/50 px-3 py-1.5 text-[11px] text-muted-foreground">
          <span className={`size-1.5 rounded-full ${activeRuns.length ? "bg-emerald-400" : flow?.configured === false ? "bg-amber-400" : "bg-muted-foreground/50"}`} />
          {activeRuns.length ? `${activeRuns.length} 条链路正在更新` : flow?.configured === false ? "数据库未连接" : "自动观察 · 只读"}
        </div>
      </header>

      <section className="relative mb-10 overflow-hidden rounded-[28px] border border-border/70 bg-[radial-gradient(ellipse_at_78%_0%,rgba(111,117,255,0.13),transparent_38%),linear-gradient(145deg,rgba(255,255,255,0.035),transparent_60%)] px-5 py-7 sm:px-9 sm:py-10">
        <div className="pointer-events-none absolute -right-16 -top-28 size-72 rounded-full border border-white/[0.035]" />
        <div className="pointer-events-none absolute -right-5 -top-16 size-52 rounded-full border border-white/[0.04]" />
        <div className="relative max-w-3xl">
          <p className="mb-4 flex items-center gap-2 font-mono text-[10px] tracking-[0.22em] text-primary/85"><Activity className="size-3.5" /> RACE CALENDAR / DATA JOURNEY</p>
          <h1 className="text-3xl font-semibold leading-tight tracking-[-0.04em] sm:text-5xl">每场赛事，<br className="sm:hidden" />都有清晰的来路。</h1>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-muted-foreground sm:text-[15px]">
            从公开赛历、服务端解析、Neon 快照，到页面实际收到的数据。这里跟踪真实运行状态；没有更新任务时，就展示最近一次成功记录，不制造“实时运行”的假象。
          </p>
          <div className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-[11px] text-muted-foreground">
            <span className="inline-flex items-center gap-1.5"><Radio className="size-3.5 text-primary" />每 15 秒轻量检查状态</span>
            <span className="inline-flex items-center gap-1.5"><ShieldCheck className="size-3.5 text-emerald-400" />遥测只读，更新沿用现有访问规则</span>
            <span className="inline-flex items-center gap-1.5"><Sparkles className="size-3.5 text-amber-300" />切走页面自动降频</span>
          </div>
        </div>
      </section>

      <section className="mb-12">
        <SectionTitle eyebrow="01 / LIVE SOURCES" title="三条赛历，三种获取路径" detail={flowUpdatedAt ? `监控数据更新于 ${dateTime(flowUpdatedAt)} · 赛历响应 ${dateTime(schedule?.fetchedAt)}` : "正在读取赛历响应与最近一次持久化快照"} />
        <div className="grid gap-3 md:grid-cols-3">
          {(["F1", "FE", "WRC"] as const).map((series, index) => {
            const snapshot = flow?.snapshots.find(item => item.series === series)
            const run = flow?.runs.find(item => item.series === series)
            const fresh = runFresh(run)
            const quota = flow?.quotas.find(item => item.series === series)
            const source = schedule?.sources.find(item => item.series === series)
            return (
              <motion.article key={series} initial={{ opacity: 0.96 }} animate={{ opacity: 1 }} transition={{ duration: 0.18 }} className="relative overflow-hidden rounded-2xl border border-border/70 bg-card/35 p-4 sm:p-5">
                <div className={`absolute inset-x-0 top-0 h-px ${series === "F1" ? "bg-f1/70" : series === "FE" ? "bg-fe/70" : "bg-wrc/70"}`} />
                <div className="flex items-center justify-between gap-3">
                  <div><p className={`font-mono text-[10px] tracking-[0.18em] ${SERIES_META[series].tint}`}>{SERIES_META[series].label}</p><h3 className="mt-1.5 text-sm font-semibold">{SERIES_META[series].endpoint}</h3></div>
                  <StatusMark run={run} fresh={fresh} />
                </div>
                <p className="mt-2 text-xs text-muted-foreground">{SERIES_META[series].description}</p>
                <div className="mt-5 flex items-end justify-between border-t border-border/60 pt-3">
                  <div><p className="font-mono text-2xl font-semibold tabular-nums">{snapshot?.eventCount ?? "—"}<span className="ml-1 text-xs font-normal text-muted-foreground">场</span></p><p className="mt-1 text-[10px] text-muted-foreground">最近成功快照 · {dateTime(snapshot?.fetchedAt)}</p></div>
                  <div className="text-right"><p className="text-[11px] font-medium">{fresh ? STAGE_LABEL[run?.stage ?? ""] : run?.status === "active" ? "运行记录已停更" : run?.status === "fallback" ? "快照回退" : run?.status === "failed" ? "最近刷新失败" : source?.ok ? "当前赛历可用" : "等待首次记录"}</p><p className="mt-1 text-[10px] text-muted-foreground">{run?.status === "active" && !fresh ? "超过 5 分钟未更新，暂按中断处理" : run?.note ?? source?.note ?? "暂无处理记录"}</p></div>
                </div>
                <div className="mt-4 flex items-center justify-between gap-2 text-[10px] text-muted-foreground">
                  <span>估计 / 待确认 {snapshot?.tentativeCount ?? "—"} 场</span>
                  <span>配额 {quota ? `${quota.used}/${quota.limit}` : "—"}{series === "WRC" ? " · 官网请求不计" : ""}</span>
                </div>
              </motion.article>
            )
          })}
        </div>
      </section>

      <section className="mb-12">
        <SectionTitle eyebrow="02 / PROCESS TRACE" title="正在发生什么" detail="刷新阶段由服务端真实记录。监控接口只读；本页读取赛历时仍遵循现有规则，可能触发过期快照的响应后更新。" />
        <div className="mb-4 grid gap-2 md:grid-cols-5 md:gap-2.5">
          {[
            { title: "公开来源", caption: trackedSeries ? SERIES_META[trackedSeries].endpoint : "F1 / FE / WRC", icon: Globe2 },
            { title: "解析校验", caption: "字段、时间与可信度", icon: GitBranch },
            { title: "Neon 快照", caption: "只保存成功且非空数据", icon: Database },
            { title: "合并回退", caption: "赛历补齐与人工覆盖", icon: RefreshCw },
            { title: "页面响应", caption: "接口返回实际赛程", icon: Wifi },
          ].map((node, index) => {
            const activeIndex = currentRunActive ? flowStageIndex(currentRun) : -1
            const active = trackedSeries ? currentRunActive && (index === activeIndex || (currentRun?.stage === "fallback" && index === 2)) : false
            const complete = trackedSeries ? Boolean(currentRun && !currentRunActive && (currentRun.status === "complete" || currentRun.status === "fallback") && (index <= 2 || Boolean(schedule))) : false
            const warning = trackedSeries ? currentRun?.status === "fallback" && index === 2 : false
            return <FlowNode key={node.title} index={index} title={node.title} caption={node.caption} icon={node.icon} active={active} complete={complete} warning={warning} />
          })}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/60 bg-card/25 px-4 py-3 text-xs">
          <div className="flex items-center gap-2">
            {currentRunActive ? <Activity className="size-4 text-primary" /> : currentRun?.status === "failed" ? <TriangleAlert className="size-4 text-amber-400" /> : <Check className="size-4 text-emerald-400" />}
            <span className="font-medium">{trackedSeries ? (currentRunActive ? `${SERIES_META[trackedSeries].label} · ${STAGE_LABEL[currentRun?.stage ?? ""] ?? "正在处理"}` : currentRun?.status === "active" ? "运行记录超过 5 分钟未更新，暂按中断处理" : currentRun?.note ?? (currentSnapshot ? "当前请求使用已有成功快照" : "等待真实刷新记录")) : "等待赛历数据"}</span>
          </div>
          <span className="text-muted-foreground">{currentRun ? `触发方式：${currentRun.triggeredBy === "admin-manual" ? "后台人工刷新" : currentRun.triggeredBy === "schedule-background" ? "过期快照后台更新" : "赛历请求"} · 开始 ${dateTime(currentRun.startedAt)}` : "没有活跃任务"}</span>
        </div>
        {currentRun?.diagnostics && <p className="mt-2 text-right font-mono text-[10px] text-muted-foreground">WRC 请求 {currentRun.diagnostics.requests} · 网络失败 {currentRun.diagnostics.networkFailures} · 缓存命中 {currentRun.diagnostics.cacheHits} · {currentRun.diagnostics.durationMs} ms{currentRun.diagnostics.budgetExpired ? " · 预算到期" : ""}</p>}
      </section>

      <section className="mb-12 rounded-[24px] border border-border/70 bg-card/25 p-4 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <SectionTitle eyebrow="03 / FOLLOW ONE EVENT" title="跟踪一条真实赛事数据" detail="左侧来自 Neon 最近成功快照，右侧来自浏览器刚收到的 /api/schedule 响应。字段差异由这两份真实记录直接比较。" />
          <label className="mb-5 flex min-w-0 flex-col gap-1.5 sm:mb-0 sm:w-[310px]">
            <span className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">选择赛事样本</span>
            <select value={selectedEvent?.id ?? ""} onChange={event => setSelectedId(event.target.value)} className="h-10 rounded-xl border border-border bg-background px-3 text-sm outline-none transition focus:border-primary/60" aria-label="选择要跟踪的赛事">
              {events.map(event => <option key={event.id} value={event.id}>{event.series} · {event.name}</option>)}
            </select>
          </label>
        </div>
        <AnimatePresence mode="wait">
          {picked ? <motion.div key={picked.id} initial={{ opacity: 0.6 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.14 }}>
            <div className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-border/60 pb-3 text-xs">
              <span className={`font-mono font-semibold ${SERIES_META[picked.series].tint}`}>{picked.series} / R{String(picked.round).padStart(2, "0")}</span>
              <span className="font-semibold">{picked.name}</span>
              <span className="text-muted-foreground">{picked.circuit} · {picked.country}</span>
              <span className="ml-auto font-mono text-[10px] text-muted-foreground">ID {picked.id}</span>
            </div>
            <div className="grid gap-3 md:grid-cols-[1fr_auto_1fr] md:items-stretch">
              <EventDataCard title="数据库 · 最近成功快照" icon={Database} sample={sourceEvent} time={currentSnapshot?.fetchedAt} source={currentSnapshot?.source ?? undefined} empty={!currentSnapshot} />
              <div className="flex items-center justify-center text-muted-foreground"><ArrowRight className="hidden size-5 md:block" /><ArrowDown className="size-5 md:hidden" /></div>
              <EventDataCard title="赛历 API · 当前响应" icon={Radio} sample={picked} time={schedule?.fetchedAt} source="GET /api/schedule" />
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px]">
              {sourceEvent ? differences.length ? <><span className="rounded-full bg-amber-400/10 px-2.5 py-1 text-amber-300">响应字段有变化</span><span className="text-muted-foreground">{differences.join("、")}</span></> : <span className="rounded-full bg-emerald-400/10 px-2.5 py-1 text-emerald-300">快照与当前响应一致</span> : <span className="rounded-full bg-secondary px-2.5 py-1 text-muted-foreground">该赛事不在最近成功快照中；可能来自赛历日期补齐、兼容条目或更新后的响应</span>}
              <span className="ml-auto text-muted-foreground">{picked.tentative ? "时间待确认；不展示估计时间" : "已确认场次时间按 UTC 保存"}</span>
            </div>
            <details className="group mt-4 rounded-xl border border-border/60 bg-background/40">
              <summary className="flex cursor-pointer list-none items-center justify-between px-3.5 py-3 text-xs text-muted-foreground"><span>查看这条记录的可见字段</span><span className="transition group-open:rotate-180">⌄</span></summary>
              <pre className="overflow-x-auto border-t border-border/50 px-3.5 py-3 font-mono text-[10px] leading-5 text-muted-foreground">{trackerJson}</pre>
            </details>
          </motion.div> : <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">当前没有可跟踪的赛事响应{scheduleError ? " · 赛历接口暂不可用" : " · 正在等待数据"}</div>}
        </AnimatePresence>
      </section>

      <section className="mb-12">
        <SectionTitle eyebrow="04 / HOW IT WORKS" title="赛历完整处理逻辑" detail="核心原则：已存在的成功快照优先服务页面，过期时异步刷新；只有成功且有赛事的数据才成为新快照。" />
        <div className="relative grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ["01", "访问触发", "构建不抓取。首页、详情或本页访问 /api/schedule 后，服务端才读取数据。"],
            ["02", "并行读快照", "并行取 F1、FE、WRC 最近成功且非空的 Neon JSONB 快照。可用时先快速响应。"],
            ["03", "后台更新", "快照超过一小时后用 Next after() 在响应后刷新；无快照才在请求中获取。无访客就不运行。"],
            ["04", "校验与回退", "上游异常、失败或空列表不覆盖好数据；有旧快照则继续返回旧数据。"],
            ["05", "只存成功结果", "成功且非空才追加快照。WRC 写入前合并历史已确认赛段，失败不写失败快照。"],
            ["06", "补齐与覆盖", "组装时补已公布的未来赛历日期、规范 F1 元数据，再按稳定 event ID 应用管理员浅覆盖。"],
            ["07", "浏览器展示", "SWR 内存数据、localStorage 分系列最近成功值、Service Worker 离线缓存各自独立。"],
            ["08", "访客补缺", "页面加载后低频借用访客网络抓公开 F1/WRC 原始内容，服务端校验后仅补缺，并在事务锁下保存。"],
          ].map(([number, title, detail]) => <motion.article key={number} initial={{ opacity: 0.94 }} whileInView={{ opacity: 1 }} viewport={{ once: true, amount: 0.25 }} transition={{ duration: 0.18 }} className="rounded-2xl border border-border/60 bg-card/25 p-4">
            <p className="font-mono text-[10px] tracking-[0.16em] text-primary">{number}</p><h3 className="mt-2 text-sm font-semibold">{title}</h3><p className="mt-2 text-xs leading-6 text-muted-foreground">{detail}</p>
          </motion.article>)}
        </div>
        <div className="mt-3 flex items-start gap-2 rounded-xl border border-amber-400/20 bg-amber-400/[0.045] px-3.5 py-3 text-[11px] leading-5 text-muted-foreground"><TriangleAlert className="mt-0.5 size-3.5 shrink-0 text-amber-300" /><p>这不是 Cron：没人访问时不会自动更新。数据库不可用时页面仍可能拿到上游数据，但快照、覆盖与配额不能持久化；不要把这种降级当成保存成功。</p></div>
      </section>

      <section className="mb-12">
        <SectionTitle eyebrow="05 / SOURCES & RULES" title="三项赛事的上游逻辑" />
        <div className="grid gap-3 lg:grid-cols-3">
          <SourceCard series="F1" title="Jolpica 优先，官网补当前赛季" points={["并行读当前年与未来两年赛历，另读上一年结果补充冠军资料。", "当前赛历失败时回退 F1 官网公开赛历；官方只公布日期就只补日期，不伪造场次时间。", "中文名、赛道规格、时区等映射由本地代码维护，不是实时抓取。", "ID 使用 f1-赛季-轮次，保留稳定关联。"]} />
          <SourceCard series="FE" title="PulseLive 赛季层级读取" points={["先发现当前及可用的未来赛季，再读取赛事和每场场次。", "当地时间按赛事 GMT 偏移换算为 UTC；日期已知但时刻缺失时只标待确认。", "练习、分组排位与正赛按产品规则筛选，单站异常不会丢掉其他站。", "ID 使用官网 race ID，避免跨赛季轮次冲突。"]} />
          <SourceCard series="WRC" title="官网目录与逐站 itinerary" points={["从当前年和未来年官网 Event Series 发现赛事，再访问 GraphQL 目录和赛事卡片。", "逐站先解析官方 itinerary Feed / FAQ，再尝试页面、预渲染 HTML 等多层回退。", "官方失败后才可选用 Blacktop Data；第三方时间标待确认，不能当官方确认。", "官网失败时保留兼容/估计数据；持久化合并会保护上次确认的真实赛段。"]} />
        </div>
      </section>

      <section className="mb-12">
        <SectionTitle eyebrow="06 / OTHER DATA" title="其他功能的数据从哪里来" detail="赛历快照是一个数据域。其他业务数据有各自的来源和缓存，不能一概说成写进 Neon。" />
        <div className="grid gap-2 md:grid-cols-2">
          <LogicRow title="历史赛果" detail="F1 Jolpica；FE 官网赛历匹配后逐站取成绩；WRC 官网索引与赛事结果优先，配置备用 key 才回退第三方。服务端/CDN 缓存，不合并进赛历快照。" />
          <LogicRow title="积分榜" detail="F1 Jolpica、WRC 官网公开端点、FE 官网积分页；由本站 API 适配并缓存。不会写入 Neon。" />
          <LogicRow title="F1 实时计时 / 发车状态" detail="展开时才请求。OpenF1 实时接口有订阅限制；发车状态另连官方 SignalR 短连接，不持久化、不复用旧场次冒充实时。" />
          <LogicRow title="天气" detail="Open-Meteo 地理编码与天气预报；城市坐标本地兜底。天气与地理编码分别缓存，不进赛历快照。" />
          <LogicRow title="预测与投票" detail="预测先占 Neon 每日额度再请求 NVIDIA NIM；失败用本地预测兜底。投票按匿名 cookie 更新 Neon 记录。" />
          <LogicRow title="翻译" detail="赛事英文名经 MyMemory 免费匿名接口翻译，Next 与浏览器缓存；只改展示，不改官方数据或数据库。" />
          <LogicRow title="反馈 / 提醒" detail="反馈与 Web Push 订阅保存在 Neon；提醒取决于浏览器 Push 支持和用户授权。" />
          <LogicRow title="赛道、图片、日历" detail="赛道资料以本地整理库为底，再并入当前赛历；图片走 Wikimedia 白名单代理。iCal 是按请求临时生成，不读写数据库。" />
        </div>
      </section>

      <section className="mb-10">
        <SectionTitle eyebrow="07 / AUTOMATIC GAP FILL" title="访客网络补缺：旁路，不是主链路" detail="这一过程和服务端主抓取分开运行。客户端失败不会阻塞页面，也不会把未知内容直接当官方数据。" />
        <div className="grid gap-3 md:grid-cols-3">
          <MiniStep n="A" title="条件满足才领取" text="页面启动约 6 秒后尝试。必须在线、页面可见且非省流量/2G；每系列约三小时一轮，数据库每天每系列最多 8 个任务。FE 暂未接入。" />
          <MiniStep n="B" title="服务端再解析核对" text="原始响应回传本站后，校验一次性令牌、赛事 ID、赛季、场次编号、日期和 UTC；客户端提交的名称等元数据不直接采用。" />
          <MiniStep n="C" title="只补缺并原子保存" text="已存在的有效 UTC 不覆盖。新补场次标记为客户端来源和待核验；拿同一系列 advisory lock，在单事务写快照、任务状态与配额。" />
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 rounded-xl border border-border/60 bg-card/20 px-4 py-3 text-[11px] text-muted-foreground">
          <span className="inline-flex items-center gap-1.5"><Clock3 className="size-3.5" />客户端最近任务每系列只展示状态摘要</span>
          {(flow?.clientCrawl ?? []).map(job => <span key={job.series}><b className={SERIES_META[job.series].tint}>{job.series}</b> · {job.status} · 补 {job.filled} 场 · {dateTime(job.receivedAt ?? job.createdAt)}</span>)}
          {!flow?.clientCrawl?.length && <span>尚无客户端任务记录或任务表未初始化</span>}
          <span className="ml-auto inline-flex items-center gap-1"><Database className="size-3.5" />没有访客就没有客户端补缺</span>
        </div>
      </section>

      <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-border/60 pt-5 text-[11px] text-muted-foreground">
        <span>监控数据 {flowUpdatedAt ? dateTime(flowUpdatedAt) : "读取中"} · 页面切到后台后暂停密集轮询</span>
        <div className="flex gap-3"><Link href="/status" className="transition hover:text-foreground">服务状态 <ExternalLink className="ml-1 inline size-3" /></Link><Link href="/" className="transition hover:text-foreground">返回赛历</Link></div>
      </footer>

      {(scheduleError || (flow && !flow.telemetryAvailable)) && <p className="mt-4 text-center text-xs text-amber-300">{scheduleError ? "当前无法读取赛历接口；稍后会继续自动重试。" : flow?.configured === false ? "未连接数据库：页面可能仍能读取上游赛历，但无法展示快照、配额或持久化状态。" : "数据库遥测暂不可用；赛历解释仍可阅读，状态读取会自动重试。"}</p>}
      <span className="sr-only" aria-live="polite">{activeRuns.length ? `当前有 ${activeRuns.length} 条数据链路正在处理` : "当前没有活跃的数据抓取任务"}</span>
    </main>
  )
}

function EventDataCard({ title, icon: Icon, sample, time, source, empty }: { title: string; icon: typeof Database; sample: DataFlowSample | null; time?: string | null; source?: string; empty?: boolean }) {
  return <article className={`min-w-0 rounded-2xl border p-4 ${empty ? "border-dashed border-border bg-background/20" : "border-border/70 bg-background/45"}`}>
    <div className="flex items-center justify-between gap-2"><h3 className="flex items-center gap-2 text-xs font-semibold"><Icon className="size-3.5 text-muted-foreground" />{title}</h3><span className="truncate font-mono text-[9px] text-muted-foreground">{source ?? "尚无来源记录"}</span></div>
    {sample ? <><p className="mt-4 text-sm font-semibold">{sample.name}</p><p className="mt-1 text-[11px] text-muted-foreground">{sample.circuit} · {sample.country} · {sample.sessionCount} 个场次</p><div className="mt-4 border-t border-border/60 pt-3"><p className="text-[10px] text-muted-foreground">主场次</p><div className="mt-1 flex flex-wrap items-center justify-between gap-2 text-xs"><span>{sample.mainSession?.name ?? "尚无场次"}</span><span className="font-mono tabular-nums">{sample.mainSession?.tentative ? "时间待确认" : sample.mainSession?.utc ?? "未提供"}</span></div></div><p className="mt-3 text-[10px] text-muted-foreground">记录时间 · {dateTime(time)}</p></> : <div className="flex min-h-28 items-center justify-center px-3 text-center text-xs leading-5 text-muted-foreground">{empty ? "暂无可用的成功快照" : "此赛事尚未出现在最近成功快照中"}</div>}
    {sample?.tentative && <p className="mt-2 text-[10px] text-amber-300">包含待确认时间，按产品规则隐藏具体估计值</p>}
  </article>
}

function SourceCard({ series, title, points }: { series: Series; title: string; points: string[] }) {
  return <article className="rounded-2xl border border-border/60 bg-card/25 p-4 sm:p-5"><div className="flex items-center gap-2"><span className={`size-1.5 rounded-full ${series === "F1" ? "bg-f1" : series === "FE" ? "bg-fe" : "bg-wrc"}`} /><p className={`font-mono text-[10px] tracking-[0.16em] ${SERIES_META[series].tint}`}>{SERIES_META[series].label}</p></div><h3 className="mt-3 text-sm font-semibold">{title}</h3><ul className="mt-3 space-y-2">{points.map(point => <li key={point} className="flex gap-2 text-xs leading-5 text-muted-foreground"><span className="mt-[7px] size-1 shrink-0 rounded-full bg-muted-foreground/60" />{point}</li>)}</ul></article>
}

function LogicRow({ title, detail }: { title: string; detail: string }) {
  return <article className="flex gap-3 rounded-xl border border-border/55 bg-card/20 p-3.5 sm:p-4"><div className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg bg-secondary text-primary"><ArrowRight className="size-3.5" /></div><div><h3 className="text-xs font-semibold">{title}</h3><p className="mt-1.5 text-xs leading-5 text-muted-foreground">{detail}</p></div></article>
}

function MiniStep({ n, title, text }: { n: string; title: string; text: string }) {
  return <article className="rounded-2xl border border-border/60 bg-card/25 p-4"><span className="font-mono text-[10px] text-primary">{n} / CLIENT SIDE</span><h3 className="mt-2 text-sm font-semibold">{title}</h3><p className="mt-2 text-xs leading-6 text-muted-foreground">{text}</p></article>
}
