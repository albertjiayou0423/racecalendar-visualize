# WRC 免费数据接口调研

检查时间：2026-10-11。本次未使用生产密钥，也未注册第三方账户。

## 官网接口

这里需要的是 HTTP 数据接口，不是额外开放的网络端口。官网使用 HTTPS 默认 443。

读取 `https://www.wrc.com/en/calendar` 的公开 HTML，获得 `rb3-prerender-data-cache` 和当前 startApp 脚本地址。预渲染缓存里包含 `/v3/api/graphql/v1/v3/content/...`、`/v3/api/graphql/v1/v3/feed/en-INT?...` 请求。当前仓库已经使用同一接口族。

对以下行程 Feed 做了不带密钥的 GET：

```text
https://www.wrc.com/v3/api/graphql/v1/v3/feed/en-INT
  ?disableUsageRestrictions=true
  &filter[type]=event-details
  &filter[uriSlug]=itinerary-wrc-croatia-rally-2026
  &page[limit]=1
  &rb3Locale=en
  &rb3Schema=v1:inlineContent
```

实测响应：HTTP 200、JSON、`data.items` 有四项。这证明该具体公开行程接口可以无密钥读取；不能推断所有赛事 slug 有效，也不代表官方承诺长期提供开放 API。赛历、官网行程和实时计时要分别核验。

优先改进建议：从官方页面缓存发现正确 itinerary slug 后直接请求 Feed，减少猜 slug、完整 HTML 抓取和第三方渲染。保留已确认快照，控制更新范围和请求数。

## Blacktop 免费版

[WRC 官方产品文档](https://blacktop.live/api/wrc)当前列出 `/v1/wrc/events`、赛季、车手及积分接口；基础地址仍是 `https://api.ocblacktop.com`，认证头为 `x-api-key`。

[套餐页](https://blacktop.live/api)标注免费额度每月 7,500 次，只用于原型和非商业用途、只支持服务端请求、基础接口。实时比赛数据、webhooks 和 WebSocket 在付费套餐范围。免费基础接口不等同免费实时计时。

仓库当前使用 `/v1/wrc/rallies`，读取 `data` 数组并按中文名称匹配；当前文档展示 `/v1/wrc/events` 和不同响应包装。需要通过真实密钥和当前 API reference 核对后再改适配器，不能仅替换 URL。此次没有验证免费账户是否包含逐赛段计划时间，因此未改业务数据源。

## 历史接口与其他项目

公开项目记录过 `https://api.wrc.com/results-api/rally-event/{id}/itinerary`。此次对示例 event 1695 请求连接失败，不能作为当前可用接口的证据。

旧开源 WRC-API 的 README 只说明较老年份数据且依赖抓取 eWRC，未确认当前服务仍运行，不推荐作为主要生产来源。参考：[作者仓库](https://github.com/nathanjliu/WRC-API)。

结论：官网公开 Feed 是目前实测成功的行程来源；Blacktop 可作为需要密钥的免费基础数据候选。实时计时仍需另行确认当前官方请求链路，本轮未把未验证接口投入生产。

## 2026-10-11 第三方无 token 接口复查

- Rally Times：https://www.rallytimes.live/ 。页面的公开脚本使用 https://api.rallytimes.live/api/v1 。不携带 Authorization、API Key、Cookie 或 X-User-Id 测试 GET /rallies 返回 200，共 19 条赛事，包含 WRC 2026。
- GET /rallies/wrcris-26/itinerary 不携带认证返回 200 JSON；赛段开始记录 t=StageStart，赛段编号 c、名称 p、UTC 时间 d、顺序 o。样例 SS1 日期 2026-10-01T14:05:00Z；这里只验证原始返回，不代表已确认日期正确。
- 页面脚本还使用 /rallies/{id}/stages、/rallies/{id}/stages/{stage}/results、/splits 等；未逐个测试。不应将公开可访问等同官方允许第三方复用，未发现开发者文档、限额、服务承诺或 API 使用授权。当前仅记录候选，不接入生产链路。
- nathanjliu/WRC-API：https://github.com/nathanjliu/WRC-API 。开源抓取 eWRC 的 Express 服务；README 日历覆盖仅 2014-2022，测试 Heroku /api/rally/getids?year=2026 返回 404。不是已验证可用的当前托管 API。
- RallySafe：https://results-api.statusas.com/documentation/index.html 。Swagger 可读，但 GET /api/seasons 返回 401；契约声明 Bearer JWT，不符合无需 token。
- OpenWRC：https://github.com/jixy2012/OpenWRC 。README 明确是官方 WRC API 到本地 SQLite 的 Python 数据工具，不是独立第三方托管服务。
- Blacktop：https://blacktop.live/api/wrc 。免费套餐仍要求 x-api-key，不符合无需 token。
