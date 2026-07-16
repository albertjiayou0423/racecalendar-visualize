// Live Timing 数据类型定义

export interface LiveTimingDriver {
  position: number
  driverNumber: string
  driverCode: string
  driverName: string
  team: string
  teamColor?: string
  gap: string
  interval: string
  lastLap: string
  bestLap: string
  tyre?: string
  laps: number
  pitStops: number
  retired: boolean
}

export interface LiveTimingData {
  series: "F1" | "FE" | "WRC"
  sessionName: string
  status: "scheduled" | "live" | "finished" | "delayed"
  totalLaps?: number
  currentLap?: number
  timeRemaining?: string
  trackTemp?: number
  airTemp?: number
  weather?: string
  safetyCar: boolean
  virtualSafetyCar: boolean
  redFlag: boolean
  drivers: LiveTimingDriver[]
  lastUpdated: string
  source: string
}

export interface WRCStageResult {
  position: number
  driverName: string
  codriverName?: string
  car: string
  time: string
  gap: string
  stageName: string
  stageNumber: number
  totalStages: number
}

export interface WRCLiveTiming {
  series: "WRC"
  rallyName: string
  currentStage?: string
  status: "scheduled" | "live" | "finished" | "delayed"
  stageResults: WRCStageResult[]
  overallResults: WRCStageResult[]
  lastUpdated: string
  source: string
}

// OpenF1 API 类型
export interface OpenF1Position {
  date: string
  driver_number: number
  meeting_key: number
  position: number
  session_key: number
}

export interface OpenF1Lap {
  date_start: string
  driver_number: number
  duration_sector_1: number | null
  duration_sector_2: number | null
  duration_sector_3: number | null
  i1_speed: number | null
  i2_speed: number | null
  is_pit_out_lap: boolean
  lap_duration: number | null
  lap_number: number
  meeting_key: number
  session_key: number
}

export interface OpenF1Driver {
  driver_number: number
  broadcast_name: string
  full_name: string
  name_acronym: string
  team_name: string
  team_colour: string | null
  meeting_key: number
  session_key: number
}

export interface OpenF1Session {
  session_key: number
  session_name: string
  session_type: string
  date_start: string
  date_end: string
  meeting_key: number
  circuit_key: number | null
  circuit_short_name: string | null
  country_name: string | null
  meeting_name: string | null
  gmt_offset: string
  year: number
}

// 格式化时间差
export function formatGap(seconds: number | null): string {
  if (seconds === null || seconds === undefined) return "—"
  if (seconds === 0) return "—"
  const abs = Math.abs(seconds)
  const mins = Math.floor(abs / 60)
  const secs = abs % 60
  const sign = seconds < 0 ? "-" : "+"
  if (mins > 0) {
    return `${sign}${mins}:${secs.toFixed(3).padStart(6, "0")}`
  }
  return `${sign}${secs.toFixed(3)}`
}

// 格式化圈速
export function formatLapTime(seconds: number | null): string {
  if (seconds === null || seconds === undefined) return "—"
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins}:${secs.toFixed(3).padStart(6, "0")}`
}

// 判断赛事是否正在进行中
export function isSessionLive(startUtc: string, endUtc: string, now: number): boolean {
  const start = new Date(startUtc).getTime()
  const end = new Date(endUtc).getTime()
  return now >= start && now <= end
}

// 判断赛事是否即将开始（30分钟内）
export function isSessionUpcoming(startUtc: string, now: number): boolean {
  const start = new Date(startUtc).getTime()
  return start > now && start - now < 30 * 60 * 1000
}
