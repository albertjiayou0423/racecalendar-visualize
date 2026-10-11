"use client"

import { useEffect, useRef, useState } from "react"
import { componentCatalog, PLAYGROUND_NOW, type CatalogEntry, type CatalogProps } from "@/lib/playground-catalog"
import { PlaygroundComponentPreview } from "@/components/playground-preview"

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
  return <><textarea aria-label={label} rows={5} className={`${inputClass} font-mono text-xs`} value={draft} onChange={e => {
    setDraft(e.target.value)
    try { onChange(JSON.parse(e.target.value)); setError("") } catch { setError("JSON 格式无效") }
  }} />{error && <p role="status" className="text-xs text-destructive">{error}</p>}</>
}

function PropsEditor({ value, onChange, prefix = "" }: { value: CatalogProps; onChange: (value: CatalogProps) => void; prefix?: string }) {
  return <div className="space-y-3">{Object.entries(value).map(([key, item]) => {
    const label = `${prefix}${key}`
    const update = (next: unknown) => onChange({ ...value, [key]: next })
    if (item && typeof item === "object" && !Array.isArray(item)) return <details key={key} className="rounded-lg border border-border p-3"><summary className="cursor-pointer text-xs font-medium">{label}</summary><div className="mt-3"><PropsEditor value={item as CatalogProps} onChange={update} prefix={`${label}.`} /></div></details>
    if (Array.isArray(item) || item === null) return <details key={key} className="rounded-lg border border-border p-3"><summary className="cursor-pointer text-xs">{label} · {Array.isArray(item) ? `${item.length} 项` : "空值"}</summary><div className="mt-3"><JsonEditor value={item} onChange={update} label={label} /></div></details>
    const enumValues = Object.hasOwn(enums, key) ? enums[key] : undefined
    const dateValue = typeof item === "string" && /^\d{4}-\d\d-\d\dT/.test(item)
    const dateTimeValue = typeof item === "number" && /time|now/i.test(key)
    const toLocalInput = (value: string | number) => {
      const date = new Date(value)
      return Number.isNaN(date.getTime()) ? "" : new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
    }
    return <label key={key} className="block space-y-1.5 text-xs"><span className="font-mono text-muted-foreground">{label}</span>
      {typeof item === "boolean" ? <span className="ml-3"><input aria-label={label} type="checkbox" checked={item} onChange={e => update(e.target.checked)} /></span>
        : enumValues ? <select aria-label={label} className={inputClass} value={String(item)} onChange={e => update(e.target.value)}>{enumValues.map(option => <option key={option}>{option}</option>)}</select>
          : dateValue || dateTimeValue ? <input aria-label={label} className={inputClass} type="datetime-local" value={toLocalInput(item as string | number)} onChange={e => { if (e.target.value) update(dateTimeValue ? new Date(e.target.value).getTime() : new Date(e.target.value).toISOString()) }} />
            : <input aria-label={label} className={inputClass} type={typeof item === "number" ? "number" : "text"} value={String(item ?? "")} onChange={e => update(typeof item === "number" ? Number(e.target.value) : e.target.value)} />}
    </label>
  })}</div>
}

function ComponentRow({ entry }: { entry: CatalogEntry }) {
  const [props, setProps] = useState(entry.presets[0].props)
  const [preset, setPreset] = useState(0)
  const [widthPreset, setWidthPreset] = useState(0)
  const [mounted, setMounted] = useState(false)
  const row = useRef<HTMLElement>(null)
  const noProps = Object.keys(entry.presets[0].props).length === 0
  useEffect(() => {
    const target = row.current
    if (!target || !("IntersectionObserver" in window)) { setMounted(true); return }
    const observer = new IntersectionObserver(items => {
      if (items.some(item => item.isIntersecting)) { setMounted(true); observer.disconnect() }
    }, { rootMargin: "600px 0px" })
    observer.observe(target)
    return () => observer.disconnect()
  }, [])
  const previewWidth = widthPreset === 1 ? "20rem" : widthPreset === 2 ? "100%" : "36rem"
  return <article ref={row} id={entry.name} aria-label={`${entry.name} 组件`} className="border-b border-border py-4 last:border-0">
    <div className="grid min-w-0 lg:grid-cols-[minmax(0,1fr)_360px]">
      <section aria-label={`${entry.name} 组件预览`} className="min-w-0 p-2 sm:p-3">
        <h2 className="mb-4 font-mono text-sm font-semibold">{entry.name}</h2>
        <div className="min-h-16 rounded-lg" style={{ maxWidth: previewWidth }} onClickCapture={event => {
          if ((event.target as HTMLElement).closest("a")) { event.preventDefault(); event.stopPropagation() }
        }}>
          {mounted && <PlaygroundComponentPreview name={entry.name} props={props} />}
        </div>
      </section>
      <section aria-label={`${entry.name} 参数调整`} className="min-w-0 border-t border-border/60 p-3 lg:border-l lg:border-t-0">
        <div className="mb-4 flex flex-wrap gap-2" aria-label={`${entry.name} 预设`}>
          {entry.presets.map((item, index) => <button key={index} aria-pressed={noProps ? widthPreset === index : preset === index} className={`rounded-full border px-3 py-1.5 text-xs transition-colors ${(noProps ? widthPreset === index : preset === index) ? "border-primary bg-primary text-primary-foreground" : "border-border hover:border-primary"}`} onClick={() => {
            if (noProps) setWidthPreset(index)
            else { setProps(item.props); setPreset(index) }
          }}>{noProps ? ["默认", "窄屏", "全宽"][index] : item.label}</button>)}
        </div>
        {noProps ? <p className="text-xs text-muted-foreground">此组件没有可调 props。</p> : <>
          <PropsEditor value={props} onChange={next => { setProps(next); setPreset(-1) }} />
          <details className="mt-4 rounded-lg border border-border p-3"><summary className="cursor-pointer text-xs">编辑完整 props</summary><div className="mt-3"><JsonEditor label={`${entry.name} props JSON`} value={props} onChange={next => { if (next && typeof next === "object" && !Array.isArray(next)) { setProps(next as CatalogProps); setPreset(-1) } }} /></div></details>
        </>}
      </section>
    </div>
  </article>
}

export default function PlaygroundPage() {
  const [entries] = useState<CatalogEntry[]>(() => componentCatalog(PLAYGROUND_NOW))
  return <main className="mx-auto max-w-7xl space-y-4 px-3 py-4 sm:px-5">
    {entries.map(entry => <ComponentRow key={entry.name} entry={entry} />)}
  </main>
}
