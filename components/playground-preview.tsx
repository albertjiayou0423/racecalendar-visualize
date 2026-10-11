"use client"

import { Component, Suspense, lazy, useCallback, useEffect, useMemo, useState, type ComponentType, type ReactNode } from "react"
import { Button } from "./ui/button"
import { PlaygroundContext } from "./playground-context"
import { playgroundData } from "@/lib/playground-data"
import { componentCatalog, type CatalogProps } from "@/lib/playground-catalog"

if (typeof window !== "undefined" && window.location.pathname === "/playground/preview") {
  const nextFetch = window.fetch.bind(window)
  window.fetch = (input, init) => {
    const requested = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url, window.location.href)
    if (requested.origin === window.location.origin && !requested.pathname.startsWith("/api/")) return nextFetch(input, init)
    return Promise.reject(new TypeError("Playground preview does not make application or external network requests"))
  }
}

const loaders: Record<string, () => Promise<Record<string, unknown>>> = {
  Button: () => import("./ui/button"), EventCard: () => import("./event-card"), EventHeader: () => import("./event-header"),
  NextRacePreview: () => import("./next-race-preview"), NextSessionPill: () => import("./next-session-pill"),
  SessionTimeline: () => import("./session-timeline"), ShareCard: () => import("./share-card"),
  DeepInfo: () => import("./deep-info"), Highlights: () => import("./highlights"), WatchInfo: () => import("./watch-info"),
  AIPrediction: () => import("./ai-prediction"), PredictionVote: () => import("./prediction-vote"),
  WeekView: () => import("./week-view"), MonthView: () => import("./month-view"), StandingsChart: () => import("./standings-chart"),
  WeatherCard: () => import("./weather-card"), WeatherStrip: () => import("./weather-strip"), LiveTiming: () => import("./live-timing"),
  OfficialLiveTiming: () => import("./official-live-timing"), CircuitImage: () => import("./circuit-image"),
  WikipediaImage: () => import("./wikipedia-image"), WallpaperGenerator: () => import("./wallpaper-generator"),
  ImmersiveCountdown: () => import("./immersive-countdown"), FeedbackButton: () => import("./feedback-button"),
  FeedbackForm: () => import("./feedback-form"), NotificationManager: () => import("./notification-manager"),
  EventNotificationManager: () => import("./event-notification-manager"), ScheduleView: () => import("./schedule-view"),
  PageTransition: () => import("./page-transition"), FeDriverStandings: () => import("./fe-driver-standings"),
  LastRaceResults: () => import("./last-race-results"), AdminPanel: () => import("./admin-panel"),
  UsageGuideButton: () => import("./usage-guide"), UsageGuide: () => import("./usage-guide"),
  ClientCrawl: () => import("./client-crawl"), SWRegister: () => import("./sw-register"),
  DatabaseInspector: () => import("./database-inspector"),
}
const components = Object.fromEntries(Object.entries(loaders).map(([name, loader]) => [name, lazy(async () => {
  const module = await loader()
  return { default: module[name] as ComponentType<CatalogProps> }
})]))

class PreviewBoundary extends Component<{ children: ReactNode; revision: number }, { error: string }> {
  state = { error: "" }
  static getDerivedStateFromError(error: Error) { return { error: error.message } }
  componentDidUpdate(previous: Readonly<{ children: ReactNode; revision: number }>) {
    if (this.state.error && previous.revision !== this.props.revision) this.setState({ error: "" })
  }
  render() { return this.state.error ? <p role="alert" className="rounded-lg border border-destructive p-3 text-sm">参数无法渲染：{this.state.error}。请修正参数或选择预设。</p> : this.props.children }
}

export function PlaygroundPreview() {
  const [name, setName] = useState("")
  const [props, setProps] = useState<CatalogProps>({})
  const [now] = useState(() => Date.now())
  const [settings, setSettings] = useState({ duration: "original", easing: "original", reduced: false })
  const [notice, setNotice] = useState("")
  const [closed, setClosed] = useState(false)
  const [errorRevision, setErrorRevision] = useState(0)
  const data = useMemo(() => playgroundData("normal", now), [now])
  const contextNow = typeof props.serverTime === "number" ? props.serverTime : now
  const state = useMemo(() => ({ scenario: "normal" as const, now: contextNow, data, reduced: settings.reduced }), [contextNow, data, settings.reduced])
  useEffect(() => {
    const component = new URLSearchParams(window.location.search).get("component") || "Button"
    const entry = componentCatalog(now).find(item => item.name === component)
    if (!entry) { setNotice("没有这个组件"); return }
    setName(component); setProps(entry.presets[0].props)
    const receive = (event: MessageEvent) => {
      if (event.origin !== window.location.origin || event.source !== window.parent || event.data?.type !== "playground:props" || event.data.component !== component) return
      const next = event.data.props
      if (!next || typeof next !== "object" || Array.isArray(next)) return
      setProps(next); setErrorRevision(n => n + 1)
      setSettings({ duration: String(event.data.duration), easing: String(event.data.easing), reduced: event.data.reduced === true })
    }
    window.addEventListener("message", receive)
    window.parent.postMessage({ type: "playground:ready" }, window.location.origin)
    return () => window.removeEventListener("message", receive)
  }, [now])
  const ActualComponent = components[name]
  const duration = ["120", "180", "240", "300", "500"].includes(settings.duration) ? `${settings.duration}ms` : null
  const easing = ["ease-out", "ease-in-out", "linear"].includes(settings.easing) ? settings.easing : null
  const callback = useCallback((callbackName: string) => { setNotice(`${callbackName} 已触发`); if (callbackName === "onClose") setClosed(true) }, [])
  const callbackProps = useMemo(() => Object.fromEntries(
    (componentCatalog(now).find(entry => entry.name === name)?.callbacks ?? []).map(key => [key, () => callback(key)]),
  ), [now, name, callback])
  return <PlaygroundContext.Provider value={state}>
    <style>{`${duration ? `body * { transition-duration: ${duration} !important; animation-duration: ${duration} !important; }` : ""}${easing ? `body * { transition-timing-function: ${easing} !important; animation-timing-function: ${easing} !important; }` : ""}${settings.reduced ? "body *, body *::before, body *::after { animation: none !important; transition: none !important; scroll-behavior: auto !important; }" : ""}`}</style>
    <main className="min-w-0 p-3" onClickCapture={event => {
      const link = (event.target as HTMLElement).closest("a")
      if (link) { event.preventDefault(); event.stopPropagation(); setNotice(`链接目标：${link.getAttribute("href")}`) }
    }}>
      <p className="mb-3 text-xs text-muted-foreground">{name} · 真实组件 / 独立输入{notice && <span role="status" className="mt-1 block break-all">{notice}</span>}</p>
      <PreviewBoundary revision={errorRevision}><Suspense fallback={<p role="status" className="text-sm">加载组件…</p>}>
        {name === "PlaygroundPreview" ? <p className="text-xs text-muted-foreground">当前视口就是 PlaygroundPreview 宿主；不递归嵌套。</p>
          : closed ? <Button size="sm" variant="outline" onClick={() => setClosed(false)}>重新打开 {name}</Button>
          : ActualComponent ? <ActualComponent {...props} {...callbackProps} /> : null}
        {["ClientCrawl", "SWRegister"].includes(name) && <p className="text-xs text-muted-foreground">组件已挂载，无可视内容；预览路径不执行后台副作用。</p>}
        {name === "UsageGuideButton" && components.UsageGuide && <components.UsageGuide />}
      </Suspense></PreviewBoundary>
    </main>
  </PlaygroundContext.Provider>
}
