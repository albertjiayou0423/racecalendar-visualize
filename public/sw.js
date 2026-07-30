// 赛道时刻 Service Worker — 离线缓存核心页面
const CACHE_NAME = "race-calendar-v1"
const CORE_ASSETS = ["/", "/about", "/standings", "/circuits"]

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(CORE_ASSETS).catch(() => {}))
  )
  self.skipWaiting()
})

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  )
  self.clients.claim()
})

// 网络优先，失败回退缓存（适合数据频繁更新的赛程）
self.addEventListener("fetch", (event) => {
  const { request } = event
  if (request.method !== "GET") return

  // API 请求：网络优先，失败回退缓存
  if (request.url.includes("/api/")) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const clone = response.clone()
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone))
          return response
        })
        .catch(() => caches.match(request))
    )
    return
  }

  // 静态资源和页面：缓存优先，回退网络
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached
      return fetch(request)
        .then((response) => {
          if (!response || response.status !== 200 || response.type !== "basic") return response
          const clone = response.clone()
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone))
          return response
        })
        .catch(() => {
          // 离线时回退到首页
          if (request.mode === "navigate") return caches.match("/")
          return new Response("", { status: 503 })
        })
    })
  )
})
