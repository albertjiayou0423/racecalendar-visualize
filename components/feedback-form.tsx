"use client"

import { useState } from "react"
import { MessageSquarePlus, X, CheckCircle2, AlertCircle, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"

type FeedbackType = "bug" | "feature" | "suggestion" | "other"

interface FeedbackFormProps {
  onClose: () => void
}

const TYPE_OPTIONS: { value: FeedbackType; label: string; description: string }[] = [
  { value: "bug", label: "🐛 Bug 报告", description: "遇到了问题或错误" },
  { value: "feature", label: "✨ 功能建议", description: "想要添加新功能" },
  { value: "suggestion", label: "💡 优化建议", description: "改进现有功能" },
  { value: "other", label: "📝 其他反馈", description: "其他类型的反馈" },
]

export function FeedbackForm({ onClose }: FeedbackFormProps) {
  const [type, setType] = useState<FeedbackType>("bug")
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [email, setEmail] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle")
  const [message, setMessage] = useState("")

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!title.trim() || !description.trim()) {
      setStatus("error")
      setMessage("请填写标题和详细描述")
      return
    }

    setIsSubmitting(true)
    setStatus("idle")

    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          title: title.trim(),
          description: description.trim(),
          email: email.trim() || undefined,
        }),
      })

      if (res.ok) {
        const data = await res.json()
        setStatus("success")
        setMessage(data.message)
      } else {
        const data = await res.json().catch(() => ({ error: "提交失败" }))
        setStatus("error")
        setMessage(data.error || "提交失败，请稍后重试")
      }
    } catch {
      setStatus("error")
      setMessage("网络错误，请检查网络连接后重试")
    } finally {
      setIsSubmitting(false)
    }
  }

  if (status === "success") {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
        <div className="relative z-10 w-full max-w-md rounded-2xl border border-border bg-card p-8 text-center shadow-2xl">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/10">
            <CheckCircle2 className="size-8 text-emerald-500" />
          </div>
          <h3 className="text-xl font-bold">反馈已提交</h3>
          <p className="mt-2 text-sm text-muted-foreground">{message}</p>
          <button
            onClick={onClose}
            className="mt-6 rounded-lg bg-primary px-6 py-2.5 font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            关闭
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-md overflow-hidden rounded-2xl border border-border bg-card shadow-2xl">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div className="flex items-center gap-2">
            <MessageSquarePlus className="size-5 text-primary" />
            <h3 className="font-semibold">提交反馈</h3>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            aria-label="关闭"
          >
            <X className="size-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="mb-2 block text-sm font-medium">反馈类型</label>
            <div className="grid grid-cols-2 gap-2">
              {TYPE_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setType(option.value)}
                  className={cn(
                    "flex flex-col items-center gap-1 rounded-lg border px-3 py-3 text-left transition-all",
                    type === option.value
                      ? "border-primary bg-primary/10"
                      : "border-border bg-secondary/30 hover:border-muted-foreground/50"
                  )}
                >
                  <span className="text-sm font-medium">{option.label}</span>
                  <span className="text-[10px] text-muted-foreground">{option.description}</span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium">标题</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="简要描述你的反馈"
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none transition-colors focus:border-primary"
              maxLength={100}
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium">详细描述</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="请详细描述你的反馈，包括问题复现步骤（如果是 Bug）、预期行为等..."
              rows={5}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none transition-colors focus:border-primary resize-none"
              maxLength={2000}
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium">联系方式（可选）</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="如果你希望收到回复，请填写邮箱"
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none transition-colors focus:border-primary"
            />
          </div>

          {status === "error" && (
            <div className="flex items-center gap-2 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              <AlertCircle className="size-4" />
              {message}
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-lg border border-border px-4 py-2.5 text-sm font-medium transition-colors hover:bg-secondary"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  提交中...
                </>
              ) : (
                "提交反馈"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}