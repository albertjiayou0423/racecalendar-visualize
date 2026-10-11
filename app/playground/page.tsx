"use client"
import { useState } from "react"
import Link from "next/link"
import { ArrowLeft, FlaskConical } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useConfettiBurst, useRaceSound } from "@/lib/countdown-hooks"
import type { Series } from "@/lib/types"
import { PLAYGROUND_SCENARIOS } from "@/lib/playground-data"

const scenarios = { normal: "正常", loading: "加载中", empty: "空数据", error: "加载失败", offline: "离线缓存", tentative: "时间待确认", long: "超长名称", busy: "密集场次" }
const selectClass = "rounded-lg border border-border bg-card px-3 py-2 text-sm"
export default function PlaygroundPage() {
  const [scenario, setScenario] = useState("normal")
  const [component, setComponent] = useState("schedule")
  const [width, setWidth] = useState(390)
  const [duration, setDuration] = useState("original")
  const [easing, setEasing] = useState("original")
  const [reduced, setReduced] = useState(false)
  const [series, setSeries] = useState<Series>("F1")
  const [seconds, setSeconds] = useState(90)
  const [reset, setReset] = useState(0)
  const { burst } = useConfettiBurst()
  const { play } = useRaceSound()
  const params = new URLSearchParams({ scenario, component, duration, easing, reduced: String(reduced), series, seconds: String(seconds), reset: String(reset) })
  return <main className="mx-auto max-w-6xl px-4 py-8">
    <Link href="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground"><ArrowLeft className="size-4" />返回首页</Link>
    <header className="my-6"><h1 className="flex items-center gap-2 text-2xl font-bold"><FlaskConical className="size-6" />交互测试台</h1><p className="mt-2 text-sm text-muted-foreground">直接使用正式组件。场景数据独立，测试不会提交反馈、投票或触发采集。</p></header>
    <section aria-label="预览设置" className="rounded-xl border border-border bg-card p-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <label className="flex flex-col gap-2 text-xs">真实组件<select className={selectClass} value={component} onChange={e => setComponent(e.target.value)}><option value="schedule">首页 · 筛选 / 视图 / 胶囊</option><option value="card">赛事卡片</option><option value="week">周历</option><option value="month">月历</option><option value="feedback">反馈弹窗</option><option value="countdown">下一站倒计时</option><option value="immersive">沉浸式倒计时</option></select></label>
        <label className="flex flex-col gap-2 text-xs">数据场景<select className={selectClass} value={scenario} onChange={e => setScenario(e.target.value)}>{PLAYGROUND_SCENARIOS.map(key => <option key={key} value={key}>{scenarios[key]}</option>)}</select></label>
        <label className="flex flex-col gap-2 text-xs">预览宽度<select className={selectClass} value={width} onChange={e => setWidth(Number(e.target.value))}>{[320, 375, 390, 768, 1024].map(n => <option key={n} value={n}>{n}px · {n < 640 ? "手机" : n < 1000 ? "平板" : "桌面"}</option>)}</select></label>
        <label className="flex flex-col gap-2 text-xs">赛事系列<select className={selectClass} value={series} onChange={e => setSeries(e.target.value as Series)}>{["F1", "WRC", "FE"].map(s => <option key={s}>{s}</option>)}</select></label>
        <label className="flex flex-col gap-2 text-xs">过渡时长<select className={selectClass} value={duration} onChange={e => setDuration(e.target.value)}><option value="original">组件原始时长</option>{[120, 180, 240, 300, 500].map(n => <option key={n} value={n}>{n}ms</option>)}</select></label>
        <label className="flex flex-col gap-2 text-xs">过渡曲线<select className={selectClass} value={easing} onChange={e => setEasing(e.target.value)}><option value="original">组件原始曲线</option><option value="ease-out">ease-out</option><option value="ease-in-out">ease-in-out</option><option value="linear">linear</option></select></label>
        <label className="flex flex-col gap-2 text-xs">倒计时秒数<input aria-label="倒计时秒数" className={selectClass} type="number" min={0} max={172800} value={seconds} onChange={e => setSeconds(Math.max(0, Math.min(172800, Number(e.target.value))))} /></label>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={reduced} onChange={e => setReduced(e.target.checked)} />减少动态效果</label>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-2"><Button size="sm" variant="outline" onClick={() => setReset(n => n + 1)}>重置预览交互</Button><span className="text-xs text-muted-foreground">宽视口超出屏幕时可在下方横向滚动。过渡参数仅作用于预览，不保存到正式页面。</span></div>
    </section>
    <div className="my-4 flex flex-wrap gap-2" aria-label="真实倒计时边界"><span className="self-center text-xs text-muted-foreground">阶段定位</span>{[[172800, "超过一天"], [7200, "当天"], [1800, "30分钟"], [600, "10分钟"], [60, "60秒"], [0, "归零"]].map(([n, label]) => <Button key={n} variant="outline" size="sm" onClick={() => { setSeconds(Number(n)); setComponent("countdown") }}>{label}</Button>)}</div>
    <section aria-label="组件预览视口" className="overflow-x-auto rounded-xl border border-border bg-secondary/20 p-2 sm:p-4"><iframe key={params.toString()} title="正式组件隔离预览" src={`/playground/preview?${params}`} style={{ width, height: 760 }} className="mx-auto block max-w-none rounded-lg border border-border bg-background" /></section>
    <section className="mt-6 rounded-xl border border-border bg-card p-4" aria-label="正式特效与声音"><h2 className="text-base font-semibold">正式特效与提示音</h2><p className="my-2 text-xs text-muted-foreground">复用正式页面的 useConfettiBurst 与 useRaceSound。提示音仅点击播放；与系统减少动态效果设置一致。</p><div className="flex flex-wrap gap-2">{(["light", "normal", "grand"] as const).map((level, i) => <Button key={level} variant="outline" size="sm" disabled={reduced} onClick={() => burst(series, level)}>{["少量撒花", "常规撒花", "盛大撒花"][i]}</Button>)}{(["tick", "start", "finish"] as const).map((sound, i) => <Button key={sound} variant="outline" size="sm" onClick={() => play(sound)}>{["滴答试听", "开赛试听", "完赛试听"][i]}</Button>)}</div></section>
  </main>
}
