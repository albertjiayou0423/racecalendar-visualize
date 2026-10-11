"use client"
import { useEffect, useMemo, useState } from "react"
import { EventCard } from "./event-card"
import { ScheduleView } from "./schedule-view"
import { WeekView } from "./week-view"
import { MonthView } from "./month-view"
import { NextRacePreview } from "./next-race-preview"
import { ImmersiveCountdown } from "./immersive-countdown"
import { FeedbackButton } from "./feedback-button"
import { Button } from "./ui/button"
import { PlaygroundContext, type PlaygroundScenario } from "./playground-context"
import { playgroundData, PLAYGROUND_SCENARIOS } from "@/lib/playground-data"
import type { Series } from "@/lib/types"

export function PlaygroundPreview() {
  const [query, setQuery] = useState<URLSearchParams | null>(null)
  const [now] = useState(() => Date.now())
  const [running, setRunning] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const [immersive, setImmersive] = useState(false)
  const [target, setTarget] = useState("")
  const [notice, setNotice] = useState("")
  useEffect(() => setQuery(new URLSearchParams(window.location.search)), [])
  useEffect(() => { if (!running) return; const start = Date.now() - elapsed * 1000; const timer = window.setInterval(() => setElapsed(Math.floor((Date.now() - start) / 1000)), 1000); return () => window.clearInterval(timer) }, [running])
  const rawScenario = query?.get("scenario") || "normal"
  const scenario = PLAYGROUND_SCENARIOS.includes(rawScenario as PlaygroundScenario) ? rawScenario as PlaygroundScenario : "normal"
  const data = useMemo(() => playgroundData(scenario, now), [scenario, now])
  const reduced = query?.get("reduced") === "true"
  const state = useMemo(() => ({ scenario, now, data, reduced }), [scenario, now, data, reduced])
  if (!query) return null
  const duration = ["120", "180", "240", "300", "500"].includes(query.get("duration") || "") ? `${query.get("duration")}ms` : null
  const easing = ["ease-out", "ease-in-out", "linear"].includes(query.get("easing") || "") ? query.get("easing") : null
  const seconds = Math.max(0, Math.min(172800, Number(query.get("seconds")) || 0))
  const series = ["F1", "WRC", "FE"].includes(query.get("series") || "") ? query.get("series") as Series : "F1"
  const event = data.events.find(e => e.series === series)
  const countdownEvent = event ? { ...event, sessions: [{ name: "正赛", isMain: true, utc: new Date(now + seconds * 1000).toISOString() }] } : undefined
  const component = query.get("component")
  return <PlaygroundContext.Provider value={state}>
    <style>{`${duration ? `body * { transition-duration: ${duration} !important; animation-duration: ${duration} !important; }` : ""}${easing ? `body * { transition-timing-function: ${easing} !important; animation-timing-function: ${easing} !important; }` : ""}${reduced ? "body *, body *::before, body *::after { animation: none !important; transition: none !important; scroll-behavior: auto !important; }" : ""}`}</style>
    <div className="border-b border-border px-4 py-2 text-xs text-muted-foreground">正式组件 · 隔离预览 · 数据为测试场景{notice && <p role="status" className="mt-1 break-all">{notice}</p>}</div>
    <div onClickCapture={e => { const link = (e.target as HTMLElement).closest("a"); if (link) { e.preventDefault(); e.stopPropagation(); setNotice(`导航预览：${link.getAttribute("href")}。隔离视口保持在测试台。`) } }}>
    {component === "schedule" ? <ScheduleView serverTime={now} /> : <main className="mx-auto max-w-3xl space-y-4 p-4">
      {["loading", "error", "empty", "offline"].includes(scenario) && <ScheduleView serverTime={now} />}
      {!["loading", "error", "empty"].includes(scenario) && <>
        {component === "card" && event && <EventCard event={event} now={now} />}
        {component === "week" && <WeekView events={data.events} now={now} />}
        {component === "month" && <MonthView events={data.events} now={now} />}
        {component === "feedback" && <FeedbackButton />}
        {component === "countdown" && countdownEvent && <><div className="flex gap-2"><Button size="sm" onClick={() => setRunning(v => !v)}>{running ? "暂停" : "开始"}</Button><Button variant="outline" size="sm" onClick={() => { setRunning(false); setElapsed(0) }}>重置倒计时</Button></div><NextRacePreview event={countdownEvent} now={now + elapsed * 1000} /></>}
        {component === "immersive" && <><Button onClick={() => { setTarget(new Date(Date.now() + seconds * 1000).toISOString()); setImmersive(true) }}>进入沉浸式</Button>{immersive && <ImmersiveCountdown targetTime={target} series={series} onClose={() => setImmersive(false)} />}</>}
      </>}
    </main>}
    </div>
  </PlaygroundContext.Provider>
}
