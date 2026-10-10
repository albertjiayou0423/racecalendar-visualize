# 当前数据获取逻辑

本文根据克隆时的 main 分支代码整理，描述实际实现，不代表已验证生产环境变量、数据库内容或上游接口可用性。

## 1. 主赛历入口

`app/page.tsx` 只提供服务器时间给 `ScheduleView`，没有服务端预取赛历。首页客户端通过 SWR 请求 `GET /api/schedule`。SWR 关闭焦点刷新，没有设置定时轮询；每秒更新的是倒计时，不是赛历数据。

首页 fetcher 在 HTTP 成功后将返回 JSON 写入 localStorage 的 `schedule-cache`。网络错误或非 2xx 时读取该缓存，增加 `offline=true`。接口返回 200 但某系列 `ok=false` 不触发这里的离线回退。

赛事详情页也请求 `/api/schedule`，再找匹配 ID；其请求不复用首页的 localStorage fetcher。

## 2. `/api/schedule` 编排

1. 幂等初始化 `crawl_snapshots`、`crawl_quota`、`event_overrides` 三张表。
2. 并行检查 F1、FE、WRC 当天配额；按 UTC 日期分组，每系列每天上限 10 次。无数据库或查询出错时按已用 0 次处理。
3. F1 / FE 配额未耗尽时调用获取函数，否则读取该系列最新快照。WRC 总是尝试官网链路，配额只决定是否允许 ocblacktop 回退。
4. 三系列并行获取。`ok=true` 且 events 非空才保存主赛历快照并计数；F1 / FE 每次成功处理计一次，WRC 只有最终 `dataSource=api/mixed` 才计一次。计数不等同上游 HTTP 请求数，命中上游缓存也可能计数。
5. WRC 保存时按事件 ID 与上一快照合并：新事件 `tentative=true`、旧事件不是 tentative 时，整条保留旧事件。该函数直接修改传入 events，所以会影响本次响应。只有整体获取 `ok=true` 时才走此合并；官网全部失败并返回 `ok=false` 时不会执行。
6. 合并 F1、WRC、FE。WRC 列表为空则再次生成本地估计赛历。
7. 每场查询 `event_overrides`，以 `{...event,...override}` 顶层浅合并。随后 F1 按原始赛道名匹配本地图片，可能覆盖管理员设置的 `circuitImageUrl`。
8. 返回 `events`、各系列 `sources` 和本次生成时间 `fetchedAt`。该时间不代表上游数据或数据库快照的更新时间。

`fetchAndSave` 只在函数抛异常时读取快照。F1 / FE 获取函数通常内部捕获异常，返回 `{events:[],ok:false}`，因此普通上游失败不会自动使用已有快照。WRC 全失败也通常返回估计列表和 `ok=false`，不是抛异常。

## 3. F1

实现：`lib/fetchers.ts:fetchF1`。

- 并行请求 Jolpica 的 `/ergast/f1/current.json`（当前赛季，fetch revalidate 3600 秒）和 `/ergast/f1/2025/results.json`（固定 2025 年，86400 秒）。
- 当前赛历负责赛事和练习、冲刺排位、冲刺、排位、正赛时间；缺少日期或时间的场次被跳过，不估计补齐。
- 日期和带 Z 的时间组合为 UTC ISO，场次按时间排序。ID 为 `f1-{season}-{round}`。
- 上年结果按 circuitId 匹配，用第一个结果补充上年冠军与该车手的 FastestLap；不保证是整场比赛最快圈。上年结果请求没有分页，也不是动态“当前年减一”。
- 中文名、国家、时区、地区、赛道类型、赛道长度/圈数、本地图片和五星体育说明来自代码映射，不是实时爬取。
- 任一并行请求的网络异常可导致整个 fetchF1 返回失败；上年结果仅 HTTP 非成功时可以跳过。失败返回空列表，不内置静态 F1 日历。

## 4. Formula E

实现：`lib/fetchers.ts:fetchFe`。基础地址是 `https://api.formula-e.pulselive.com/formula-e/v1`。

