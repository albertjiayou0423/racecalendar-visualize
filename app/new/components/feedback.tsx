"use client"

import { useShake } from "@/components/interface-motion"
import { useEffect, useRef, useState } from "react"
import { X } from "lucide-react"
import { useFocusTrap } from "@/lib/use-focus-trap"
import { apiJson } from "../data"

export function SimpleFeedback({ onClose, preview = false }: { onClose: () => void; preview?: boolean }) {
  const shake = useShake()
  const dialog = useRef<HTMLDivElement>(null)
  useFocusTrap(dialog, true)
  const [type, setType] = useState("suggestion")
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [email, setEmail] = useState("")
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState("")
  const [sent, setSent] = useState(false)
  useEffect(() => {
    const previous = document.body.style.overflow
    document.body.style.overflow = "hidden"
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") onClose() }
    window.addEventListener("keydown", escape)
    return () => { document.body.style.overflow = previous; window.removeEventListener("keydown", escape) }
  }, [onClose])
  async function send(event: React.FormEvent) {
    event.preventDefault()
    if (preview) { setMessage("组件预览，不提交反馈"); return }
    if (busy) return
    setBusy(true); setMessage("")
    try { await apiJson("/api/feedback", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type, title: title.trim(), description: description.trim(), email: email.trim() || undefined }) }); setSent(true) }
    catch (error) { setMessage(error instanceof Error ? error.message : "提交失败，请重试") }
    finally { setBusy(false) }
  }
  return <div className="s-modal-backdrop" onClick={onClose}><div className="s-modal" ref={dialog} role="dialog" aria-modal="true" aria-labelledby="simple-feedback-title" onClick={event => event.stopPropagation()}><div className="s-between"><h2 id="simple-feedback-title">提建议 / 报 Bug</h2><button type="button" className="s-icon" aria-label="关闭反馈" onClick={onClose}><X size={17} /></button></div>{sent ? <div className="s-empty"><p>反馈已收到，谢谢你。</p><button className="s-button" onClick={onClose}>完成</button></div> : <form className="s-form" onInvalidCapture={event => shake(event.target as HTMLElement)} onSubmit={send}><label>类型<select value={type} onChange={event => setType(event.target.value)}><option value="suggestion">优化建议</option><option value="bug">Bug 报告</option><option value="feature">功能建议</option><option value="other">其他反馈</option></select></label><label>标题<input required maxLength={120} value={title} onChange={event => setTitle(event.target.value)} /></label><label>详细说明<textarea required rows={5} maxLength={5000} value={description} onChange={event => setDescription(event.target.value)} /></label><label>邮箱（选填）<input type="email" maxLength={200} value={email} onChange={event => setEmail(event.target.value)} /></label><p role="status" className="s-note">{message || "仅提交你填写的内容，不自动附带设备信息。"}</p><button className="s-button" type="submit" disabled={busy}>{busy ? "提交中…" : "提交反馈"}</button></form>}</div></div>
}
