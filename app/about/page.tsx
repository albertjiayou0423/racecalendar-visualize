"use client"

import { ArrowLeft, Sparkles, Bug, Zap, Info, Shield } from "lucide-react"
import Link from "next/link"

type ChangelogEntry = {
  version: string
  date: string
  items: { type: "feat" | "fix" | "perf" | "ui" | "refactor"; text: string }[]
}

const changelog: ChangelogEntry[] = [
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
          <span className="text-3xl font-bold">v2.0.0</span>
          <span className="text-sm text-muted-foreground">重大更新</span>
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

      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold">更新日志</h2>
        {changelog.map((entry) => (
          <div
            key={entry.version}
            className="rounded-2xl border border-border bg-card p-5 sm:p-6"
          >
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <div className="flex items-baseline gap-2">
                <span className="text-xl font-bold">{entry.version}</span>
                {entry.version === "v2.0.0" && (
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
