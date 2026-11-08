# 待办

- [ ] 增加浏览器推送通知：用户关闭网页后，仍可通过已授权的浏览器通知收到项目告警。需设计 Push API、Service Worker、订阅管理与服务端发送流程，并保留 ntfy 作为现有外部通知渠道。
- [ ] 排查生产 WRC 历史赛果接口 `/api/results?series=WRC&season=2026` 当前返回 HTTP 400（“系列或赛季参数无效”），修复后确认 `/status` 监控恢复。
