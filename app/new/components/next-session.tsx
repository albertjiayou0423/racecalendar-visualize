"use client"

import Link from "next/link"
import { ArrowUpRight, Maximize2 } from "lucide-react"
import { formatDateTime, BEIJING_TZ } from "@/lib/format"
import type { StartSelection } from "../model"
import { CompactCountdown, SeriesBadge } from "./primitives"

export function SimpleNextSession({ start, now, onStart }: { start?: StartSelection; now: number; onStart: (selection: StartSelection) => void }) {
  if (!start) return <section className="s-next s-next-empty" aria-label="下一场赛事"><span>下一场</span><p>暂无已确认的未来场次</p></section>
  return <section className="s-next" aria-label="下一场赛事"><div className="s-next-copy"><div className="s-inline"><span className="s-muted">下一场</span><SeriesBadge series={start.event.series} /></div><Link href={`/new/event/${start.event.id}`} className="s-next-title">{start.event.name}<ArrowUpRight size={14} aria-hidden="true" /></Link><p>{start.session.name}<span> · {formatDateTime(start.session.utc, BEIJING_TZ)}</span></p></div><button type="button" className="s-next-timer" aria-label="进入下一场沉浸式倒计时" onClick={() => onStart(start)}><CompactCountdown utc={start.session.utc} now={now} /><small><Maximize2 size={12} aria-hidden="true" />沉浸倒计时</small></button></section>
}
