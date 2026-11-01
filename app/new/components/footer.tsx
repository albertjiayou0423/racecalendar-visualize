"use client"

import { useState } from "react"
import dynamic from "next/dynamic"
import Link from "next/link"
import { MessageSquarePlus, ArrowUp, Bell } from "lucide-react"
import type { RaceEvent } from "@/lib/types"
import { PixelRippleWordmark } from "@/components/pixel-ripple-wordmark"

const FeedbackForm = dynamic(() => import("./feedback").then(module => module.SimpleFeedback), { ssr: false })
const NotificationManager = dynamic(() => import("@/components/notification-manager").then(module => module.NotificationManager), { ssr: false })
export function SimpleReminder({ events }: { events: RaceEvent[] }) {
  const [open, setOpen] = useState(false)
  return <div className="s-reminder"><button type="button" className="s-link" aria-expanded={open} onClick={() => setOpen(value => !value)}><Bell size={14} aria-hidden="true" />开赛提醒</button>{open && <div className="s-reminder-panel"><p className="s-note">在浏览器支持并已授权时提醒；页面关闭后的提醒取决于浏览器能力。</p><NotificationManager events={events} /></div>}</div>
}
export function SimpleFooter() {
  const [feedback, setFeedback] = useState(false)
  return <footer className="s-footer"><PixelRippleWordmark /><button type="button" className="s-button" onClick={() => setFeedback(true)}><MessageSquarePlus size={14} aria-hidden="true" />提建议 / 报 Bug</button><nav aria-label="更多功能">{[["/standings", "积分榜"], ["/results", "赛果"], ["/wallpaper", "日历壁纸"], ["/circuits", "赛道"], ["/about", "v2.3.3 · 更新日志"], ["/developer", "开发者"], ["/playground", "组件"], ["/admin", "后台"]].map(([href, label]) => <Link key={href} href={`/new${href}`}>{label}</Link>)}<Link href="/?home=classic">旧版首页</Link></nav><div className="s-footer-note"><span>北京时间主视图 · 赛程以赛事官方公布为准</span><button type="button" className="s-link" onClick={() => window.scrollTo({ top: 0, behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" })}><ArrowUp size={13} aria-hidden="true" />顶部</button></div>{feedback && <FeedbackForm onClose={() => setFeedback(false)} />}</footer>
}
