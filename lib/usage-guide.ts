export type GuideStep = { selector: string; title: string; description: string; card?: string }
const step = (selector: string, title: string, description: string): GuideStep => ({ selector, title, description })
export const GUIDE_CHOICES = [
  { key: "home", label: "首页赛历", detail: "搜索、筛选与视图，然后学习赛事卡片", path: "/" },
  { key: "cards", label: "赛事卡片", detail: "直接查看首页最上面的真实赛事卡片", path: "/" },
  { key: "details", label: "赛事详情", detail: "从真实赛事卡片进入详情页面", path: "/" },
  { key: "standings", label: "积分榜", detail: "查看 F1、FE 和 WRC 官方排名，可切换赛季与榜单类别", path: "/standings" },
  { key: "results", label: "历史赛果", detail: "选择系列与赛季", path: "/results" },
  { key: "wallpaper", label: "日历壁纸", detail: "选择布局、生成与下载", path: "/wallpaper" },
  { key: "circuits", label: "赛道数据库", detail: "搜索赛道与筛选类型", path: "/circuits" },
] as const
export const CARD_GUIDE_STEPS: GuideStep[] = [
  { selector: "", card: "summary", title: "认识赛事卡片", description: "左侧显示系列与轮次，中间是赛事名称、赛道和地点。卡片有赛道图时可直观了解赛道布局。当前高亮的是首页最上面的真实赛事卡片。" },
  { selector: "", card: "time", title: "开赛时间与赛事状态", description: "首页以北京时间展示下一个场次，倒计时随之更新。LIVE 表示处于预计进行时段，已结束表示所有场次结束；状态来自时间计算，不等同于现场直播确认。" },
  { selector: "", card: "expand", title: "「详细」展开场次表", description: "点击「详细」展开卡片中的时间表，再点击日期查看当天场次。指南会展开这张卡片的实际场次；「赛事详情」则进入独立页面，是另一个入口。" },
  { selector: "", card: "sessions", title: "按日期看场次与时区", description: "每个日期可以单独展开或收起。正赛等主场次用底色和奖杯突出；手机主要展示北京时间，桌面还展示当地时间。夜赛图标按当地时间判断。" },
  { selector: "", card: "source", title: "转播、来源与 WRC 时间待确认", description: "转播栏提供观赛线索，官网入口便于核对原始赛程。有客户端补缺的卡片会显示小 i，悬停或点击可查看来源与上传时间。WRC 的「估计」标记表示未确认数据，详细场次只显示「时间待确认」，不要把估计时间当作官方安排。" },
  { selector: "", card: "live", title: "天气与 Live Timing", description: "展开卡片后，已确认主场次可显示天气；天气可能加载中、缺失或失败。预计比赛进行中才显示 Live Timing 入口，打开后查看可用的实时计时，具体数据取决于系列和上游支持。" },
  { selector: "", card: "details", title: "赛事详情、提醒与日历", description: "真实卡片的「赛事详情」进入独立页面，查看完整安排与观赛资料；那里可以设置主场次提醒或下载日历文件。通知需要浏览器授权；WRC 时间未确认时提醒和日历不可用。" },
].map(item => ({ ...item, selector: `[data-event-card] [data-guide="card-${item.card}"]` }))

export function getGuideSteps(pathname: string): GuideStep[] {
  if (pathname === "/") return [
    step('#search-input', "搜索赛事", "输入赛事名称、国家或城市，快速找到你想看的比赛。"),
    step('[aria-label="赛事系列"]', "选择赛事系列", "点击全部、F1、WRC 或 FE，筛选对应系列的赛程。"),
    step('[data-guide="views"]', "切换赛历视图", "列表逐场查看，周视图安排一周观赛，月历查看整月赛事分布。"),
    step('[aria-label="时间范围"]', "选择时间范围", "查看即将开始、全部或已结束的赛事。这个选项在列表视图中显示。"),
    step('[data-guide="advanced-filters"]', "高级筛选", "展开后可以按赛道类型和地区进一步筛选比赛。"),
    ...CARD_GUIDE_STEPS,
  ]
  if (pathname.startsWith('/event/')) return [
    step('h1', "赛事详情", "这里是当前赛事。向下可以查看场次安排、北京时间、当地时间及观赛信息。"),
    step('[data-guide="reminder"]', "设置正赛提醒", "点击后设置主场次提醒，浏览器可能请求通知权限。估计赛段时间尚未确认时，该按钮不可用。"),
    step('[data-guide="calendar"]', "加入日历", "下载日历文件，把已确认的主场次添加到日历。时间待确认时不能导出。"),
  ]
  if (pathname === '/standings') return [step('[data-guide="standings-tabs"]', "切换积分榜", "切换 F1 车手、F1 车队、WRC 和 FE 排名。WRC 榜单支持切换赛季及车手、领航员、制造商等类别。")]
  if (pathname === '/results') return [step('[data-guide="results-series"]', "选择赛果系列", "在 F1 和 FE 之间切换。WRC 暂未接入完整赛果，可通过赛事详情前往官网查看。"), step('select', "选择赛季", "切换年份，回看该赛季的比赛结果。")]
  if (pathname === '/wallpaper') return [step('[data-guide="wallpaper-month"]', "选择壁纸月份", "选择年份和月份，生成对应月份的赛事日历壁纸。"), step('[data-guide="wallpaper-mode"]', "选择壁纸布局", "手机布局展示当月赛历，桌面布局展示全年赛历。"), step('[data-guide="wallpaper-generate"]', "生成壁纸", "点击后生成当前设置的壁纸。完成后会出现下载按钮。"), step('[data-guide="wallpaper-download"]', "下载壁纸", "点击保存已生成的壁纸，再到设备设置中设为壁纸。")]
  if (pathname === '/circuits') return [step('input[placeholder="搜索赛道名称、城市、国家..."]', "搜索赛道", "输入赛道名称、城市或国家，缩小赛道列表。"), step('[data-guide="circuit-filters"]', "筛选赛道类型", "按街道、永久赛道等类型筛选，了解不同类型的比赛场地。")]
  if (pathname === '/about') return [step('[data-guide="version"]', "当前版本", "这里显示当前应用版本。"), step('[data-guide="changelog"]', "更新日志", "查看各版本新增功能、改进和修复，最新记录位于顶部。")]
  return [step('h1', "当前页面", "这里介绍当前页面的功能。可以使用页面上的按钮探索，或通过返回入口回到赛历首页。")]
}

export type GuideRect = { top: number; left: number; width: number; height: number }
export function guidePanelPosition(rect: GuideRect | null, viewport: { width: number; height: number }, height: number, preferredWidth = 360) {
  const width = Math.min(preferredWidth, Math.max(0, viewport.width - 32))
  const maxHeight = Math.max(0, viewport.height - 32)
  const panelHeight = Math.min(height, maxHeight)
  if (!rect) return { left: (viewport.width - width) / 2, top: (viewport.height - panelHeight) / 2, width, maxHeight }
  const left = Math.max(16, Math.min(rect.left + rect.width / 2 - width / 2, viewport.width - width - 16))
  const below = rect.top + rect.height + 14
  const above = rect.top - panelHeight - 14
  const top = below + panelHeight <= viewport.height - 16 ? below : above >= 16 ? above : Math.max(16, viewport.height - panelHeight - 16)
  return { left, top, width, maxHeight }
}
