"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { ArrowLeft, FlaskConical } from "lucide-react"
import { Button } from "@/components/ui/button"
import { componentCatalog, PLAYGROUND_NOW, type CatalogEntry, type CatalogProps } from "@/lib/playground-catalog"

const inputClass = "min-w-0 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
const enums: Record<string, string[]> = {
  series: ["F1", "WRC", "FE"], variant: ["default", "outline", "secondary", "ghost", "destructive", "link"],
  size: ["default", "xs", "sm", "lg", "icon", "icon-xs", "icon-sm", "icon-lg"],
  circuitType: ["street", "permanent", "hybrid", "rally"], region: ["europe", "asia", "americas", "middle-east", "africa", "oceania"],
}

function JsonEditor({ value, onChange, label }: { value: unknown; onChange: (value: unknown) => void; label: string }) {
  const [draft, setDraft] = useState(JSON.stringify(value, null, 2))
  const [error, setError] = useState("")
  useEffect(() => { setDraft(JSON.stringify(value, null, 2)); setError("") }, [value])
  return <><textarea aria-label={label} rows={7} className={`${inputClass} font-mono text-xs`} value={draft} onChange={e => {
    setDraft(e.target.value)
    try { const parsed = JSON.parse(e.target.value); onChange(parsed); setError("") } catch { setError("JSON 未完成，预览保留最后一次有效输入。") }
  }} />{error && <p role="status" className="text-xs text-destructive">{error}</p>}</>
}

function PropsEditor({ value, onChange, prefix = "" }: { value: CatalogProps; onChange: (value: CatalogProps) => void; prefix?: string }) {
  return <div className="space-y-3">{Object.entries(value).map(([key, item]) => {
    const label = `${prefix}${key}`
    const update = (next: unknown) => onChange({ ...value, [key]: next })
    if (item && typeof item === "object" && !Array.isArray(item)) return <details key={key} className="rounded-lg border border-border p-3"><summary className="cursor-pointer text-xs font-medium">{label}</summary><div className="mt-3"><PropsEditor value={item as CatalogProps} onChange={update} prefix={`${label}.`} /></div></details>
    return <label key={key} className="block space-y-1.5 text-xs"><span className="font-mono text-muted-foreground">{label}</span>
      {typeof item === "boolean" ? <span className="ml-3"><input aria-label={label} type="checkbox" checked={item} onChange={e => update(e.target.checked)} /></span>
        : Array.isArray(item) || item === null ? <JsonEditor value={item} onChange={update} label={label} />
        : Object.hasOwn(enums, key) && Array.isArray(enums[key]) ? <select aria-label={label} className={inputClass} value={String(item)} onChange={e => update(e.target.value)}>{enums[key].map(option => <option key={option}>{option}</option>)}</select>
        : <input aria-label={label} className={inputClass} type={typeof item === "number" ? "number" : "text"} value={String(item ?? "")} onChange={e => update(typeof item === "number" ? Number(e.target.value) : e.target.value)} />}
    </label>
  })}</div>
}

