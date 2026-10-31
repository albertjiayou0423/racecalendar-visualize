"use client"

import { browserTimeoutSignal } from "@/lib/browser-abort"

import { useEffect, useState } from "react"
import useSWR from "swr"
import type { ScheduleResponse } from "@/lib/types"
import { mergeScheduleWithClientCache, parseClientScheduleCache, scheduleFromClientCache } from "@/lib/client-schedule-cache"

export async function apiJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { ...init, cache: "no-store", signal: init?.signal ?? browserTimeoutSignal(20000) })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok || payload.ok === false) throw new Error(payload.message || payload.note || payload.error || (response.status === 401 ? "管理员会话已过期，请重新登录" : "暂时无法获取数据，请重试"))
  return payload as T
}
export function readCache() {
  try {
    const cache = parseClientScheduleCache(localStorage.getItem("schedule-cache-v2")) ?? parseClientScheduleCache(localStorage.getItem("schedule-cache"))
    return cache && Object.values(cache.series).some(value => value?.events.length) ? cache : null
  } catch { return null }
}
async function scheduleFetcher(url: string) {
  try {
    const data = await apiJson<ScheduleResponse>(url)
    if (!Array.isArray(data.events) || !Array.isArray(data.sources)) throw new Error("赛历数据格式异常")
    const merged = mergeScheduleWithClientCache(data, readCache())
    try { localStorage.setItem("schedule-cache-v2", JSON.stringify(merged.cache)) } catch { /* In-memory data stays usable. */ }
    return merged.response
  } catch (error) {
    const cached = readCache()
    if (cached) return scheduleFromClientCache(cached, true)
    throw error
  }
}
export function useSimpleSchedule() {
  const [cached, setCached] = useState<ScheduleResponse>()
  useEffect(() => { const data = readCache(); if (data) setCached(scheduleFromClientCache(data)) }, [])
  return useSWR("/api/schedule", scheduleFetcher, { fallbackData: cached, revalidateOnFocus: false, shouldRetryOnError: false })
}
export function useSimpleClock(initial = 0) {
  const [now, setNow] = useState(initial)
  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | undefined
    const visibility = () => { clearInterval(timer); if (!document.hidden) { setNow(Date.now()); timer = setInterval(() => setNow(Date.now()), 1000) } }
    visibility(); document.addEventListener("visibilitychange", visibility)
    return () => { clearInterval(timer); document.removeEventListener("visibilitychange", visibility) }
  }, [])
  return now
}
export function useSimpleFavorites() {
  const [ids, setIds] = useState<string[]>([])
  const [persisted, setPersisted] = useState(true)
  useEffect(() => {
    const sync = () => { try { const data: unknown = JSON.parse(localStorage.getItem("race_calendar_favorites") || "[]"); setIds(Array.isArray(data) ? data.filter((value): value is string => typeof value === "string") : []) } catch { setPersisted(false) } }
    sync(); window.addEventListener("storage", sync)
    return () => window.removeEventListener("storage", sync)
  }, [])
  function toggle(id: string) {
    const next = ids.includes(id) ? ids.filter(value => value !== id) : [...ids, id]
    setIds(next)
    try { localStorage.setItem("race_calendar_favorites", JSON.stringify(next)) } catch { setPersisted(false) }
  }
  return { ids, toggle, persisted }
}
