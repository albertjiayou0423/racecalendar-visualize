"use client"

import { ArrowLeft, Sparkles, Bug, Zap, Info, Shield } from "lucide-react"
import Link from "@/components/edition-link"

type ChangelogEntry = {
  version: string
  date: string
  items: { type: "feat" | "fix" | "perf" | "ui" | "refactor"; text: string }[]
}

const changelog: ChangelogEntry[] = [
  {
    version: "v2.3.3",
    date: "2026-10-31",
    items: [
      { type: "feat", text: "F1、FE 继续提前获取未来赛事已公布的练习、排位与正赛时间；未公布的时间保持待确认" },
      { type: "feat", text: "WRC 行程提前检查当前年及未来两年已发现的赛事，不再等到开赛前 45 天；官方发布时间表后自动以已确认赛段时间替换待确认数据" },
      { type: "fix", text: "修复待确认的 WRC 兼容赛段阻止官网行程抓取的问题；未来两年不调用有额度限制的第三方回退" },
    ],
  },
  {
    version: "v2.3.2",
    date: "2026-10-31",
    items: [
      { type: "ui", text: "新增 14 项现成动效预设，正式界面仅按场景使用加载、搜索校验、收藏确认和指南反馈；保留静态标题、原有筛选图标与整体设计" },
      { type: "feat", text: "Playground 新增真实动效组件，支持独立参数、加载样式预设、收藏气泡、输入校验、打字与状态切换预览" },
      { type: "perf", text: "JavaScript 动效库按需加载，不使用外部 CDN，不人为延长等待；后台同步保留现有内容" },
      { type: "fix", text: "适配新旧版表单、天气和实时数据加载，统一小尺寸加载反馈，避免多个收藏气泡叠加；滚动或失焦时自动收起气泡，尊重系统减少动态效果设置" },
    ],
  },
  {
    version: "v2.3.0",
    date: "2026-10-17",
    items: [
      { type: "feat", text: "新增沉浸式倒计时：首页在确认场次开始前两分钟自动进入，支持手动关闭；天、时、分、秒随剩余时间自动适配" },
      { type: "feat", text: "F1、FE 使用独立发车灯板，WRC 使用当地时钟与最后一分钟像素倒计时；WRC 归零后自动接续下一已确认赛段" },
      { type: "ui", text: "新增主题色波浪入场与宽幅斜向扫屏，灯板和时钟增加立体外壳、轻微光晕及支持设备上的倾斜透视；支持系统减少动态效果设置" },
      { type: "feat", text: "新增沉浸与仪式感测试页，真实组件可独立全屏、重播、调整参数及逐帧检查归零动画" },
      { type: "fix", text: "修复 FE 倒计时数字与灯板中心线错位，优化最后几秒、归零动画和 WRC 赛段切换的衔接" },
    ],
  },
  {
    version: "v2.2.3",
    date: "2026-10-11",
    items: [
      { type: "feat", text: "Playground 逐行列出正式组件，可直接预览并独立调整参数" },
      { type: "fix", text: "Playground 移除嵌入式预览，按需挂载组件并隔离业务接口请求" },
    ],
  },
  {
    version: "v2.2.2",
    date: "2026-10-11",
    items: [
      { type: "fix", text: "F1 历史赛果按上游分页获取并合并同站成绩，恢复完整赛季与全部车手记录" },
      { type: "fix", text: "FE 积分与历史赛果改用官网公开页面数据，单站成绩按需加载；失败显示中文提示并支持重试" },
      { type: "fix", text: "日历改为服务端附件下载，优化图片下载的链接生命周期；日历补齐唯一标识、生成时间、文本转义与长行折叠" },
      { type: "fix", text: "修正拉斯维加斯街道分类、新加坡赛道长度、来源链接文案和部分中文赛事名，兼容已有赛历快照" },
      { type: "fix", text: "更新 F1 预测候选数据；周编号统一为北京时间 ISO 周，修正跨年导航" },
      { type: "ui", text: "手机赛事详情双时区分行显示；月历计数明确为赛事日条目；底部胶囊更新为 v2.2.2 · 修复与更新" },
    ],
  },
  {
    version: "v2.2.1",
    date: "2026-10-11",
    items: [
      { type: "feat", text: "新增首次访问指南选择菜单，可选择多个界面的高亮讲解；首页直接高亮最上面的真实赛事卡片，深入介绍场次、时间、状态与详情功能，优化日历壁纸的月份留白与赛事列表间距；同一浏览器仅自动显示一次，可从底部胶囊重开" },
      { type: "feat", text: "新增客户端轻量辅助采集，使用访客网络获取公开数据并自动补齐缺失场次；已有时间保持不变，赛事卡片小 i 可查看客户端来源与上传时间" },
      { type: "ui", text: "底部胶囊新增「使用指南」，版本入口更新为「v2.2.1 · 版本与更新」；其他公开页面也提供使用指南入口" },
      { type: "fix", text: "WRC 估计赛段统一显示「时间待确认」，不展示具体估计时间；保留已确认赛段的历史时间" },
      { type: "perf", text: "赛历优先读取已有快照，后台更新过期数据；WRC 抓取增加并发限制、时间预算与请求复用" },
      { type: "feat", text: "后台新增只读数据库检查及 WRC 抓取诊断，方便人工核查数据和排查失败" },
    ],
  },
  {
    version: "v2.1.0",
    date: "2026-07-30",
    items: [
      { type: "fix", text: "周视图重复 EventCard：点击某天后详情面板按赛事去重，修复同一天多场次导致重复渲染同一张赛事卡片" },
      { type: "fix", text: "WRC LiveTiming 动态 slug 同步：爬虫合并结果时同步更新 eventSlug/liveTimingUrl，修复官方 slug 变更后详情页指向 404" },
      { type: "fix", text: "WRC 详情页 LiveTiming 改为外跳按钮：放弃 iframe 代理（WRC SPA 无法渲染），改为稳定的外跳官方页面入口" },
      { type: "fix", text: "WRC 卡片内停用桩轮询：不再每 10 秒请求无效的 WRC 计时数据，直接显示官方链接卡片" },
      { type: "feat", text: "新增 /playground 交互测试台：可随时触发撒花特效、提示音试听、倒计时阶段化字号、沉浸式开赛模式，不影响正式页面" },
      { type: "ui", text: "撒花特效改为屏幕两侧齐射，各系列专属配色（F1 红/WRC 蓝/FE 青）" },
      { type: "ui", text: "沉浸式开赛模式改为纯黑背景，数字滚动动画 + 归零两侧撒花" },
      { type: "ui", text: "提示音改为柔和钟琴/颂钵音色（多谐波叠加 + 低通滤波 + 长衰减），消除电音感" },
    ],
  },
  {
    version: "v2.0.2",
    date: "2026-07-29",
    items: [
      { type: "fix", text: "WRC 快照合并持久化：新增 saveWrcSnapshotMerged，爬取失败(tentative)的赛事自动保留上次真实官方时间，解决WRC官方时间每天重置/丢失的问题" },
      { type: "fix", text: "跨浏览器/跨设备 UI 颜色一致性：移除 prefers-color-scheme 媒体查询，统一为深色主题，所有用户看到完全一致的官方界面" },
      { type: "ui", text: "主色调控件改为中性单色（浅灰底 + 深字），红色仅作 --f1 F1 品牌装饰色，交互控件不再用红色" },
    ],
  },
  {
    version: "v2.0.1",
    date: "2026-07-22",
    items: [
      { type: "fix", text: "修复开发者页面 Patreon 名片图片无法显示的问题" },
      { type: "ui", text: "Patreon 卡片改用本地静态图片资源，提升加载稳定性" },
    ],
  },
  {
    version: "v2.0.0",
    date: "2026-07-22",
    items: [
      { type: "feat", text: "WRC 动态赛历发现：爬虫先从官网 Event Series API 获取全年14场完整赛历，再逐个爬取，不再受60天日期限制" },
      { type: "feat", text: "WRC v2 爬虫方案：并行尝试多种 itinerary slug 调用 Feed API，绕过 Akamai WAF，提升爬取成功率" },
      { type: "feat", text: "天气图表重构：使用 ECharts 将天气卡片改为交互式每日气温折线图与降水柱状图" },
      { type: "feat", text: "数据库持久化优化：修复 DATABASE_URL 缺失导致快照/配额完全失效的问题" },
      { type: "fix", text: "修正3个 WRC 错误 slug（葡萄牙/日本/希腊缺少赞助商前缀）" },
      { type: "fix", text: "移除 WRC 爬虫每日10次 API 配额限制，始终尝试爬取官网数据" },
      { type: "ui", text: "添加 Patreon 赞助入口到开发者页面" },
    ],
  },
  {
    version: "v1.0.10",
    date: "2026-07-21",
    items: [
      { type: "fix", text: "修复 F1 赛道图加载失败：API 层强制覆盖为本地图片资源，解决快照缓存旧 URL 问题" },
      { type: "fix", text: "修复后台用户建议入口登录循环：cookie 值检查从 authenticated 改为 true" },
      { type: "fix", text: "修复 AI 赛事预测排序错误：重写解析逻辑，只匹配序号开头行，过滤分析文本" },
      { type: "fix", text: "修复 FE 积分榜 API 500 错误：赛季未开始时返回空数据，接口不可用时返回友好提示" },
      { type: "ui", text: "移动端顶部筛选栏简化：只保留赛事系列（全部/F1/WRC/FE），搜索框和高级筛选移至桌面端" },
      { type: "ui", text: "赛道图组件添加加载状态、错误重试和路径显示" },
    ],
  },
  {
    version: "v1.0.9",
    date: "2026-07-21",
    items: [
      { type: "feat", text: "历史赛果查询页面，支持 F1/FE 各赛季完整成绩" },
      { type: "feat", text: "天气预警功能：暴雨/雷暴/强风/极端温度/降雪/大雾自动识别" },
      { type: "feat", text: "积分榜图表可视化，支持积分/胜场切换，前三名金银铜色标识" },
      { type: "feat", text: "赛事日历壁纸生成，支持手机 9:16 / 桌面 16:9 两种比例" },
      { type: "feat", text: "AI 预测 API 每日 50 次用量限制" },
      { type: "fix", text: "修复 Wikipedia 图片 OpaqueResponseBlocking 被阻止问题（通过服务端代理）" },
      { type: "fix", text: "修复投票 POST 400 错误（投票不需要 series 字段）" },
      { type: "fix", text: "修复 React hydration mismatch（传递 serverTime prop 确保 SSR/客户端一致）" },
    ],
  },
  {
    version: "v1.0.8",
    date: "2026-07-16",
    items: [
      { type: "feat", text: "赛事详情改为模态框弹窗展示，移除翻转动画" },
      { type: "feat", text: "F1 赛道平面图直接嵌入显示（硬编码 Wikipedia 图片）" },
      { type: "feat", text: "F1 正面卡片直接显示赛道平面图" },
      { type: "ui", text: "优化模态框：ESC 关闭、遮罩模糊、sticky 头部" },
      { type: "ui", text: "优化链接 Hover 效果：阴影 + 上移动画" },
    ],
  },
  {
    version: "v1.0.7",
    date: "2026-07-16",
    items: [
      { type: "feat", text: "F1 详细信息显示：去年冠军、最快圈速、赛道长度和圈数" },
      { type: "feat", text: "F1 默认显示赛道平面图（Wikipedia 链接）" },
      { type: "ui", text: "优化卡片翻转动画，更流畅的 3D 效果" },
      { type: "ui", text: "优化链接 Hover 效果，添加阴影和缩放动画" },
      { type: "ui", text: "卡片背面重新排版，增加适当留白和卡片式布局" },
      { type: "perf", text: "优化 Wikipedia 图片加载，限制最大高度减少体积" },
    ],
  },
  {
    version: "v1.0.6",
    date: "2026-07-16",
    items: [
      { type: "feat", text: "赛事卡片支持翻转显示详细信息（3D 翻转动画）" },
      { type: "feat", text: "卡片背面显示 Wikipedia 赛事图片和更多信息" },
      { type: "feat", text: "天气预报支持通过地理坐标查询（解决 WRC 天气加载失败）" },
      { type: "fix", text: "修复 WRC 所有赛事天气无法加载的问题（中文城市名地理编码失败）" },
    ],
  },
  {
    version: "v1.0.5",
    date: "2026-07-16",
    items: [
      { type: "feat", text: "赛前预测冠军投票，所有用户共享投票数据（Neon PostgreSQL）" },
      { type: "feat", text: "FE 积分榜页面，车手头像和国家旗帜显示" },
      { type: "feat", text: "高级筛选：赛道特性（街道赛 / 拉力 / 场地）和地区筛选" },
      { type: "feat", text: "赛事官网链接跳转，一键直达官方信息" },
      { type: "feat", text: "通知提醒时间可自定义配置" },
      { type: "feat", text: "无网络时显示 localStorage 缓存数据，支持离线浏览" },
      { type: "feat", text: "月视图点击日期展开当天赛事详情" },
      { type: "feat", text: "加载状态骨架屏动画" },
      { type: "feat", text: "滚动吸顶筛选栏（sticky header）" },
      { type: "feat", text: "空搜索结果友好提示" },
      { type: "fix", text: "修复 Next.js 16 中 cookies() 需要 await 的问题" },
      { type: "fix", text: "修复 Neon 数据库 channel_binding 参数导致连接失败" },
    ],
  },
  {
    version: "v1.0.4",
    date: "2026-07-15",
    items: [
      { type: "feat", text: "浏览器原生通知提醒，赛前 1 小时 / 15 分钟 / 5 分钟自动提醒" },
      { type: "feat", text: "F1 积分榜页面（车手 + 车队）" },
      { type: "perf", text: "数据 ISR 静态化缓存，每小时自动重新生成" },
    ],
  },
  {
    version: "v1.0.3",
    date: "2026-07-15",
    items: [
      { type: "feat", text: "F1 上一站回顾组件，默认显示剧透保护" },
      { type: "feat", text: "下一站预览组件，展示倒计时与赛程安排" },
      { type: "feat", text: "集成 ocblacktop API 作为 WRC 爬虫第四层 fallback" },
      { type: "feat", text: "顶部搜索栏，支持按赛事名称/国家/城市搜索" },
      { type: "feat", text: "后台管理页面，密码保护，查看各服务运行状态" },
      { type: "feat", text: "新增赛车主题 favicon（方格旗 + 赛车剪影）" },
      { type: "ui", text: "F1 上下一站改为上下垂直排列" },
      { type: "fix", text: "修复月视图跨日赛事只显示一天的问题" },
      { type: "fix", text: "修复所有赛事都显示时间来源为 WRC 官方的 bug" },
      { type: "fix", text: "修复倒计时和卡片时间显示结束时间而非开赛时间" },
      { type: "fix", text: "修复 HTML 正则解析误匹配 script/style 内容的脏数据" },
      { type: "perf", text: "构建时间从 1 分钟优化至约 5 秒（运行时爬虫 + 并行化）" },
      { type: "refactor", text: "WRC 爬虫四级 fallback 架构：官网 fetch → PhantomJsCloud → HTML 正则 → ocblacktop" },
    ],
  },
  {
    version: "v1.0.2",
    date: "2026-07-14",
    items: [
      { type: "feat", text: "新增月视图模式" },
      { type: "feat", text: "底部反馈按钮，一键提 Issue / 功能建议" },
      { type: "fix", text: "WRC 直接 fetch 爬取作为主方案，PhantomJsCloud 降级为 fallback" },
      { type: "ui", text: "赛事卡片显示时间来源标签（官方 / 估计）" },
    ],
  },
  {
    version: "v1.0.1",
    date: "2026-07-13",
    items: [
      { type: "feat", text: "WRC 赛程支持，爬取官方 itinerary 赛段时间" },
      { type: "feat", text: "切换系列筛选：全部 / F1 / WRC / FE" },
      { type: "feat", text: "时间范围筛选：即将开始 / 全部 / 已结束" },
    ],
  },
  {
    version: "v1.0.0",
    date: "2026-07-12",
    items: [
      { type: "feat", text: "初始版本，F1 与 Formula E 赛程展示" },
      { type: "feat", text: "北京时间与当地时间双时区显示" },
      { type: "feat", text: "中国大陆转播提示（腾讯视频、五星体育等）" },
    ],
  },
]