function ComponentRow({ entry }: { entry: CatalogEntry }) {
  const [props, setProps] = useState(entry.presets[0].props)
  const [preset, setPreset] = useState(0)
  const [width, setWidth] = useState(520)
  const [height, setHeight] = useState(360)
  const [duration, setDuration] = useState("original")
  const [easing, setEasing] = useState("original")
  const [reduced, setReduced] = useState(false)
  const [revision, setRevision] = useState(0)
  const frame = useRef<HTMLIFrameElement>(null)
  const current = useRef({ props, duration, easing, reduced })
  current.current = { props, duration, easing, reduced }
  const send = () => frame.current?.contentWindow?.postMessage({ type: "playground:props", component: entry.name, ...current.current }, window.location.origin)
  useEffect(() => { send() }, [props, duration, easing, reduced, revision])
  useEffect(() => {
    const receive = (event: MessageEvent) => {
      if (event.origin === window.location.origin && event.source === frame.current?.contentWindow && event.data?.type === "playground:ready") send()
    }
    window.addEventListener("message", receive)
    return () => window.removeEventListener("message", receive)
  }, [])
  const noProps = Object.keys(entry.presets[0].props).length === 0
  return <article id={entry.name} aria-label={`${entry.name} 组件`} className="overflow-hidden rounded-xl border border-border bg-card">
    <header className="border-b border-border px-5 py-4"><h2 className="font-mono text-base font-semibold">{entry.name}</h2><p className="mt-1 break-all font-mono text-xs text-muted-foreground">{entry.file}</p><p className="mt-2 text-xs leading-relaxed text-muted-foreground">{entry.description}</p></header>
    <div className="grid min-w-0 lg:grid-cols-[minmax(0,1fr)_360px]">
      <section aria-label={`${entry.name} 实时预览`} className="min-w-0 bg-secondary/10 p-4"><div className="mb-3 flex items-center justify-between text-xs text-muted-foreground"><span>实时组件</span><span>{width}px</span></div><div className="overflow-x-auto"><iframe key={revision} ref={frame} onLoad={send} loading="lazy" sandbox="allow-scripts allow-same-origin" title={`${entry.name} 预览`} src={`/playground/preview?component=${entry.name}`} style={{ width, height }} className="mx-auto block max-w-none rounded-lg border border-border bg-background" /></div></section>
      <section aria-label={`${entry.name} 参数`} className="min-w-0 border-t border-border p-4 lg:border-l lg:border-t-0">
        <div className="mb-4 flex flex-wrap gap-2" aria-label={`${entry.name} 预设`}>{entry.presets.map((item, index) => <button key={index} aria-pressed={preset === index} className={`rounded-full border px-3 py-1.5 text-xs transition-colors ${preset === index ? "border-primary bg-primary text-primary-foreground" : "border-border hover:border-primary"}`} onClick={() => {
          setProps(item.props); setPreset(index)
          if (noProps) { setWidth(index === 1 ? 320 : 520); setReduced(index === 2) }
        }}>{noProps ? ["默认", "手机", "减少动态"][index] : item.label}</button>)}</div>
        {noProps ? <p className="mb-3 text-xs text-muted-foreground">没有公开的可序列化 props。</p> : <PropsEditor value={props} onChange={next => { setProps(next); setPreset(-1) }} />}
        {entry.callbacks?.map(callback => <p key={callback} className="mt-3 text-xs text-muted-foreground"><code>{callback}</code>：由预览宿主记录回调；函数不能用 JSON 编辑。</p>)}
        <details className="mt-4 rounded-lg border border-border p-3"><summary className="cursor-pointer text-xs">完整 props JSON · 可添加可选字段</summary><div className="mt-3"><JsonEditor label={`${entry.name} 完整 props`} value={props} onChange={next => { if (next && typeof next === "object" && !Array.isArray(next)) { setProps(next as CatalogProps); setPreset(-1) } }} /></div></details>
        <details className="mt-3 rounded-lg border border-border p-3"><summary className="cursor-pointer text-xs">视口与动效 · 预览设置</summary><div className="mt-3 space-y-3">
          <label className="block text-xs">宽度<select aria-label={`${entry.name} 宽度`} className={inputClass} value={width} onChange={e => setWidth(Number(e.target.value))}>{[320, 375, 390, 520, 768, 1024].map(n => <option key={n} value={n}>{n}px</option>)}</select></label>
          <label className="block text-xs">高度<select className={inputClass} value={height} onChange={e => setHeight(Number(e.target.value))}>{[240, 360, 600, 800].map(n => <option key={n} value={n}>{n}px</option>)}</select></label>
          <label className="block text-xs">时长<select className={inputClass} value={duration} onChange={e => setDuration(e.target.value)}><option value="original">原始</option>{[120, 180, 240, 300, 500].map(n => <option key={n}>{n}</option>)}</select></label>
          <label className="block text-xs">曲线<select className={inputClass} value={easing} onChange={e => setEasing(e.target.value)}>{["original", "ease-out", "ease-in-out", "linear"].map(v => <option key={v}>{v}</option>)}</select></label>
          <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={reduced} onChange={e => setReduced(e.target.checked)} />减少动态效果</label>
        </div></details>
        <Button className="mt-3" size="sm" variant="ghost" onClick={() => setRevision(n => n + 1)}>重置组件内部交互</Button>
      </section>
    </div>
  </article>
}

export default function PlaygroundPage() {
  const [entries] = useState<CatalogEntry[]>(() => componentCatalog(PLAYGROUND_NOW))
  const [search, setSearch] = useState("")
  const visible = entries.filter(entry => `${entry.name} ${entry.file} ${entry.description}`.toLowerCase().includes(search.toLowerCase()))
  return <main className="mx-auto max-w-7xl px-4 py-8">
    <Link href="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground"><ArrowLeft className="size-4" />返回首页</Link>
    <header className="my-6"><h1 className="flex items-center gap-2 text-2xl font-bold"><FlaskConical className="size-6" />组件 Cheatsheet</h1><p className="mt-2 text-sm leading-relaxed text-muted-foreground">一行一个真实组件。左侧实时预览，右侧编辑 props，上方胶囊切换预设。预览不连接业务服务、不提交数据。</p></header>
    <label className="mb-5 block text-sm">查找组件<input className={`${inputClass} mt-2`} placeholder="名称、路径或功能" value={search} onChange={e => setSearch(e.target.value)} /></label>
    <nav aria-label="全部组件索引" className="mb-6 flex flex-wrap gap-2">{entries.map(entry => <a key={entry.name} href={`#${entry.name}`} onClick={() => setSearch("")} className="rounded-full border border-border px-3 py-1 text-xs hover:border-primary">{entry.name}</a>)}</nav>
    <p className="mb-3 text-xs text-muted-foreground">显示 {visible.length} / {entries.length} 个组件 · 手机端每行改为预览在上、参数在下</p>
    <div className="space-y-6">{visible.map(entry => <ComponentRow key={entry.name} entry={entry} />)}</div>
    {visible.length === 0 && <p role="status" className="py-8 text-center text-sm text-muted-foreground">没有匹配的组件</p>}
  </main>
}
