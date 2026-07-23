"use client"

import { useEffect, useState } from "react"
import { Sun, Moon } from "lucide-react"

const STORAGE_KEY = "race-theme"

/** 暗色/亮色主题切换按钮 */
export function ThemeToggle() {
  const [dark, setDark] = useState<boolean | null>(null)

  useEffect(() => {
    // 读取用户偏好，若无则跟随系统
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored === "dark") {
      setDark(true)
    } else if (stored === "light") {
      setDark(false)
    } else {
      setDark(window.matchMedia("(prefers-color-scheme: dark)").matches)
    }
  }, [])

  useEffect(() => {
    if (dark === null) return
    if (dark) {
      document.documentElement.classList.add("dark")
    } else {
      document.documentElement.classList.remove("dark")
    }
  }, [dark])

  // 未挂载时不渲染图标，避免闪烁
  if (dark === null) {
    return (
      <button
        type="button"
        className="size-9 rounded-full border border-border bg-card"
        aria-label="切换主题"
      />
    )
  }

  return (
    <button
      type="button"
      onClick={() => {
        const next = !dark
        setDark(next)
        localStorage.setItem(STORAGE_KEY, next ? "dark" : "light")
      }}
      className="inline-flex size-9 items-center justify-center rounded-full border border-border bg-card text-muted-foreground transition-colors hover:text-foreground"
      aria-label={dark ? "切换到亮色主题" : "切换到暗色主题"}
    >
      {dark ? <Sun className="size-4" /> : <Moon className="size-4" />}
    </button>
  )
}