const typeMap = {
  feat: { icon: Sparkles, label: "新功能", color: "text-emerald-400" },
  fix: { icon: Bug, label: "修复", color: "text-amber-400" },
  perf: { icon: Zap, label: "性能", color: "text-purple-400" },
  ui: { icon: Info, label: "界面", color: "text-blue-400" },
  refactor: { icon: Shield, label: "架构", color: "text-pink-400" },
}

export default function AboutPage() {
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-8 sm:py-10">
      <header className="flex items-center gap-4">
        <Link
          href="/"
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground transition-colors hover:text-foreground"
          aria-label="返回首页"
        >
          <ArrowLeft className="size-4" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">关于 · 更新日志</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            赛道时刻 · 赛车赛程日历
          </p>
        </div>
      </header>

      <section className="rounded-2xl border border-border bg-card p-5 sm:p-6">
        <div className="flex flex-wrap items-baseline gap-2">
          <span data-guide="version" className="text-3xl font-bold">{changelog[0].version}</span>
          <span className="text-sm text-muted-foreground">沉浸式倒计时 · 系列发车灯 · WRC 赛段接续</span>
        </div>
        <p className="mt-3 text-sm text-muted-foreground">
          一个简洁直观的赛车赛程时间表，支持 WRC、F1、Formula E
          三大系列，提供当地时间与北京时间的详细赛程安排，以及中国大陆转播提示。
        </p>
        <div className="mt-4 flex flex-wrap gap-2 text-xs">
          <span className="rounded-full border border-border px-3 py-1 text-muted-foreground">
            Next.js
          </span>
          <span className="rounded-full border border-border px-3 py-1 text-muted-foreground">
            React
          </span>
          <span className="rounded-full border border-border px-3 py-1 text-muted-foreground">
            TypeScript
          </span>
          <span className="rounded-full border border-border px-3 py-1 text-muted-foreground">
            Tailwind CSS
          </span>
        </div>
      </section>

      <section data-guide="changelog" className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold">更新日志</h2>
        {changelog.map((entry) => (
          <div
            key={entry.version}
            className="rounded-2xl border border-border bg-card p-5 sm:p-6"
          >
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <div className="flex items-baseline gap-2">
                <span className="text-xl font-bold">{entry.version}</span>
                {entry.version === changelog[0].version && (
                  <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-medium text-emerald-400">
                    最新
                  </span>
                )}
              </div>
              <span className="text-xs text-muted-foreground">{entry.date}</span>
            </div>
            <ul className="mt-4 space-y-2">
              {entry.items.map((item, idx) => {
                const typeInfo = typeMap[item.type]
                const Icon = typeInfo.icon
                return (
                  <li key={idx} className="flex items-start gap-2.5 text-sm">
                    <span className={`mt-0.5 ${typeInfo.color}`} aria-hidden>
                      <Icon className="size-4" />
                    </span>
                    <span className="text-foreground/90">{item.text}</span>
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
      </section>

      <footer className="pt-2 text-center text-[11px] text-muted-foreground">
        © 2026 赛道时刻 · 数据仅供参考，请以官方信息为准
      </footer>
    </div>
  )
}
