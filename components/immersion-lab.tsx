"use client"

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState, type ReactNode, type CSSProperties } from 'react'
import { Maximize2, Play, RotateCcw, ArrowLeft } from 'lucide-react'
import { ImmersiveCountdown } from './immersive-countdown'
import { StartLights } from './start-lights'
import { StartClock } from './start-clock'
import { CountdownEntrance, CountdownImpact, CountdownFinalPulse } from './countdown-effects'
import { immersionCases, type ImmersionCaseId } from '@/lib/immersion-catalog'
import type { Series } from '@/lib/types'
import { SERIES_THEME_COLORS } from '@/lib/series-theme'
import './immersive-countdown.css'

const button = 'inline-flex items-center justify-center gap-2 rounded-full border border-border px-3 py-2 text-xs hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring'
const input = 'w-full rounded-md border border-border bg-background px-3 py-2 text-sm'

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="grid gap-2 text-xs text-muted-foreground"><span>{label}</span>{children}</label>
}

export function ImmersionLabCase({ id, fullscreen = false }: { id: ImmersionCaseId; fullscreen?: boolean }) {
  const item = immersionCases.find(entry => entry.id === id)!
  const router = useRouter()
  const [series, setSeries] = useState<Series>(id === 'lights-fe' ? 'FE' : id === 'lights-f1' ? 'F1' : 'WRC')
  const [delay, setDelay] = useState(10)
  const [target, setTarget] = useState(() => Date.now() + 10000)
  const [clock, setClock] = useState(Date.now)
  const [nonce, setNonce] = useState(0)
  const [lit, setLit] = useState(5)
  const [green, setGreen] = useState(false)
  const [delayed, setDelayed] = useState(false)
  const [timeZone, setTimeZone] = useState('Europe/Paris')
  const [frame, setFrame] = useState(450)
  const [paused, setPaused] = useState(true)
  const [effectActive, setEffectActive] = useState(false)
  const [closed, setClosed] = useState(false)
  const [mounted, setMounted] = useState(false)
  const countdown = id === 'countdown' || id === 'countdown-entry'
  const effect = id === 'entrance' || id === 'final-pulse' || id === 'impact'
  const lights = id === 'lights-f1' || id === 'lights-fe'
  const duration = id === 'entrance' ? 1250 : id === 'final-pulse' ? 850 : series === 'WRC' ? 2600 : 1800
  useEffect(() => { setMounted(true) }, [])

  useEffect(() => {
    if (id !== 'clock-wrc') return
    const timer = setInterval(() => setClock(Date.now()), 100)
    return () => clearInterval(timer)
  }, [id])
  useEffect(() => {
    if (!fullscreen || countdown) return
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') router.push('/playground/immersion') }
    document.addEventListener('keydown', escape)
    return () => document.removeEventListener('keydown', escape)
  }, [fullscreen, countdown, router])
  useEffect(() => {
    if (!effect || paused || !effectActive) return
    const timer = setTimeout(() => setEffectActive(false), duration)
    return () => clearTimeout(timer)
  }, [effect, paused, effectActive, duration, nonce])

  function replay(seconds = delay) {
    if (lights) { setLit(5); setGreen(false); setDelayed(false) }
    setTarget(Date.now() + seconds * 1000)
    setClock(Date.now())
    setClosed(false)
    setNonce(value => value + 1)
    if (effect) { setPaused(false); setEffectActive(true) }
  }
  const frameMs = paused ? Math.min(frame, duration) : -1
  const controls = <div className="grid gap-4">
    {!lights && id !== 'clock-wrc' && id !== 'final-pulse' && <Field label="赛事系列"><select aria-label="赛事系列" className={input} value={series} onChange={event => setSeries(event.target.value as Series)}>{(['WRC', 'F1', 'FE'] as const).map(value => <option key={value}>{value}</option>)}</select></Field>}
    {(countdown || id === 'clock-wrc') && <>
      <div className="flex flex-wrap gap-2">{[5, 10, 30, 60, 61, 120, 3600, 0].map(value => <button key={value} className={button} onClick={() => { setDelay(value); replay(value) }}>{value === 0 ? '已归零' : value === 3600 ? '长倒计时' : `${value} 秒`}</button>)}</div>
      <Field label="倒计时秒数"><input aria-label="倒计时秒数" className={input} type="number" min="0" max="864000" value={delay} onChange={event => setDelay(Math.max(0, Math.min(864000, Number(event.target.value))))} /></Field>
      <Field label="当地时区"><select aria-label="当地时区" className={input} value={timeZone} onChange={event => setTimeZone(event.target.value)}>{['Europe/Paris', 'Asia/Shanghai', 'Asia/Riyadh', 'America/New_York'].map(value => <option key={value}>{value}</option>)}</select></Field>
    </>}
    {lights && <>
      <Field label={`红灯组数：${lit}`}><input aria-label="红灯组数" type="range" min="0" max="5" value={lit} onChange={event => setLit(Number(event.target.value))} /></Field>
      <label className="flex gap-2 text-sm"><input type="checkbox" checked={green} onChange={event => setGreen(event.target.checked)} />辅助绿灯</label>
      <label className="flex gap-2 text-sm"><input type="checkbox" checked={delayed} onChange={event => setDelayed(event.target.checked)} />延迟提示</label>
    </>}
    {effect && <>
      <Field label={paused ? `动画位置：${Math.min(frame, duration)} 毫秒` : effectActive ? '正在播放完整动画' : '播放结束'}><input aria-label="动画位置" type="range" min="0" max={duration} step="10" value={Math.min(frame, duration)} onChange={event => { setFrame(Number(event.target.value)); setPaused(true) }} /></Field>
      <div className="flex flex-wrap gap-2">{[0, Math.round(duration * .2), Math.round(duration * .5), duration].map(value => <button key={value} className={button} onClick={() => { setFrame(value); setPaused(true) }}>{value} ms</button>)}</div>
    </>}
    <button className={button} onClick={() => replay()}><RotateCcw aria-hidden="true" size={14} />{effect ? '播放完整动画' : lights ? '恢复默认灯板' : '重新开始'}</button>
    {!fullscreen && <Link className={button} href={`/playground/immersion/${id}`}><Maximize2 aria-hidden="true" size={14} />独立全屏测试</Link>}
  </div>

  const remaining = Math.max(0, Math.ceil((target - clock) / 1000))
  const fullscreenControls = <nav className="fixed left-3 right-20 top-3 z-[10030] flex flex-wrap items-start gap-2" aria-label="全屏测试控制">
    <Link className={`${button} bg-background/95`} href="/playground/immersion"><ArrowLeft aria-hidden="true" size={14} />返回</Link>
    <button className={`${button} bg-background/95`} onClick={() => replay()}><Play aria-hidden="true" size={14} />{lights ? '复位' : '重播'}</button>
    <details className="max-h-[75dvh] w-64 overflow-auto rounded-xl border border-border bg-background/95 p-3 text-sm"><summary tabIndex={0} className="cursor-pointer">{item.name} · 参数</summary><div className="pt-4">{controls}</div></details>
  </nav>
  let visual: ReactNode
  if (countdown) {
    visual = closed ? <button className={button} onClick={() => replay()}>重新打开</button> : <ImmersiveCountdown key={nonce} targetTime={new Date(target).toISOString()} series={series} timeZone={timeZone} entrance={id === 'countdown-entry'} title={`${series} 沉浸测试`} preview={!fullscreen} onClose={() => fullscreen ? router.push('/playground/immersion') : setClosed(true)}>{fullscreen ? fullscreenControls : null}</ImmersiveCountdown>
  } else {
    visual = <div key={`${nonce}-${series}`} className={`race-immersive immersion-effect-stage ${fullscreen ? 'immersion-effect-full' : ''} ${id === 'impact' && (paused ? frame < duration : effectActive) ? 'has-impact' : ''} ${id === 'impact' && paused ? 'is-frame-inspection' : ''}`} data-series={series} style={{ '--accent': SERIES_THEME_COLORS[series], ...(paused ? { '--launch-frame': `${Math.min(frame, duration)}ms` } : {}) } as CSSProperties}>
      {lights && <div role="img" aria-label={`${series} 灯板，${lit} 组红灯，绿灯${green ? '亮' : '灭'}，延迟提示${delayed ? '开' : '关'}`}><StartLights series={id === 'lights-f1' ? 'F1' : 'FE'} lit={lit} green={green} delayed={delayed} /></div>}
      {id === 'clock-wrc' && <div className="race-stage"><StartClock seconds={remaining} started={remaining === 0} now={clock} timeZone={timeZone} /></div>}
      {id === 'entrance' && <CountdownEntrance frameMs={frameMs} />}
      {id === 'final-pulse' && <CountdownFinalPulse frameMs={frameMs} />}
      {id === 'impact' && <><div className="race-stage">{series === 'WRC' ? <StartClock seconds={0} started now={clock} timeZone={timeZone} /> : <StartLights series={series} lit={0} green={false} delayed={false} />}</div><CountdownImpact frameMs={frameMs} /></>}
    </div>
  }

  if (!mounted) visual = <p role="status" className="py-20 text-center text-sm text-muted-foreground">组件加载中…</p>

  if (fullscreen) return <main>
    {visual}
    {!countdown && fullscreenControls}
  </main>

  return <article className="border-t border-border py-7" aria-label={item.name}>
    <div className="mb-4"><h2 className="text-base font-medium">{item.name}</h2><p className="mt-1 text-xs leading-6 text-muted-foreground">{item.description}</p></div>
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
      <section className="min-w-0" aria-label={`${item.name}预览`}>{visual}</section>
      <section aria-label={`${item.name}参数`}>{controls}</section>
    </div>
  </article>
}

export function ImmersionLab() {
  return <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
    <Link className="text-xs text-muted-foreground hover:text-foreground" href="/playground">返回组件 Playground</Link>
    <h1 className="mt-5 text-2xl font-semibold">沉浸与仪式感测试</h1>
    <p className="mt-2 text-sm leading-7 text-muted-foreground">直接使用网站真实组件。每项可单独全屏、重播和调整参数；动画遵循系统的减少动态效果设置。</p>
    <nav className="my-6 flex flex-wrap gap-2" aria-label="全屏测试目录">{immersionCases.map(item => <Link key={item.id} className={button} href={`/playground/immersion/${item.id}`}>{item.name}<Maximize2 aria-hidden="true" size={12} /></Link>)}</nav>
    {immersionCases.map(item => <ImmersionLabCase key={item.id} id={item.id} />)}
  </main>
}
