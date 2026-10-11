"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { ChevronLeft, ChevronRight, Download, Share2, X } from "lucide-react"
import type { RaceEvent, Series } from "@/lib/types"
import { weekendRange, weekendSessions } from "@/lib/weekend"
import { weekendShareSvg, SHARE_ROWS_PER_PAGE } from "@/lib/weekend-share"
import { downloadFile } from "@/lib/download"
import { formatDateTime, BEIJING_TZ } from "@/lib/format"

export function WeekendPlanner({ events, now, followed }: { events: RaceEvent[]; now: number; followed: Series[] }) {
  const [offset, setOffset] = useState(0)
  const [mainOnly, setMainOnly] = useState(false)
  const [sharing, setSharing] = useState(false)
  const dialog = useRef<HTMLDialogElement>(null)
  useEffect(() => { const element = dialog.current; if (!element) return; if (sharing && !element.open) element.showModal(); if (!sharing && element.open) element.close() }, [sharing])
  const [page, setPage] = useState(0)
  const [error, setError] = useState("")
  const [saving, setSaving] = useState(false)
  const rows = useMemo(() => weekendSessions(events, now, followed, offset).filter(row => !mainOnly || row.session.isMain), [events, now, followed, offset, mainOnly])
  const range = weekendRange(now, offset)
  const date = (time: number) => new Intl.DateTimeFormat("zh-CN", { timeZone: BEIJING_TZ, month: "numeric", day: "numeric" }).format(time)
  const title = `${date(range.start)} — ${date(range.end - 1)}`
  const pages = Math.max(1, Math.ceil(rows.length / SHARE_ROWS_PER_PAGE))
  const safePage = Math.min(page, pages - 1)
  const svg = weekendShareSvg(rows, title, safePage)
  const preview = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
  async function save() {
    setSaving(true); setError("")
    try {
      const image = new Image()
      await new Promise<void>((resolve, reject) => { image.onload = () => resolve(); image.onerror = () => reject(new Error()); image.src = preview })
      const canvas = document.createElement("canvas"); canvas.width = 1080; canvas.height = 1440
      const context = canvas.getContext("2d"); if (!context) throw new Error()
      context.drawImage(image, 0, 0)
      const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(b => b ? resolve(b) : reject(new Error()), "image/png"))
      downloadFile(URL.createObjectURL(blob), `racecalendar-weekend-${safePage + 1}.png`, true)
    } catch { setError("图片生成失败，请重试。") } finally { setSaving(false) }
  }
  return <section className="rounded-2xl border border-border bg-card p-4 sm:p-6" aria-label="周末观赛清单">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-semibold">这个周末看什么</h2><p className="mt-1 text-xs text-muted-foreground">{title} · 北京时间</p></div><div className="flex gap-2"><button aria-label="上个周末" onClick={() => setOffset(offset - 1)} className="rounded border p-2"><ChevronLeft className="size-4" /></button><button onClick={() => setOffset(0)} className="rounded border px-3 text-xs">本周末</button><button aria-label="下个周末" onClick={() => setOffset(offset + 1)} className="rounded border p-2"><ChevronRight className="size-4" /></button></div></div>
    <div className="my-4 flex flex-wrap items-center justify-between gap-3"><label className="flex gap-2 text-sm"><input type="checkbox" checked={mainOnly} onChange={e => setMainOnly(e.target.checked)} />只看主赛事</label><button onClick={() => { setSharing(true); setPage(0) }} disabled={!rows.length} className="inline-flex items-center gap-2 rounded-full border px-3 py-2 text-xs disabled:opacity-40"><Share2 className="size-3.5" />分享周末赛程图</button></div>
    <p className="mb-4 text-xs text-muted-foreground">按关注系列展示。重叠提示按主赛事约 2 小时、其他场次约 1 小时估算，实际结束时间可能不同。</p>
    {!rows.length ? <p className="py-8 text-center text-sm text-muted-foreground">这个周末没有匹配的场次，可以调整关注系列或查看下周末。</p> : <ol className="space-y-2">{rows.map(row => <li key={row.id} className="rounded-xl border border-border p-3"><div className="flex flex-wrap justify-between gap-2"><Link href={`/event/${row.event.id}`} className="text-sm font-medium hover:underline">{row.event.series} · {row.event.name}</Link><span className="text-xs text-muted-foreground">{row.session.name}</span></div><p className="mt-2 text-sm tabular-nums">{row.estimated ? "时间待确认" : formatDateTime(row.session.utc, BEIJING_TZ)}</p>{row.conflicts.length > 0 && <p className="mt-1 text-xs text-amber-500">与其他赛事场次可能重叠</p>}</li>)}</ol>}
    <dialog ref={dialog} onCancel={() => setSharing(false)} className="fixed inset-0 m-auto max-h-[92dvh] w-[calc(100%-2rem)] max-w-sm overflow-auto rounded-2xl border bg-card p-0 text-foreground backdrop:bg-black/80" aria-label="周末赛程分享图"><div className="max-h-[92dvh] w-full max-w-sm overflow-auto rounded-2xl border bg-card p-4"><div className="mb-3 flex items-center justify-between"><h3 className="text-sm font-medium">分享赛程 · {safePage + 1}/{pages}</h3><button autoFocus aria-label="关闭分享" onClick={() => setSharing(false)}><X className="size-5" /></button></div><img src={preview} alt="根据真实赛程生成的周末观赛清单" className="w-full rounded-lg" /><div className="mt-3 flex flex-wrap justify-between gap-2"><button disabled={safePage === 0} onClick={() => setPage(safePage - 1)} className="rounded border px-3 py-2 text-xs disabled:opacity-40">上一张</button><button disabled={saving} onClick={save} className="inline-flex items-center gap-2 rounded border px-3 py-2 text-xs"><Download className="size-4" />{saving ? "生成中…" : "保存 PNG"}</button><button disabled={safePage + 1 >= pages} onClick={() => setPage(safePage + 1)} className="rounded border px-3 py-2 text-xs disabled:opacity-40">下一张</button></div>{error && <p role="alert" className="mt-2 text-xs text-destructive">{error}</p>}</div></dialog>
  </section>
}
