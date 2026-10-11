"use client"

import { createContext, useContext, useEffect, useState, type ReactNode } from "react"
import { Eye, EyeOff, ShieldCheck } from "lucide-react"
import type { Series } from "@/lib/types"

type Preferences = { followed: Series[]; onlyFollowed: boolean; spoiler: boolean; view: "list" | "week" | "month" | "weekend" }
const defaults: Preferences = { followed: ["F1", "WRC", "FE"], onlyFollowed: false, spoiler: false, view: "list" }
const Context = createContext({ preferences: defaults, ready: false, update: (_: Partial<Preferences>) => { } })
const KEY = "racecalendar:viewer:v1"
export function ViewerPreferences({ children }: { children: ReactNode }) {
  const [preferences, setPreferences] = useState(defaults)
  const [ready, setReady] = useState(false)
  useEffect(() => {
    try {
      const value = JSON.parse(localStorage.getItem(KEY) || "null")
      if (value && typeof value === "object") setPreferences({
        followed: Array.isArray(value.followed) ? [...new Set<Series>(value.followed.filter((s: string) => ["F1", "WRC", "FE"].includes(s)))] : defaults.followed,
        onlyFollowed: value.onlyFollowed === true, spoiler: value.spoiler === true,
        view: ["list", "week", "month", "weekend"].includes(value.view) ? value.view : "list",
      })
    } catch { /* Private mode and invalid storage keep safe defaults. */ }
    setReady(true)
  }, [])
  useEffect(() => { if (ready) try { localStorage.setItem(KEY, JSON.stringify(preferences)) } catch { } }, [preferences, ready])
  return <Context.Provider value={{ preferences, ready, update: patch => setPreferences(previous => ({ ...previous, ...patch })) }}>{children}</Context.Provider>
}
export const useViewerPreferences = () => useContext(Context)

export function SpoilerSwitch() {
  const { preferences, ready, update } = useViewerPreferences()
  const enabled = preferences.spoiler
  return <button type="button" role="switch" aria-checked={enabled} aria-label="防剧透" disabled={!ready}
    onClick={() => update({ spoiler: !enabled })}
    className="group inline-flex items-center gap-2.5 rounded-full border border-border bg-card/80 px-3 py-2 text-xs transition-colors duration-300 hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-4 motion-reduce:transition-none">
    <span className="relative size-4" aria-hidden><Eye className={`absolute size-4 transition-all duration-300 motion-reduce:transition-none ${enabled ? "scale-75 opacity-0" : "scale-100 opacity-100"}`} /><EyeOff className={`absolute size-4 transition-all duration-300 motion-reduce:transition-none ${enabled ? "scale-100 opacity-100" : "scale-75 opacity-0"}`} /></span>
    <span>防剧透{enabled ? "已开启" : ""}</span><span aria-hidden className={`relative h-4 w-7 rounded-full transition-colors duration-300 motion-reduce:transition-none ${enabled ? "bg-foreground" : "bg-muted-foreground/30"}`}><span className={`absolute top-0.5 size-3 rounded-full transition-transform duration-300 motion-reduce:transition-none ${enabled ? "translate-x-3.5 bg-background" : "translate-x-0.5 bg-foreground"}`} /></span>
  </button>
}
export function SpoilerGate({ children, label = "赛果与排名" }: { children: ReactNode; label?: string }) {
  const { preferences, ready } = useViewerPreferences()
  const [revealState, setRevealState] = useState({ setting: preferences.spoiler, revealed: false })
  if (revealState.setting !== preferences.spoiler) setRevealState({ setting: preferences.spoiler, revealed: false })
  const revealed = revealState.setting === preferences.spoiler && revealState.revealed
  if (!ready || (preferences.spoiler && !revealed)) return <section className="spoiler-enter rounded-2xl border border-border bg-card p-6 text-center" aria-label={`${label}防剧透保护`}>
    <ShieldCheck className="mx-auto mb-3 size-6 text-muted-foreground" aria-hidden />
    <p className="text-sm font-medium">{label}已收起</p><p className="mt-2 text-xs text-muted-foreground">准备好看结果时，再主动揭晓。</p>
    <button type="button" disabled={!ready} onClick={() => setRevealState({ setting: preferences.spoiler, revealed: true })} className="mt-4 rounded-full border border-border px-4 py-2 text-sm transition-colors hover:bg-muted">揭晓{label}</button>
  </section>
  return <div className="spoiler-enter">{children}</div>
}
