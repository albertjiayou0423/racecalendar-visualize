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
    version: "v1.0.3",
    date: "2026-07-15",
    items: [
      { type: "feat", text: "F1 添加上一站回顾组件，默认显示剧透保护" },
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
      { type: "perf", text: "WRC 爬虫限制每日最多 100 次，超出使用估计数据" },
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
          <span className="text-3xl font-bold">v1.0.3</span>
          <span className="text-sm text-muted-foreground">当前版本</span>
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
                {entry.version === "v1.0.3" && (
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
