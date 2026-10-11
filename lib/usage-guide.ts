export type GuideStep = { selector: string; title: string; description: string }
const step = (selector: string, title: string, description: string): GuideStep => ({ selector, title, description })
const launcher = step('[data-guide="usage-launcher"]', "随时重看本页指南", "点击这个胶囊，可以重新查看当前页面的按钮介绍。引导不会修改你的筛选或设置。")

export function getGuideSteps(pathname: string): GuideStep[] {
  if (pathname === "/") return [
    step('#search-input', "搜索赛事", "输入赛事名称、国家或城市，快速找到你想看的比赛。"),
    step('[aria-label="赛事系列"]', "选择赛事系列", "点击全部、F1、WRC 或 FE，筛选对应系列的赛程。"),
    step('[data-guide="views"]', "切换赛历视图", "列表逐场查看，周视图安排一周观赛，月历查看整月赛事分布。"),
    step('[aria-label="时间范围"]', "选择时间范围", "查看即将开始、全部或已结束的赛事。这个选项在列表视图中显示。"),
    step('[data-guide="advanced-filters"]', "高级筛选", "展开后可以按赛道类型和地区进一步筛选比赛。"),
    step('[data-event-card]', "查看赛事安排", "展开卡片查看场次，进入赛事详情了解当地时间、转播和提醒。WRC 估计赛段会显示「时间待确认」。"),
    step('a[href="/standings"]', "积分榜", "从这里查看 F1 车手、车队和 FE 的赛季积分。"),
    step('a[href="/results"]', "历史赛果", "查看已结束比赛的结果，进入页面后可选择系列和赛季。"),
    step('a[href="/wallpaper"]', "壁纸生成", "选择月份，预览并下载赛事日历壁纸。"),
    step('a[href="/circuits"]', "赛道数据库", "搜索赛道、城市或国家，浏览赛道资料。"),
    step('a[href="/about"]', "版本与更新", "查看当前版本、新增功能和修复记录。"),
    step('a[href="/developer"]', "开发者信息", "了解项目和开发者信息。"), launcher,
  ]
  if (pathname.startsWith('/event/')) return [
    step('h1', "赛事详情", "这里是当前赛事。向下可以查看场次安排、北京时间、当地时间及观赛信息。"),
    step('[data-guide="reminder"]', "设置正赛提醒", "点击后设置主场次提醒，浏览器可能请求通知权限。估计赛段时间尚未确认时，该按钮不可用。"),
    step('[data-guide="calendar"]', "加入日历", "下载日历文件，把已确认的主场次添加到日历。时间待确认时不能导出。"), launcher,
  ]
  if (pathname === '/standings') return [step('[data-guide="standings-tabs"]', "切换积分榜", "在 F1 车手、F1 车队与 FE 之间切换，查看对应排名和积分。"), launcher]
  if (pathname === '/results') return [step('[data-guide="results-series"]', "选择赛果系列", "在 F1 和 FE 之间切换。WRC 暂未接入完整赛果，可通过赛事详情前往官网查看。"), step('select', "选择赛季", "切换年份，回看该赛季的比赛结果。"), launcher]
  if (pathname === '/wallpaper') return [step('[data-guide="wallpaper-month"]', "选择壁纸月份", "选择年份和月份，生成对应月份的赛事日历壁纸。"), step('[data-guide="wallpaper-mode"]', "选择壁纸布局", "手机布局展示当月赛历，桌面布局展示全年赛历。"), step('[data-guide="wallpaper-generate"]', "生成壁纸", "点击后生成当前设置的壁纸。完成后会出现下载按钮。"), step('[data-guide="wallpaper-download"]', "下载壁纸", "点击保存已生成的壁纸，再到设备设置中设为壁纸。"), launcher]
  if (pathname === '/circuits') return [step('input[placeholder="搜索赛道名称、城市、国家..."]', "搜索赛道", "输入赛道名称、城市或国家，缩小赛道列表。"), step('[data-guide="circuit-filters"]', "筛选赛道类型", "按街道、永久赛道等类型筛选，了解不同类型的比赛场地。"), launcher]
  if (pathname === '/about') return [step('[data-guide="version"]', "当前版本", "这里显示当前应用版本。"), step('[data-guide="changelog"]', "更新日志", "查看各版本新增功能、改进和修复，最新记录位于顶部。"), launcher]
  return [step('h1', "当前页面", "这里介绍当前页面的功能。可以使用页面上的按钮探索，或通过返回入口回到赛历首页。"), launcher]
}

export type GuideRect = { top: number; left: number; width: number; height: number }
export function guidePanelPosition(rect: GuideRect | null, viewport: { width: number; height: number }, height: number) {
  const width = Math.min(360, Math.max(0, viewport.width - 32))
  const maxHeight = Math.max(0, viewport.height - 32)
  const panelHeight = Math.min(height, maxHeight)
  if (!rect) return { left: (viewport.width - width) / 2, top: (viewport.height - panelHeight) / 2, width, maxHeight }
  const left = Math.max(16, Math.min(rect.left + rect.width / 2 - width / 2, viewport.width - width - 16))
  const below = rect.top + rect.height + 14
  const above = rect.top - panelHeight - 14
  const top = below + panelHeight <= viewport.height - 16 ? below : above >= 16 ? above : Math.max(16, viewport.height - panelHeight - 16)
  return { left, top, width, maxHeight }
}
