"use client"
import { createContext, useContext } from "react"
import type { ScheduleResponse } from "@/lib/types"
export type PlaygroundScenario = "normal" | "loading" | "empty" | "error" | "offline" | "tentative" | "long" | "busy"
export interface PlaygroundState { scenario: PlaygroundScenario; now: number; data: ScheduleResponse; reduced: boolean }
export const PlaygroundContext = createContext<PlaygroundState | null>(null)
export const usePlayground = () => useContext(PlaygroundContext)
