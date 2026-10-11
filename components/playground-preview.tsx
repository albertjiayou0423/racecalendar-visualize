"use client"

import { Component, Suspense, lazy, useMemo, type ComponentType, type ReactNode } from "react"
import { PlaygroundContext } from "./playground-context"
import { playgroundData } from "@/lib/playground-data"
import { componentCatalog, PLAYGROUND_NOW, type CatalogProps } from "@/lib/playground-catalog"

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
})])) as Record<string, React.LazyExoticComponent<ComponentType<CatalogProps>>>

class PreviewBoundary extends Component<{ children: ReactNode; resetKey: CatalogProps }, { error: string }> {
  state = { error: "" }
  static getDerivedStateFromError(error: Error) { return { error: error.message } }
  componentDidUpdate(previous: Readonly<{ children: ReactNode; resetKey: CatalogProps }>) {
    if (this.state.error && previous.resetKey !== this.props.resetKey) this.setState({ error: "" })
  }
  render() { return this.state.error ? <p role="alert" className="rounded-lg border border-destructive p-3 text-sm">组件无法显示：{this.state.error}</p> : this.props.children }
}

export function PlaygroundComponentPreview({ name, props }: { name: string; props: CatalogProps }) {
  const now = typeof props.now === "number" ? props.now : typeof props.serverTime === "number" ? props.serverTime : PLAYGROUND_NOW
  const data = useMemo(() => playgroundData("normal", now), [now])
  const state = useMemo(() => ({ scenario: "normal" as const, now, data, reduced: false }), [now, data])
  const ActualComponent = components[name]
  const callbacks = Object.fromEntries((componentCatalog(now).find(entry => entry.name === name)?.callbacks ?? []).map(key => [key, () => {}]))
  return <PlaygroundContext.Provider value={state}>
    <PreviewBoundary resetKey={props}>
      {name === "PlaygroundPreview" ? <p className="text-sm text-muted-foreground">此组件是 Playground 的挂载入口，不能在自身内部再次挂载。</p>
        : name === "ClientCrawl" || name === "SWRegister" ? <p className="text-sm text-muted-foreground">后台组件没有可视界面。</p>
            : <Suspense fallback={<p role="status" className="text-sm text-muted-foreground">组件加载中…</p>}>
              {ActualComponent ? <ActualComponent {...props} {...callbacks} {...(name === "Button" ? { onClick: () => {} } : {})} /> : null}
              {name === "UsageGuideButton" && <components.UsageGuide />}
            </Suspense>}
    </PreviewBoundary>
  </PlaygroundContext.Provider>
}
