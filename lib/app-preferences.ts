"use client"

import { useEffect, useState } from "react"

export type HomeClockMode = "user" | "utc"
export type HomeViewMode = "list" | "week" | "month" | "weekend"

export type AppPreferences = {
  homeClockMode: HomeClockMode
  defaultHomeView: HomeViewMode
  autoImmersiveCountdown: boolean
}

const STORAGE_KEY = "racecalendar-app-preferences-v1"
const DEFAULT_PREFERENCES: AppPreferences = {
  homeClockMode: "user",
  defaultHomeView: "list",
  autoImmersiveCountdown: true,
}

export function readAppPreferences(): AppPreferences {
  if (typeof window === "undefined") return DEFAULT_PREFERENCES
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}") as Partial<AppPreferences>
    const savedClockMode = (saved as Record<string, unknown>).homeClockMode
    return {
      // Migrate the earlier event-local clock choice to the new site-wide UTC mode.
      homeClockMode: savedClockMode === "utc" || savedClockMode === "event" ? "utc" : "user",
      defaultHomeView: ["list", "week", "month", "weekend"].includes(saved.defaultHomeView ?? "")
        ? saved.defaultHomeView as HomeViewMode
        : "list",
      autoImmersiveCountdown: typeof saved.autoImmersiveCountdown === "boolean"
        ? saved.autoImmersiveCountdown
        : true,
    }
  } catch {
    return DEFAULT_PREFERENCES
  }
}

export function updateAppPreferences(patch: Partial<AppPreferences>) {
  if (typeof window === "undefined") return
  const next = { ...readAppPreferences(), ...patch }
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  } catch {
    // Storage may be unavailable; keep the current page functional via the event below.
  }
  window.dispatchEvent(new CustomEvent<AppPreferences>("racecalendar:app-preferences-change", { detail: next }))
}

export function useAppPreferences() {
  const [preferences, setPreferences] = useState<AppPreferences>(DEFAULT_PREFERENCES)
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    const refresh = (event?: Event) => {
      const detail = (event as CustomEvent<AppPreferences> | undefined)?.detail
      setPreferences(detail ?? readAppPreferences())
    }
    refresh()
    setHydrated(true)
    window.addEventListener("racecalendar:app-preferences-change", refresh)
    return () => window.removeEventListener("racecalendar:app-preferences-change", refresh)
  }, [])

  return { preferences, updatePreferences: updateAppPreferences, hydrated }
}
