"use client"

import { ArrowLeft, Cat, Globe, Heart, Shield, Sparkles } from "lucide-react"
import Link from "next/link"
import Image from "next/image"

export default function DeveloperPage() {
  return (
    <div className="mx-auto flex min-h-dvh max-w-2xl flex-col justify-between px-4 py-8 sm:py-12">
      <div className="flex flex-col gap-8">
        <header className="flex items-center gap-4">
          <Link
            href="/"
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground transition-colors hover:text-foreground"
            aria-label="返回首页"
          >
            <ArrowLeft className="size-4" />
          </Link>
          <div>
            <h1 className="text-xl font-bold tracking-tight sm:text-2xl">开发者信息</h1>
            <p className="text-xs text-muted-foreground">About the Developer & Project</p>
          </div>
        </header>

        <section className="relative overflow-hidden rounded-2xl border border-border bg-card p-6 sm:p-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6 border-b border-border pb-6">
            <div className="flex items-center gap-4">
              <div className="relative size-16 overflow-hidden rounded-xl bg-muted border border-border p-1">
                <Image
                  src="/brand-logo.svg"
                  alt="Huo_sai Logo"
                  fill
                  className="object-contain"
                  priority
                />
              </div>
              <div className="space-y-1">
                <div className="text-xs font-semibold tracking-wider text-primary uppercase">Project Author</div>
                <h2 className="text-2xl font-black tracking-tight text-foreground sm:text-3xl">Huo_sai</h2>
              </div>
            </div>

            <div className="relative h-14 w-full sm:w-48 self-center sm:self-auto opacity-90 hover:opacity-100 transition-opacity bg-zinc-900/50 dark:bg-zinc-950/40 rounded-lg p-1 flex items-center justify-center border border-border/40">
              <Image
                src="/animated.svg"
                alt="Huo_sai Signature"
                fill
                className="object-contain px-2 py-1"
                unoptimized
              />
            </div>
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <a
              href="https://github.com/albertjiayou0423"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-lg bg-foreground px-4 py-2 text-xs font-semibold text-background transition-all hover:bg-foreground/90 hover:scale-[1.02] active:scale-[0.98] shadow-sm"
            >
              <Cat className="size-4" />
              GitHub 主页
            </a>
            <Link
              href="/"
              className="inline-flex items-center gap-2 rounded-lg border border-border bg-muted/50 px-4 py-2 text-xs font-semibold text-muted-foreground transition-all hover:bg-muted hover:text-foreground hover:scale-[1.02]"
            >
              <Globe className="size-4" />
              赛程首页
            </Link>
          </div>
        </section>

        <section className="flex flex-col gap-4">
          <h3 className="text-base font-bold text-foreground/90 flex items-center gap-2">
            <Sparkles className="size-4 text-primary" />
            项目简述
          </h3>
          <div className="rounded-2xl border border-border bg-card p-6 text-sm leading-relaxed text-muted-foreground space-y-4">
            <p>
              <strong>赛道时刻（RaceCalendar Visualize）</strong> 是专为赛车运动爱好者精心打造的专业赛程时间表工具。项目支持
              <span className="text-foreground font-medium"> WRC（世界拉力锦标赛）</span>、
              <span className="text-foreground font-medium"> F1（世界一级方程式锦标赛）</span> 与
              <span className="text-foreground font-medium"> Formula E（世界电动方程式锦标赛）</span> 三大顶级赛事。
            </p>
            <p>
              我们深知广大车迷在观赛时的痛点，因此工具不仅支持本地时间与北京时间（UTC+8）的多时区智能转换，还细心地整合了腾讯视频、五星体育等中国大陆的主流直播与转播信息，让您不错过任何一个极速瞬间。
            </p>
            <p>
              为了追求极致的使用体验，项目采用了基于 Next.js 16 App Router 的超高性能架构，配合 Tailwind CSS、SWR 缓存、Neon PostgreSQL 数据库等前沿技术。同时，通过多级 Fallback 爬虫容灾架构，确保赛事数据的实时准确与高可用，让每一次的极速狂飙都能精准呈现在您的屏幕前。
            </p>
          </div>
        </section>
      </div>

      <footer className="mt-12 border-t border-border pt-4 text-center text-xs text-muted-foreground flex flex-col items-center gap-2">
        <div className="flex items-center gap-1">
          <span>Made with</span>
          <Heart className="size-3 text-red-500 fill-red-500 animate-pulse" />
          <span>by Huo_sai</span>
        </div>
        <div>© 2026 赛道时刻 · 保留所有权利</div>
      </footer>
    </div>
  )
}