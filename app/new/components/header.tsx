"use client"

import { MotionText } from "@/components/interface-motion"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { formatTime, BEIJING_TZ } from "@/lib/format"

export function SimpleHeader({ now }: { now: number }) {
  return <header className="s-header"><div><h1><MotionText text="赛道时刻" /><span>简洁版</span></h1><p>赛车赛程，刚好够用。</p></div><div className="s-header-side"><span className="s-clock">{formatTime(new Date(now).toISOString(), BEIJING_TZ)}<small>北京</small></span><Link href="/?home=classic" className="s-link"><ArrowLeft size={13} aria-hidden="true" />旧版</Link></div></header>
}
