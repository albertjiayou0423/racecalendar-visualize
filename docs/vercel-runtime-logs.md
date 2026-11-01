# Vercel 运行日志

服务端 API 使用单行 JSON 结构化日志。部署后在 Vercel 项目的 **Logs → Runtime Logs** 中搜索 `event` 字段，即可按事件定位错误；每条日志包含 UTC 时间、级别和少量上下文。

常用事件：

- `api.schedule.*`：赛历数据库初始化、快照读取、上游数据不可用、配额检查和后台刷新。
- `api.predictions.*`：预测投票读取/提交、AI 上游失败和候选处理。
- `api.weather.*`：天气服务重试、地理编码失败和上游错误。
- `api.*.fetch_failed`：赛果、车手名单和积分榜上游获取失败。
- `api.client_crawl.*`：客户端补充采集接口的数据库或任务失败。

日志不会记录请求正文、投票者标识、完整 URL、坐标或凭据。新增服务端日志时使用 `lib/server-log.ts`，只传必要的状态码、系列、阶段等低敏上下文，不要直接输出请求对象、响应正文或密钥。

## 邮件通知

- `RESEND_API_KEY`、`RESEND_FROM_EMAIL`、`ALERT_MAIL_TO` 仅由服务端读取；API Key 不得进入客户端代码。
- `/api/cron/notifications` 每天北京时间约 09:00 执行一次，仅读取数据库快照，不触发赛历爬取。每月 1 日发送上月赛历可用性采样摘要；Vercel Hobby 的定时精度可能在目标小时内浮动。
- Vercel Cron 只在 Production Deployment 执行，不在 Preview 执行；开发分支预览可验证构建，但月报要等该配置进入生产部署后才会定时发送。
- 用户访问赛历时若 F1、FE、WRC 同时不可用，会发送重大故障邮件，同一故障最多每 6 小时一次；定时检查无法连接数据库时，每天最多发送一次数据库告警。
- 健康记录按服务和北京时间日期聚合，月报的计数来自实际请求与每日快照检查，不等于持续探测或站点 uptime。没有访客时，只有每日快照检查仍会运行。
- 必须配置 `CRON_SECRET`。Vercel Cron 使用 `Authorization: Bearer <CRON_SECRET>` 调用接口；未配置时接口会失败关闭，不发送邮件。