1. `/championships` 选择 `status=Present` 的赛季，找不到则取数组最后一个。
2. `/races?championshipId=...` 获取该赛季比赛。
3. 并行请求每场 `/races/{id}/sessions`。以上请求的 fetch revalidate 均为 3600 秒。
4. 保留 Free Practice、Qual Group A、Race，分别显示练习、排位、正赛。其他排位分组/淘汰赛场次不显示。
5. UTC = 当地日期时间减 `offsetGMT` 分钟；展示时区用整点 `Etc/GMT`，半小时时区回退 UTC，但保存时间仍使用分钟偏移。
6. 没拿到可用场次但有比赛日期时，补当天 UTC 12:00 的正赛，标记场次 `tentative=true`。单场抛异常则该赛事被过滤掉，其他场仍可返回整体 `ok=true`。
7. ID 为 `fe-{raceId}`；中文国家、地区、街道赛道描述和转播说明来自本地映射。

## 5. WRC 多级获取

实现：`lib/wrc-puppeteer.ts:fetchWrc`。文件名虽然包含 Puppeteer，当前依赖及实现没有启动 Puppeteer。

先用 `buildWrcEvents()` 生成本地 2026 年 14 场赛事作为基础。该列表提供中文信息、时区、坐标、转播说明等。估计场次为 Shakedown、按间隔生成的 SS 以及末日 Power Stage，事件和场次均标记 tentative。

再请求 WRC 官网 `/v3/api/graphql/v1/v3/content/...` 的赛季 Event Series 和每场 card，从中获取 round、正确 slug 和起始日期。失败时使用第二套硬编码的 WRC_RALLIES。两套静态日期及部分 slug 不一致。动态赛历主要用于抓取目标，成功结果只替换基础列表中相同 round 的场次，不能自动新增基础列表之外的赛事。

每场官网行程按以下次序尝试：

1. 并行尝试四种 itinerary slug，请求官方 feed 的 `event-details` / `inlineContent`。解析 FAQ 中的日期和赛段时间。
2. 全部失败时读取 mainSubPage 补充信息用于日志，然后进入旧链路。
3. 获取赛事首页 HTML：直接请求 → `_escaped_fragment_=` 页面 → PhantomJsCloud 渲染服务。
4. 提取 HTML 的 `rb3-prerender-data-cache`，从 pageTabs 发现 itinerary slug；发现失败时再尝试常见 slug。
5. 请求发现的 itinerary Feed API。
6. 仍失败则请求 itinerary 的 `_escaped_fragment_=` 页面，解析预渲染 JSON 或 HTML。
7. 仍失败且首页存在预渲染缓存时，尝试 itinerary / results 页面，直接请求或 PhantomJsCloud 渲染，再解析 JSON 或 HTML。

官网时间按赛事 IANA 时区转换为 UTC，Power Stage 标为主场次。

如果配置 `OCBLACKTOP_API_KEY` 且允许回退，先获取 ocblacktop 的 rally 索引。官网每场失败后按赛事信息匹配索引，请求详细赛段并转换时间，第三方成功事件依然标记 `tentative=true`。

全部目标首轮并行处理。失败后重试距离当前时间前后 14 天内的所有失败赛事；没有这些赛事时重试失败列表前两场。重试仍执行官网和可用的第三方回退。

成功场次替换基础估计场次并同步 slug / 官方计时链接；失败场保留估计数据。至少一场官网或 ocblacktop 成功就返回整体 `ok=true`，所以成功状态不代表全赛季真实数据。`dataSource` 是 scraped / api / mixed，note 描述成功和估计场数。官网全失败时返回完整估计列表、`ok=false`。

普通 HTML 请求每次超时 15 秒、最多三次尝试；不同 API 有各自超时。PhantomJsCloud 请求没有整体 AbortSignal 超时。完整赛季并行且多级回退，单次请求可能很慢。主赛历接口声明 `maxDuration=300`，实际部署允许时长尚未验证。

定义的 EventHero / iCal 辅助函数目前没有接入主获取链路，不能当成已使用的数据来源。

## 6. 缓存、数据库与刷新入口

- Neon PostgreSQL：通过服务端 `DATABASE_URL` 连接。快照是追加 JSONB 记录，按 fetched_at 取最新一条，没有快照年龄上限或自动清理。
- 配额查询与递增分开，没有原子预留，并发可能超过 10 次。无数据库时快照/覆盖不可用，计数不持久化。
- Next：主接口声明 `revalidate=3600`，F1 / FE 上游 fetch 显式缓存一小时；这不是每小时自动执行的定时任务。WRC 请求没有同样的显式一小时 fetch 设置。实际响应缓存行为应在部署环境核对。
- 首页 SWR 内存缓存；失败时 localStorage 离线回退，没有缓存年龄上限。
- 生产环境注册 `public/sw.js`：GET API 网络优先，网络异常时读取 Cache Storage；页面/静态资源缓存优先。API 响应没有检查 HTTP 成功再写入缓存，因此错误响应也可能被缓存。
- 仓库未配置 Vercel cron 或 GitHub Actions 抓取任务。当前抓取由请求触发，不是后台独立定时同步。

