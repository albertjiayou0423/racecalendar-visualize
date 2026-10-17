"use client"

import { useEffect } from "react"

export function SWRegister() {
  useEffect(() => {
    if (window.location.pathname.startsWith("/playground") || window.location.pathname.startsWith("/new/playground")) return
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      navigator.serviceWorker.register("/sw.js").catch(() => {})
    }
  }, [])
  return null
}
