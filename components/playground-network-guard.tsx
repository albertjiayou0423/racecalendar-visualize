"use client"

if (typeof window !== "undefined" && !("__playgroundNetworkGuard" in window)) {
  const originalFetch = window.fetch.bind(window)
  const guardedFetch = function PlaygroundNetworkGuard(input: RequestInfo | URL, init?: RequestInit) {
    if (!window.location.pathname.startsWith("/playground")) return originalFetch(input, init)
    const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url, window.location.href)
    if (url.origin === window.location.origin && !url.pathname.startsWith("/api/")) return originalFetch(input, init)
    return Promise.reject(new TypeError("Playground 中已阻止业务接口及外部网络请求"))
  }
  window.fetch = guardedFetch
  Object.defineProperty(window, "__playgroundNetworkGuard", { value: true })
}

export function PlaygroundNetworkGuard() { return null }
