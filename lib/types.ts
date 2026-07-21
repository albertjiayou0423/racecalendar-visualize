export type Series = "F1" | "WRC" | "FE"

export interface RaceSession {
  /** 场次名称（中文） */
  name: string
  /** 该场次的 UTC 开始时间，ISO 字符串 */
  utc: string
  /** 是否为主赛事（正赛/决胜赛段），用于高亮和直播提示 */
  isMain?: boolean
  /** 场次时间是否为待确认/估计值 */
  tentative?: boolean
}

export interface Broadcaster {
  name: string
  note?: string
  /** 观看链接 */
  url?: string
  /** 是否确认 */
  confirmed?: boolean
}

export interface RaceEvent {
  id: string
  series: Series
  round: number
  name: string
  circuit: string
  locality: string
  country: string
  countryCode?: string
  tz: string
  sessions: RaceSession[]
  broadcaster?: Broadcaster
  /** 多个转播方 */
  broadcasters?: Broadcaster[]
  url?: string
  tentative?: boolean
  circuitType?: "street" | "permanent" | "hybrid" | "rally"
  region?: "europe" | "asia" | "americas" | "middle-east" | "africa" | "oceania"
  lat?: number
  lon?: number
  circuitImageUrl?: string
  wikipediaUrl?: string
  circuitWikipediaUrl?: string
  lastYearWinner?: {
    driver: string
    constructor: string
  }
  lastYearFastestLap?: {
    driver: string
    time: string
    lap: string
  }
  circuitInfo?: {
    length: string
    laps: string
  }
  extraInfo?: {
    label: string
    value: string
  }[]
  /** 比赛看点（3条） */
  highlights?: {
    track?: string
    championship?: string
    drivers?: string
  }
  /** 直播信息最后核验时间 */
  broadcastCheckedAt?: string
  /** 官方 Live Timing 页面链接（WRC 专用） */
  liveTimingUrl?: string
  /** 赛事 slug（用于生成官方链接） */
  eventSlug?: string
}

export interface ScheduleResponse {
  events: RaceEvent[]
  /** 各系列的数据来源与获取状态 */
  sources: {
    series: Series
    label: string
    ok: boolean
    note?: string
  }[]
  /** 数据生成时间（UTC ISO） */
  fetchedAt: string
}