后台入口：

- `/api/admin/crawl` POST：单系列手动抓取，所有系列先检查 10 次配额，包括 WRC 官网；获取函数正常返回后，无论其 ok 值如何都递增并保存快照，外层响应仍为 ok=true。这与主赛历计数语义不同，失败空列表也可能成为最新快照。
- `/api/admin/status` GET：直接调用三个 fetcher，并写 service_health_log，不走赛历配额与快照保存；没有后台认证检查。后台面板加载会请求它，可能产生额外外部请求。
- `/api/admin/snapshot`：查看原始快照；`/api/admin/overrides`：管理人工覆盖；`/api/admin/preview`：预览快照加覆盖。但预览错误使用 `snapshot.events`，实际结构为 `snapshot.data.events`，存在运行时错误。

## 7. 其他数据链路

| 功能 | 当前来源与处理 |
| --- | --- |
| F1 赛果 | `/api/results` 请求 Jolpica `/{season}/results.json?limit=1000`，缓存一小时；首页上一场赛果直接从浏览器请求 current/last/results.json。 |
| FE 赛果 | `/api/results` 从 championships 匹配赛季，再取 races，逐场顺序请求 results，单场失败跳过，缓存一小时。 |
| F1 积分榜 | standings 页面直接从浏览器请求 Jolpica current/driverStandings 或 constructorStandings，不经过 Neon。 |
| FE 积分榜 | `/api/fe-drivers` 获取当前 championship、lastFinishedRound、standings 和 drivers 后合并；standings 的 season 固定为 2026。尚未开赛或接口不可用可返回空列表及 ok=true。 |
| WRC 赛果/积分 | 没有对应的完整赛果/积分获取链路；官方实时计时链接供用户查看。 |
| F1 实时计时 | 展开组件每 10 秒请求 `/api/live-timing`；服务端 OpenF1 获取本年度 sessions，找当前正在进行场次，再并行请求 drivers、position、laps，整理最新名次、最近圈和最快圈，不缓存。无进行中场次返回 404。差距字段按名次生成，进站/退赛/旗帜等字段使用默认值，并非真实上游指标。 |
| WRC / FE 实时计时 | API 返回空 drivers 的官方来源占位对象。WRC 前端不轮询，直接引导官网；FE 组件仍有 10 秒轮询，但没有真实计时数据接入。 |
| 天气 | `/api/weather` 优先用经纬度，否则 Open-Meteo 地理编码、再本地城市坐标回退；查询目标日期前后三天 daily forecast，地理编码缓存一天、天气缓存一小时；日期范围限制及重试在该路由实现。 |
| 图片 | F1 赛道图为 public 本地资源；WikipediaImage 浏览器请求 Wikipedia REST summary；image-proxy 为部分远程图片代理。 |
| AI 预测 | POST `/api/predictions` 检查 AI 额度后请求 NVIDIA NIM Llama 3.1 8B，输入赛事系列、名称和赛道，未实际加载历史成绩/天气进行分析；额度耗尽或服务 HTTP 失败时返回本地默认预测。 |
| 投票/反馈 | predictions 的 GET 统计数据库投票，POST 带 driverCode 时写投票；反馈通过 `/api/feedback` 写入/读取 Neon。它们不属于赛历上游抓取。 |

## 8. 后续开发优先关注

1. 预测接口和数据库脚本含明文凭据，应从代码移除并在服务商轮换，历史提交中的凭据也应视为暴露；本文不记录凭据值。
2. 管理接口使用可伪造的 `admin_auth=true` cookie；健康检查接口没有认证。
3. 统一失败回退、后台与首页抓取计数、快照成功判定，并修复预览数据结构。
4. 区分官方、第三方、估计和快照数据，不能把整体 ok 当作每场可信度。
5. 消除年份硬编码和重复 WRC 定义，改进动态赛历合并与上年结果分页。
6. 替换实时计时的生成差距字段，并明确尚未接入的真实指标。

上述为代码审阅发现，本次仅新增开发约定与说明文档，没有运行生产爬取、读取生产数据库或修改业务逻辑。
