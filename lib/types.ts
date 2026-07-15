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
  /** 转播方名称 */
  name: string
  /** 补充说明 */
  note?: string
}

export interface RaceEvent {
  id: string
  series: Series
  /** 分站赛轮次 */
  round: number
  /** 赛事名称（中文） */
  name: string
  /** 赛道 / 赛事总部 */
  circuit: string
  /** 城市 */
  locality: string
  /** 国家（中文） */
  country: string
  /** 两位国家代码，用于国旗 */
  countryCode?: string
  /** 当地 IANA 时区，例如 Asia/Shanghai */
  tz: string
  /** 各场次，按时间升序 */
  sessions: RaceSession[]
  /** 中国大陆转播方 */
  broadcaster?: Broadcaster
  /** 官方赛事页面链接 */
  url?: string
  /** 整个赛事的时间是否为估计值（未爬取到真实数据） */
  tentative?: boolean
  /** 赛道特性 */
  circuitType?: "street" | "permanent" | "hybrid" | "rally"
  /** 地区 */
  region?: "europe" | "asia" | "americas" | "middle-east" | "africa" | "oceania"
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
