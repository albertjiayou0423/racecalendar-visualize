"use client"

import Link from "next/link"
import { useState } from "react"
import { RaceFarewell, RoundArrival, SeriesRelay, WinnerReveal } from "./ritual-motion"

const cases = [
  { id: "relay", name: "三色接力", description: "新旧首页系列切换的真实细线动效；点击赛事或重播。" },
  { id: "round", name: "轮次抵达", description: "详情页的真实轮次组件，数字与原生入场预设共同播放。" },
  { id: "winner", name: "冠军揭晓", description: "主动揭晓后才挂载；这里的姓名为测试文字，不是真实赛果。" },
  { id: "farewell", name: "下站再见", description: "首页底部的一次性片尾文字，进入视野后播放。" },
] as const
const button = "rounded-full border border-border px-3 py-1.5 text-xs hover:bg-accent"

function RitualCase({ id, name, description }: typeof cases[number]) {
  const [nonce, setNonce] = useState(0)
  const [series, setSeries] = useState("F1")
  const [round, setRound] = useState(19)
  const [revealed, setRevealed] = useState(false)
  const [nameValue, setNameValue] = useState("示例车手")
  const [text, setText] = useState("下站见，赛道见。")
  const input = "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
  return <article aria-label={name} className="border-t border-border py-8">
    <h2 className="text-base font-medium">{name}</h2>
    <p className="mt-2 text-xs leading-6 text-muted-foreground">{description}</p>
    <div className="mt-5 grid gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
      <section aria-label={`${name}预览`} className="flex min-h-32 min-w-0 items-center justify-center overflow-hidden">
        {id === "relay" && <div className="w-full"><SeriesRelay series={`${series}-${nonce}`} /><p className="mt-3 text-xs text-muted-foreground">当前系列：{series}</p></div>}
        {id === "round" && <span className="rounded-full border border-border px-3 py-1 text-xs">第 <RoundArrival key={nonce} round={round} /> 站</span>}
        {id === "winner" && (revealed ? <WinnerReveal key={nonce}><span className="block text-xs text-muted-foreground">冠军 · 测试内容</span><strong className="mt-2 block text-lg">{nameValue}</strong></WinnerReveal> : <button className={button} onClick={() => setRevealed(true)}>揭晓示例</button>)}
        {id === "farewell" && <RaceFarewell key={nonce} text={text} />}
      </section>
      <section aria-label={`${name}参数`} className="space-y-4">
        <div className="flex flex-wrap gap-2"><button className={button} onClick={() => { setNonce(value => value + 1); if (id === "winner") setRevealed(true) }}>重播</button>{id === "winner" && <button className={button} onClick={() => setRevealed(false)}>收起</button>}</div>
        {id === "relay" && <div className="flex flex-wrap gap-2">{["F1", "WRC", "FE"].map(value => <button key={value} className={button} aria-pressed={series === value} onClick={() => setSeries(value)}>{value}</button>)}</div>}
        {id === "round" && <label className="grid gap-2 text-xs">轮次<input className={input} type="number" min="1" max="99" value={round} onChange={event => setRound(Math.max(1, Math.min(99, Number(event.target.value) || 1)))} /></label>}
        {id === "winner" && <label className="grid gap-2 text-xs">示例姓名<input className={input} maxLength={60} value={nameValue} onChange={event => setNameValue(event.target.value)} /></label>}
        {id === "farewell" && <label className="grid gap-2 text-xs">片尾文字<input className={input} maxLength={100} value={text} onChange={event => setText(event.target.value)} /></label>}
      </section>
    </div>
  </article>
}

export function RitualLab() {
  return <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
    <nav className="flex flex-wrap gap-3 text-xs text-muted-foreground"><Link href="/playground">返回组件 Playground</Link><Link href="/playground/immersion">原沉浸式测试</Link></nav>
    <h1 className="mt-5 text-2xl font-semibold">新版仪式感动效</h1>
    <p className="my-5 text-sm text-muted-foreground">选中的四项真实组件，保持正式页面尺寸。可重播、调整参数；遵循系统减少动态效果设置。</p>
    {cases.map(item => <RitualCase key={item.id} {...item} />)}
  </main>
}
