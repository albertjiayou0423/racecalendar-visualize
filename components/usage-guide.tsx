"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { usePathname } from "next/navigation"
import { BookOpen, X } from "lucide-react"

const SEEN_KEY = "racecalendar:usage-guide-seen"
const OPEN_EVENT = "racecalendar:open-usage-guide"
let shownThisSession = false
const steps = [
  { title: "欢迎来到赛道时刻", subtitle: "一分钟，找到你想看的比赛", items: ["这里可以查看 F1、WRC 和 Formula E 的赛程。", "时间以北京时间为主，同时提供赛事当地时间。", "这份指南只会自动出现一次，随时可从底部的「使用指南」重新打开。"] },
  { title: "赛历首页", subtitle: "筛选比赛，选择适合你的视图", items: ["按系列、时间范围筛选，或搜索赛事名称、国家和城市。", "列表适合逐场浏览；周视图和月视图方便安排观赛。", "展开赛事卡片查看场次，进入详情页了解更多；没有结果时可清除筛选。"] },
  { title: "赛事详情", subtitle: "场次安排和观赛入口集中在这里", items: ["查看场次的北京时间、当地时间及观赛信息。", "确认时间的主场次可以设置提醒或加入日历；浏览器会按需要请求通知权限。", "WRC 的「时间待确认」表示具体赛段时间仍未确认，请以官方行程为准；官方计时入口会打开官网。"] },
  { title: "积分榜", subtitle: "了解赛季走势", items: ["从首页底部的「积分榜」进入，切换赛事系列查看排名和积分。", "排名随数据来源更新，未开赛或数据暂不可用时可能没有结果。"] },
  { title: "历史赛果", subtitle: "回看已经结束的比赛", items: ["从「历史赛果」进入，选择系列和赛季，查看可用的比赛结果。", "WRC 暂未接入完整赛果与积分数据，可通过赛事详情的官方入口查看。"] },
  { title: "壁纸生成", subtitle: "把赛历放到你的屏幕上", items: ["进入「壁纸生成」，按页面选项调整你的赛事日历壁纸。", "预览效果后下载，保存到设备并设置为壁纸。"] },
  { title: "赛道数据库", subtitle: "认识比赛举办地", items: ["进入「赛道数据库」，按赛道名称、城市或国家搜索。", "浏览赛道卡片，了解赛道位置和资料。"] },
  { title: "更多功能与更新", subtitle: "从底部胶囊继续探索", items: ["「版本与更新」记录最新功能和修复；「开发者信息」介绍项目。", "「使用指南」随时重新打开这份介绍，不会修改你的赛历筛选。", "现在开始浏览吧，找到你下一场想看的比赛。"] },
]

export function UsageGuideButton() {
  return <button type="button" onClick={() => window.dispatchEvent(new Event(OPEN_EVENT))} className="inline-flex items-center gap-1.5 rounded-full border border-border px-4 py-1.5 text-xs text-muted-foreground transition-colors hover:border-primary hover:text-foreground">
    <BookOpen className="size-3.5" aria-hidden />使用指南
  </button>
}

export function UsageGuide() {
  const pathname = usePathname()
  const dialog = useRef<HTMLDialogElement>(null)
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState(0)
  const show = useCallback(() => {
    shownThisSession = true
    try { localStorage.setItem(SEEN_KEY, "1") } catch { /* Session guard still prevents repeat opens. */ }
    setStep(0)
    setOpen(true)
  }, [])

  useEffect(() => {
    if (pathname.startsWith("/admin") || pathname.startsWith("/api")) { setOpen(false); return }
    let seen = shownThisSession
    try { seen = seen || localStorage.getItem(SEEN_KEY) === "1" } catch { /* Storage can be disabled. */ }
    const timer = seen ? undefined : window.setTimeout(show, 600)
    const manualShow = () => { window.clearTimeout(timer); show() }
    window.addEventListener(OPEN_EVENT, manualShow)
    return () => { window.removeEventListener(OPEN_EVENT, manualShow); window.clearTimeout(timer) }
  }, [pathname, show])

  useEffect(() => {
    const element = dialog.current
    if (!element) return
    if (!open) { if (element.open) element.close(); return }
    element.showModal()
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => { document.body.style.overflow = previousOverflow; if (element.open) element.close() }
  }, [open])

  const current = steps[step]
  return <>
    {pathname !== "/" && !pathname.startsWith("/admin") && !pathname.startsWith("/api") && <div className="fixed bottom-4 right-4 z-40 rounded-full bg-background shadow-lg"><UsageGuideButton /></div>}
    <dialog ref={dialog} aria-labelledby="usage-guide-title" aria-describedby="usage-guide-subtitle" onCancel={() => setOpen(false)} onClick={event => { if (event.target === event.currentTarget) setOpen(false) }} className="m-auto w-[calc(100%_-_2rem)] max-w-lg max-h-[85dvh] overflow-y-auto rounded-2xl border border-border bg-card p-0 text-foreground shadow-2xl backdrop:bg-black/70">
      <div className="p-5 sm:p-7">
        <div className="flex items-center justify-between"><span className="text-xs text-muted-foreground">使用指南 · {step + 1} / {steps.length}</span><button type="button" onClick={() => setOpen(false)} aria-label="关闭使用指南" className="rounded-full p-2 hover:bg-secondary"><X className="size-4" /></button></div>
        <div aria-live="polite" aria-atomic="true">
          <h2 id="usage-guide-title" className="mt-3 text-xl font-semibold">{current.title}</h2>
          <p id="usage-guide-subtitle" className="mt-2 text-sm text-muted-foreground">{current.subtitle}</p>
          <ul className="mt-5 space-y-3 text-sm leading-relaxed">{current.items.map(item => <li key={item} className="rounded-xl bg-secondary/50 p-3">{item}</li>)}</ul>
        </div>
        <div className="mt-6 flex items-center justify-between gap-3"><button type="button" onClick={() => step ? setStep(step - 1) : setOpen(false)} className="rounded-lg px-3 py-2 text-sm hover:bg-secondary">{step ? "上一步" : "跳过引导"}</button><button type="button" onClick={() => step === steps.length - 1 ? setOpen(false) : setStep(step + 1)} className="rounded-lg bg-primary px-5 py-2 text-sm font-medium text-primary-foreground">{step === steps.length - 1 ? "开始使用" : "下一步"}</button></div>
      </div>
    </dialog>
  </>
}
