import { playgroundData } from "./playground-data"

export type CatalogProps = Record<string, unknown>
export const PLAYGROUND_NOW = Date.parse("2026-10-11T00:00:00.000Z")
export interface CatalogEntry {
  name: string
  file: string
  description: string
  callbacks?: string[]
  presets: { label: string; props: CatalogProps }[]
}

/** Sample values are component inputs, never a second implementation of the UI. */
export function componentCatalog(now: number): CatalogEntry[] {
  const events = playgroundData("normal", now).events
  const event = {
    ...events[0], name: "中国大奖赛", circuit: "上海国际赛车场",
    lat: 31.34, lon: 121.22, url: "https://www.formula1.com/",
    circuitInfo: { length: "5.451 km", laps: "56" },
    lastYearWinner: { driver: "Oscar Piastri", constructor: "McLaren" },
    lastYearFastestLap: { driver: "Lando Norris", time: "1:35.454", lap: "42" },
    highlights: { track: "长直道与连续弯道", championship: "积分争夺", drivers: "关注轮胎策略" },
    extraInfo: [{ label: "轮胎", value: "硬 / 中 / 软" }],
    broadcaster: { name: "赛事转播", url: "https://www.formula1.com/", confirmed: true, note: "请以官方安排为准" },
    broadcasters: [], countryCode: "CN", circuitImageUrl: "/circuits/united-states_track_2026trackaustindetailed.webp",
    wikipediaUrl: "https://en.wikipedia.org/wiki/Shanghai", circuitWikipediaUrl: "https://en.wikipedia.org/wiki/Shanghai_International_Circuit",
    broadcastCheckedAt: new Date(now).toISOString(), eventSlug: "china", liveTimingUrl: "https://www.wrc.com/",
  }
  const wrc = { ...event, ...events[1], name: "拉力赛", tentative: true,
    sessions: events[1].sessions.map(s => ({ ...s, tentative: true })) }
  const long = { ...event, name: "中国大奖赛 · 上海国际赛车场赛季特别站超长名称排版检查", clientData: { uploadedAt: new Date(now).toISOString(), sourceUrl: "https://www.formula1.com/", sessions: ["正赛"] } }
  const entries: CatalogEntry[] = []
  function add(name: string, file: string, description: string, props: CatalogProps, alternate?: CatalogProps, third?: CatalogProps, callbacks?: string[]) {
    entries.push({ name, file: `components/${file}.tsx`, description, callbacks,
      presets: [{ label: "默认", props }, { label: "变体", props: alternate ?? props }, { label: "边界", props: third ?? props }] })
  }
  add("Button", "ui/button", "基础按钮；还可在完整 props 中添加 aria-label、title、className 等原生按钮属性。", { children: "加入日历", variant: "default", size: "default", disabled: false }, { children: "查看详情", variant: "outline", size: "sm", disabled: false }, { children: "不可用", variant: "secondary", size: "lg", disabled: true }, ["onClick"])
  for (const [name, file] of [["EventCard", "event-card"], ["EventHeader", "event-header"], ["NextRacePreview", "next-race-preview"], ["NextSessionPill", "next-session-pill"], ["SessionTimeline", "session-timeline"], ["ShareCard", "share-card"]]) {
    add(name, file, "event 的所有字段可在右侧展开编辑；now 为判断状态的时间戳。", { event, now }, { event: wrc, now }, { event: long, now: now + 86400000 }, name === "EventHeader" ? ["onSetNotification"] : undefined)
  }
  for (const [name, file] of [["DeepInfo", "deep-info"], ["Highlights", "highlights"], ["WatchInfo", "watch-info"], ["AIPrediction", "ai-prediction"], ["PredictionVote", "prediction-vote"]]) {
    add(name, file, "直接接收 RaceEvent；外部请求在预览中被阻止，显示组件自身的失败或空状态。", { event }, { event: wrc }, { event: { ...event, highlights: {}, extraInfo: [], broadcaster: undefined, broadcasters: [], lastYearWinner: undefined, lastYearFastestLap: undefined, circuitInfo: undefined } })
  }
  for (const [name, file] of [["WeekView", "week-view"], ["MonthView", "month-view"]]) {
    add(name, file, "events 数组和 now 可调；点击日期和切换月份仍使用正式交互。", { events, now }, { events: playgroundData("busy", now).events, now }, { events: [], now })
  }
  add("StandingsChart", "standings-chart", "可编辑标题、车手名称、积分及胜场。", { title: "车手积分", data: [{ name: "车手 A", shortName: "AAA", points: 120, wins: 3 }, { name: "车手 B", shortName: "BBB", points: 98, wins: 2 }] }, { title: "胜场对比", data: [{ name: "车手 A", shortName: "AAA", points: 400, wins: 12 }] }, { title: "空数据", data: [] })
  add("WeatherCard", "weather-card", "外部天气请求不执行；compact 控制紧凑布局。", { city: "上海", country: "中国", date: new Date(now).toISOString(), startTime: new Date(now).toISOString(), lat: 31.34, lon: 121.22, compact: false }, { city: "上海", country: "中国", date: new Date(now).toISOString(), startTime: new Date(now).toISOString(), compact: true }, { city: "未提供城市", country: "", date: new Date(now).toISOString(), startTime: new Date(now).toISOString(), compact: false })
  add("WeatherStrip", "weather-strip", "逐场次天气条；外部请求被阻止。", { city: "上海", country: "中国", lat: 31.34, lon: 121.22, sessions: event.sessions }, { city: "上海", country: "中国", sessions: event.sessions.slice(0, 1) }, { city: "上海", country: "中国", sessions: [] })
  add("LiveTiming", "live-timing", "系列、名称和展开状态；不请求计时服务。", { series: "F1", eventName: event.name, isExpanded: true }, { series: "WRC", eventName: "拉力赛", isExpanded: true }, { series: "FE", eventName: "电动方程式", isExpanded: false })
  add("OfficialLiveTiming", "official-live-timing", "官方入口；disabled 为 true 时组件不渲染。", { url: "https://www.wrc.com/", eventName: "拉力赛", disabled: false }, { url: "https://www.formula1.com/", eventName: event.name, disabled: false }, { url: "https://www.wrc.com/", eventName: "拉力赛", disabled: true })
  add("CircuitImage", "circuit-image", "本地赛道资源、替代文字、样式与最大高度。", { src: event.circuitImageUrl, alt: "赛道图", className: "", maxHeight: 180 }, { src: event.circuitImageUrl, alt: "赛道图", className: "rounded-xl", maxHeight: 100 }, { src: "/circuits/not-found.webp", alt: "缺失图片", maxHeight: 180 })
  add("WikipediaImage", "wikipedia-image", "维基图片依赖外部 API，预览展示实际缺图状态。", { url: event.wikipediaUrl, maxHeight: 200 }, { url: event.circuitWikipediaUrl, maxHeight: 100 }, { url: "", maxHeight: 200 })
  add("WallpaperGenerator", "wallpaper-generator", "月份使用 1–12；事件数组、月份与年份均可编辑。", { events, month: new Date(now).getMonth() + 1, year: new Date(now).getFullYear() }, { events: playgroundData("busy", now).events, month: new Date(now).getMonth() + 1, year: new Date(now).getFullYear() }, { events: [], month: 1, year: 2027 })
  add("ImmersiveCountdown", "immersive-countdown", "targetTime 为 UTC ISO；isRace 启用 F1 正赛实时状态，预览可重播最后十秒；previewFrameMs=-1 正常播放，0–1800 暂停查看归零动画。", { targetTime: new Date(now + 90000).toISOString(), series: "F1", isRace: true, previewFrameMs: -1, title: "正赛倒计时" }, { targetTime: new Date(now + 7200000).toISOString(), series: "FE", isRace: true, previewFrameMs: -1, title: "电动方程式正赛" }, { targetTime: new Date(now + 172800000).toISOString(), series: "WRC", isRace: false, previewFrameMs: -1, title: "拉力赛段" }, ["onClose"])
  add("FeedbackButton", "feedback-button", "没有公开 props；按钮文案与弹窗交互由正式组件内部管理。", {}, {}, {})
  add("FeedbackForm", "feedback-form", "行内表单预览；填写和校验使用真实表单，关闭后可重新打开，预览不会提交。", {}, {}, {}, ["onClose"])
  add("NotificationManager", "notification-manager", "可调 events；预览只展示设置，不读写提醒偏好或请求系统权限。", { events }, { events: [wrc] }, { events: [] })
  add("EventNotificationManager", "event-notification-manager", "行内提醒设置预览；关闭后可重新打开，不发送系统通知。", { event }, { event: wrc }, { event: long }, ["onClose"])
  add("ScheduleView", "schedule-view", "组合组件只公开 serverTime；作为单个组件列出，不再是测试台的整页模拟入口。", { serverTime: now }, { serverTime: now + 86400000 }, { serverTime: now - 86400000 })
  add("PageTransition", "page-transition", "children 是 ReactNode；编辑器支持文字，实际使用也可传 JSX。", { children: "页面内容" }, { children: "另一段内容" }, { children: "" })
  for (const [name, file, description] of [
    ["FeDriverStandings", "fe-driver-standings", "无公开 props；依赖 FE 接口，预览保留实际加载失败状态。"],
    ["LastRaceResults", "last-race-results", "无公开 props；依赖外部赛果接口，预览不连接服务。"],
    ["AdminPanel", "admin-panel", "无公开 props；实际登录界面，所有管理请求均被阻止。"],
    ["UsageGuideButton", "usage-guide", "无公开 props；真实指南入口。"],
    ["UsageGuide", "usage-guide", "无公开 props；可打开实际选择菜单，跨页面指南需对应页面的真实锚点。"],
    ["ClientCrawl", "client-crawl", "后台副作用组件，没有可视内容或公开 props；Playground 路由不会执行采集。"],
    ["SWRegister", "sw-register", "后台副作用组件，没有可视内容或公开 props；预览不注册 Service Worker。"],
    ["PlaygroundPreview", "playground-preview", "测试台宿主，没有公开 props；不递归嵌套自身。"],
  ]) add(name, file, description, {}, {}, {})
  add("DatabaseInspector", "database-inspector", "只有 onUnauthorized 回调；预览不读取数据库，保留实际错误界面。", {}, {}, {}, ["onUnauthorized"])
  return entries
}
