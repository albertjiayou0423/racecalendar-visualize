"use client"
import { useEffect, useState } from "react"
import { Copy, CalendarPlus } from "lucide-react"
import { useViewerPreferences } from "@/components/viewer-preferences"
export function CalendarSubscription() {
  const { preferences } = useViewerPreferences()
  const [origin, setOrigin] = useState("")
  const [all, setAll] = useState(false)
  const [message, setMessage] = useState("")
  useEffect(() => { setOrigin(window.location.origin) }, [])
  const query = new URLSearchParams({ series: preferences.followed.join(","), sessions: all ? "all" : "main" })
  const url = `${origin}/api/calendar/subscribe?${query}`
  const disabled = !origin || !preferences.followed.length
  async function copy() { try { await navigator.clipboard.writeText(url); setMessage("订阅地址已复制") } catch { setMessage("复制不可用，请选中下方地址手动复制") } }
  return <details className="rounded-xl border border-border bg-card p-4"><summary className="cursor-pointer text-sm font-medium">订阅日历，让赛程自动更新</summary><p className="my-3 text-xs text-muted-foreground">订阅你的关注系列。Apple 日历可直接打开；Google 日历 / Outlook 使用「从网址添加」粘贴下方地址。更新频率由日历应用决定，时间调整不会立刻同步。待确认时间不进入订阅。</p><label className="flex gap-2 text-sm"><input type="checkbox" checked={all} onChange={e => { setAll(e.target.checked); setMessage("") }} />包括练习、排位和其他已确认场次</label><div className="mt-3 flex flex-wrap gap-2"><a aria-disabled={disabled} href={disabled ? undefined : url.replace(/^https?:/, "webcal:")} className="inline-flex items-center gap-2 rounded-full border px-3 py-2 text-xs"><CalendarPlus className="size-4" />订阅到日历</a><button disabled={disabled} onClick={copy} className="inline-flex items-center gap-2 rounded-full border px-3 py-2 text-xs disabled:opacity-40"><Copy className="size-4" />复制订阅地址</button></div>{disabled ? <p className="mt-3 text-xs">先选择至少一个关注系列。</p> : <input aria-label="日历订阅地址" value={url} readOnly className="mt-3 w-full rounded border bg-background p-2 text-xs" onFocus={e => e.target.select()} />}<p className="mt-2 text-xs text-muted-foreground" role="status">{message}</p></details>
}
