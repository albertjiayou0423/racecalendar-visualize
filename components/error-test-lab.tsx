"use client"

import * as Sentry from "@sentry/nextjs"
import { Component, type ErrorInfo, type ReactNode, useState } from "react"
import { AlertTriangle, ArrowLeft, Bug, RotateCcw } from "lucide-react"
import Link from "@/components/edition-link"

const sentryConfigured = Boolean(process.env.NEXT_PUBLIC_SENTRY_DSN)

type TestBoundaryProps = {
  children: ReactNode
  onCaptured: (error: Error) => void
  onReset: () => void
}

type TestBoundaryState = { hasError: boolean }

class TestBoundary extends Component<TestBoundaryProps, TestBoundaryState> {
  state: TestBoundaryState = { hasError: false }

  static getDerivedStateFromError(): TestBoundaryState {
    return { hasError: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    Sentry.withScope((scope) => {
      scope.setTag("errtest.kind", "react-render")
      scope.setContext("react", { componentStack: info.componentStack })
      Sentry.captureException(error)
    })
    this.props.onCaptured(error)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div role="alert" className="flex flex-col items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4">
          <p className="text-sm font-medium">渲染异常已被本页错误边界接住，并尝试上报 Sentry。</p>
          <button type="button" onClick={this.props.onReset} className="inline-flex items-center gap-2 rounded-full border border-border px-3 py-1.5 text-xs hover:bg-accent">
            <RotateCcw className="size-3.5" aria-hidden />
            重置此测试
          </button>
        </div>
      )
    }

    return this.props.children
  }
}

function RenderFailure({ runId }: { runId: number }): never {
  throw new Error(`[ERRTEST:react-render] Render failure ${runId}`)
}

function ErrorCard({
  title,
  description,
  kind,
  onTrigger,
}: {
  title: string
  description: string
  kind: string
  onTrigger: () => void
}) {
  return (
    <article className="flex flex-col justify-between gap-5 border-b border-border py-5 sm:flex-row sm:items-center">
      <div className="min-w-0">
        <p className="font-medium">{title}</p>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        <code className="mt-2 inline-block text-xs text-muted-foreground">[ERRTEST:{kind}]</code>
      </div>
      <button type="button" onClick={onTrigger} className="inline-flex shrink-0 items-center justify-center gap-2 self-start rounded-full border border-border px-4 py-2 text-sm transition-colors hover:border-destructive/50 hover:bg-destructive/5 sm:self-center">
        <Bug className="size-4" aria-hidden />
        触发测试
      </button>
    </article>
  )
}

export default function ErrorTestLab() {
  const [lastEvent, setLastEvent] = useState("")
  const [renderRunId, setRenderRunId] = useState(0)
  const [renderTestActive, setRenderTestActive] = useState(false)
  const [renderBoundaryKey, setRenderBoundaryKey] = useState(0)
  const [nextRenderId, setNextRenderId] = useState(0)

  const recordAttempt = (label: string) => {
    setLastEvent(`${label} · ${new Date().toLocaleTimeString()}`)
  }

  const captureManualException = (kind: string, message: string) => {
    Sentry.withScope((scope) => {
      scope.setTag("errtest.kind", kind)
      Sentry.captureException(new Error(`[ERRTEST:${kind}] ${message}`))
    })
    recordAttempt(`已手动上报：${kind}`)
  }

  const resetRenderTest = () => {
    setRenderTestActive(false)
    setRenderBoundaryKey((value) => value + 1)
  }

  return (
    <main className="mx-auto min-h-screen max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
      <Link href="/playground" className="mb-8 inline-flex items-center gap-2 rounded-full border border-border px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground">
        <ArrowLeft className="size-4" aria-hidden />
        返回 Playground
      </Link>

      <header className="mb-8 space-y-3">
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">Developer tools · Sentry</p>
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">前端错误实验室</h1>
        <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
          手动触发浏览器端异常，检查 Sentry 是否收到。页面加载时不会自动制造错误；每次点击都会产生一条测试事件。
        </p>
      </header>

      <section className="mb-8 flex items-start gap-3 rounded-xl border border-border p-4" aria-live="polite">
        {sentryConfigured ? (
          <span className="mt-1 size-2 shrink-0 rounded-full bg-emerald-500" aria-hidden />
        ) : (
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-500" aria-hidden />
        )}
        <div className="min-w-0">
          <p className="text-sm font-medium">Sentry {sentryConfigured ? "已配置" : "未配置"}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {lastEvent || (sentryConfigured ? "当前部署已提供 DSN。选中一项测试后，再去 Sentry 的 Issues 查看 [ERRTEST] 事件。" : "当前部署没有公开 Sentry DSN；异常仍会在浏览器控制台出现，但不会上传。")}
          </p>
        </div>
      </section>

      <section className="divide-y divide-border border-t border-border" aria-label="错误类型">
        <ErrorCard
          title="未捕获的 JavaScript 异常"
          description="通过浏览器全局错误处理器捕获，模拟事件回调之外的同步崩溃。"
          kind="uncaught"
          onTrigger={() => {
            recordAttempt("已触发：未捕获 JavaScript 异常")
            window.setTimeout(() => {
              throw new Error("[ERRTEST:uncaught] Manual browser runtime exception")
            }, 0)
          }}
        />
        <ErrorCard
          title="未处理的 Promise 拒绝"
          description="触发 unhandledrejection，验证异步异常捕获。"
          kind="unhandled-rejection"
          onTrigger={() => {
            recordAttempt("已触发：未处理 Promise 拒绝")
            void Promise.resolve().then(() => {
              throw new Error("[ERRTEST:unhandled-rejection] Manual rejected promise")
            })
          }}
        />
        <ErrorCard
          title="React 渲染异常"
          description="在隔离的 React 错误边界内抛错；边界会捕获并单独上报，不会让整页崩溃。"
          kind="react-render"
          onTrigger={() => {
            setRenderRunId((id) => id + 1)
            setRenderTestActive(true)
          }}
        />
        <div className="py-4">
          <TestBoundary
            key={renderBoundaryKey}
            onCaptured={() => recordAttempt("已捕获并上报：React 渲染异常")}
            onReset={resetRenderTest}
          >
            {renderTestActive ? <RenderFailure runId={renderRunId} /> : <p className="text-xs text-muted-foreground">React 测试组件待命。</p>}
          </TestBoundary>
        </div>
        <ErrorCard
          title="手动捕获异常"
          description="模拟 try/catch 后由应用主动调用 Sentry.captureException。"
          kind="manual-capture"
          onTrigger={() => captureManualException("manual-capture", "Caught exception sent by the test page")}
        />
        <ErrorCard
          title="错误级别消息"
          description="发送一条 error 级别消息，不附带异常堆栈。"
          kind="message"
          onTrigger={() => {
            Sentry.withScope((scope) => {
              scope.setTag("errtest.kind", "message")
              Sentry.captureMessage("[ERRTEST:message] Manual Sentry error-level message", "error")
            })
            recordAttempt("已手动上报：error 级别消息")
          }}
        />
      </section>
    </main>
  )
}
