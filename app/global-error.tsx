'use client'

import * as Sentry from '@sentry/nextjs'
import { useEffect } from 'react'
import './globals.css'

export default function GlobalError({
  error,
  reset,
}: Readonly<{
  error: Error & { digest?: string }
  reset: () => void
}>) {
  useEffect(() => {
    Sentry.captureException(error)
  }, [error])

  return (
    <html lang="zh-CN">
      <body className="min-h-screen bg-background text-foreground antialiased">
        <main className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
          <h1 className="text-xl font-semibold">页面暂时遇到问题</h1>
          <p className="max-w-md text-sm text-muted-foreground">
            错误信息已自动记录。请稍后重试。
          </p>
          <button
            className="rounded-full border border-border px-5 py-2 text-sm transition-colors hover:bg-muted"
            onClick={reset}
            type="button"
          >
            重新加载
          </button>
        </main>
      </body>
    </html>
  )
}
