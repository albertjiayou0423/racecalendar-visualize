// Service Worker - 处理 Web Push 推送通知

// 监听推送事件
self.addEventListener("push", (event) => {
  let data = {
    title: "赛事提醒",
    body: "即将开始的比赛",
    icon: "/icon.svg",
    url: "/",
  }

  // 解析推送数据
  if (event.data) {
    try {
      const parsed = event.data.json()
      data = { ...data, ...parsed }
    } catch {
      // 如果不是 JSON，尝试纯文本
      data.body = event.data.text() || data.body
    }
  }

  const options = {
    body: data.body,
    icon: data.icon,
    badge: data.icon,
    tag: data.tag || "race-reminder",
    data: {
      url: data.url || "/",
    },
  }

  event.waitUntil(self.registration.showNotification(data.title, options))
})

// 监听通知点击事件
self.addEventListener("notificationclick", (event) => {
  event.notification.close()

  const url = event.notification.data?.url || "/"

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      // 如果已有打开的窗口，聚焦到该窗口
      for (const client of clients) {
        if (client.url.includes(self.location.origin) && "focus" in client) {
          return client.navigate(url).then(() => client.focus())
        }
      }
      // 否则打开新窗口
      return self.clients.openWindow(url)
    })
  )
})

// 监听推送订阅变更事件
self.addEventListener("pushsubscriptionchange", (event) => {
  // 当订阅过期或变更时，尝试重新订阅
  event.waitUntil(
    self.registration.pushManager
      .subscribe({
        userVisibleOnly: true,
        // 注意：applicationServerKey 需要从服务器重新获取
        // 这里无法直接访问环境变量，所以重新订阅后由前端处理保存
      })
      .then((subscription) => {
        // 通知前端订阅已变更，由前端负责将新订阅发送到服务器
        return self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
          for (const client of clients) {
            client.postMessage({
              type: "PUSH_SUBSCRIPTION_CHANGED",
              subscription: subscription.toJSON(),
            })
          }
        })
      })
      .catch((err) => {
        console.error("重新订阅推送失败:", err)
      })
  )
})
