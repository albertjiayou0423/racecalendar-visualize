# 当前数据获取逻辑

本文根据 dev/data-pipeline 分支当前实现整理，描述实际实现，不代表已验证生产环境变量、数据库内容或上游接口可用性。

## 1. 主赛历入口

`/api/schedule` 使用 `connection()` 限定运行时获取，构建不会预抓取赛季。`app/page.tsx` 只提供服务器时间给 `ScheduleView`，没有服务端预取赛历。首页客户端通过 SWR 请求 `GET /api/schedule`。SWR 关闭焦点刷新，没有设置定时轮询；每秒更新的是倒计时，不是赛历数据。

首页 fetcher 在 HTTP 成功后将返回 JSON 写入 localStorage 的 `schedule-cache`。网络错误或非 2xx 时读取该缓存，增加 `offline=true`。接口返回 200 但某系列 `ok=false` 不触发这里的离线回退。

赛事详情页也请求 `/api/schedule`，再找匹配 ID；其请求不复用首页的 localStorage fetcher。

## 2. `/api/schedule` 编排

1. 初始化相关表，并行读取三个系列最近成功快照。
2. 已有快照立即返回，不等待上游抓取。超过一小时的快照通过 Next.js after() 在响应后更新；同一函数实例内合并重复更新。不同实例仍可能各自更新。
3. 没有快照的系列才在请求内抓取，F1/FE 受每日配额限制；WRC 官网抓取仍允许，第三方回退受配额限制。首次无快照仍可能较慢。
4. 后台更新遵循原有失败回退、成功保存和配额规则；失败不会覆盖有效快照。快照尚未更新时继续显示旧数据。
5. 人工覆盖使用一次 getAllOverrides 查询后按事件 ID 合并，保持顶层浅合并和 F1 图片匹配行为。
6. 返回 events、sources、生成响应时间 fetchedAt；sources.note 包含快照时间。

首页挂载后从 localStorage 恢复上次赛历，在网络更新期间继续显示；缓存不意味着处于离线模式。后台编辑后的最新覆盖在下一次接口读取时生效。

`refreshSeries` 使用共用 `fetchWithSnapshot`：上游抛异常、返回 ok=false 或成功空列表时，读取最近成功快照；没有可用快照时保留失败结果（WRC 可含估计数据）。失败结果不写入快照，也不增加计数。新数据获取成功但数据库保存失败时显式标记 persistenceError，后台不会假报持久化成功。

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

再请求 WRC 官网 `/v3/api/graphql/v1/v3/content/...` 的赛季 Event Series 和每场 card，从中获取 round、正确 slug 和起始日期。失败时使用第二套硬编码的 WRC_RALLIES。两份本地定义仍独立维护，但起始日期已对齐并由跨文件测试检查；部分 slug 仍独立定义。动态赛历用于更新本地目标中对应轮次的 slug、日期和已知时区；部分动态赛历不会移除其他本地轮次。跨赛季、重复轮次和未知轮次不覆盖本地目标。成功结果只替换基础列表中相同 round 的场次，不能自动新增基础列表之外的赛事。

每场官网行程按以下次序尝试：

0. 先读取赛事官网页面，发现 itinerary URL（无法发现时使用标准路径），读取并解析行程 HTML / 预渲染缓存。成功获得有效场次就直接返回，不调用 feed 回退。页面访问失败或没有可用赛段时间，才进入以下回退链路；feed 为最高优先级。

1. 并行尝试四种 itinerary slug，请求官方 feed 的 `event-details` / `inlineContent`。解析 FAQ 中的日期和赛段时间。
2. 全部失败时读取 mainSubPage 补充信息用于日志，然后进入旧链路。
3. 获取赛事首页 HTML：直接请求 → `_escaped_fragment_=` 页面 → PhantomJsCloud 渲染服务。
4. 提取 HTML 的 `rb3-prerender-data-cache`，从 pageTabs 发现 itinerary slug；发现失败时再尝试常见 slug。
5. 请求发现的 itinerary Feed API。
6. 仍失败则请求 itinerary 的 `_escaped_fragment_=` 页面，解析预渲染 JSON 或 HTML。
7. 仍失败且首页存在预渲染缓存时，尝试 itinerary / results 页面，直接请求或 PhantomJsCloud 渲染，再解析 JSON 或 HTML。

官网明确声明 UTC/GMT 偏移时按声明转换，否则使用赛事 IANA 时区。Power Stage 标为主场次，成功合并同步赛事 tz。

如果配置 `OCBLACKTOP_API_KEY` 且允许回退，在首次官网行程失败后按需获取共享的 ocblacktop rally 索引。官网每场失败后按赛事信息匹配索引，请求详细赛段并转换时间，第三方成功事件依然标记 `tentative=true`。

全部目标以最多 4 场并发处理，单场失败不影响其他场结果顺序。第三方赛事索引仅在官网行程失败后按需获取，一次完整更新共享同一索引 Promise。配额不允许时不请求第三方索引或详情。取消失败赛事整条多级链路的第二轮重跑；普通 HTML 网络请求自身仍保留短暂故障重试。

成功场次替换基础估计场次并同步 slug / 官方计时链接；失败场保留估计数据。至少一场官网或 ocblacktop 成功就返回整体 `ok=true`，所以成功状态不代表全赛季真实数据。`dataSource` 是 scraped / api / mixed，note 描述成功和估计场数。官网全失败时返回完整估计列表、`ok=false`。

普通 HTML 请求每次超时 15 秒、最多三次尝试；不同 API 有各自超时。PhantomJsCloud 请求现有 12 秒 AbortSignal 超时。完整赛季限制 4 场并发，但多级回退单次更新仍可能耗时较长。一次 WRC 更新共享 180 秒总网络预算，HTML、feed、辅助 API、渲染和第三方请求均使用该取消信号；到期停止新请求并取消未完成网络请求，保留已获取结果。不同抓取通过 AsyncLocalStorage 隔离预算。主赛历接口声明 `maxDuration=300`，实际部署允许时长尚未验证。

定义的 EventHero / iCal 辅助函数目前没有接入主获取链路，不能当成已使用的数据来源。

## 6. 缓存、数据库与刷新入口

- Neon PostgreSQL：通过服务端 `DATABASE_URL` 连接。快照是追加 JSONB 记录，过滤 ok=true 且非空 events 后按 fetched_at 取最新成功记录，没有快照年龄上限或自动清理。
- 配额查询与递增分开，没有原子预留，并发可能超过 10 次。无数据库时快照/覆盖不可用，计数不持久化。
- Next：主接口声明 `revalidate=3600`，F1 / FE 上游 fetch 显式缓存一小时；这不是每小时自动执行的定时任务。WRC 请求没有同样的显式一小时 fetch 设置。实际响应缓存行为应在部署环境核对。
- 首页 SWR 内存缓存；失败时 localStorage 离线回退，没有缓存年龄上限。
- 生产环境注册 `public/sw.js`：GET API 网络优先，网络异常时读取 Cache Storage；页面/静态资源缓存优先。只缓存成功且没有 no-store 的 API 响应；管理页面、管理接口和反馈接口不缓存。缓存版本已更新以清除旧缓存。
- `vercel.json` 配置 Vercel Cron：`17 21 * * *`（UTC），每天北京时间 05:17 所在小时调用公开的 `GET /api/schedule`，不依赖访客打开页面。Vercel Hobby 支持每天一次，触发时间可能在该小时内延后。沿用接口的一小时快照新鲜度判断、`after()` 后台刷新、失败保留成功快照与配额规则；快照不足一小时则跳过抓取，过期或缺失时获取 F1、FE、WRC。已有公开接口无需新增密钥，响应也不暴露管理权限。
- Cron 只在 Vercel **Production** 部署生效，Preview 不执行。提交到开发分支不会自动证明定时任务启用；需在目标项目 Cron Jobs 面板确认启用，并以实际执行记录及后台各系列快照 `fetched_at` / 更新时间验证。HTTP 200 可能仅表示旧快照成功返回，不代表后台爬取或持久化成功；数据库不可用时不能证明定时同步已保存。构建仍不会爬取。
- 截至本次配置，GitHub 默认分支为 `main`，开发分支对应的 GitHub 部署记录标记为 Preview，且 Vercel 连接器需要重新认证，无法检查项目 Production Branch / Cron Jobs 开关。因此只确认配置已实现，尚不能确认线上定时任务已生效。不能为启用任务直接向 main 提交、推送或自动创建 PR。

后台入口：

- `/api/admin/crawl` POST：要求有效签名会话与数据库，调用与首页相同的 refreshSeries。F1 / FE 配额耗尽阻止刷新，WRC 仍允许官网获取但关闭第三方回退。仅成功非空结果保存和计数，失败返回 502 并保留已有成功快照。
- `/api/admin/status` GET：要求有效签名会话，仅读取各系列最近成功快照。状态不代表实时上游连通性；加载后台不再抓取全赛季，也不写新的健康检查历史。
- `/api/admin/snapshot`：查看原始快照；`/api/admin/overrides`：管理人工覆盖；`/api/admin/preview`：预览快照加覆盖。预览现已使用 `snapshot.data.events`，与持久化结构一致。

新增数据库检查入口：GET /api/admin/database。仅检查八张应用业务表，显示表是否存在、字段类型、可空性、选中表的准确记录数与分页记录；稳定主键排序，无主键时按 ctid 排序。表名使用白名单，分页值参数化，推送凭据与地址隐藏，大字段截断到 16,000 字符，响应不缓存。此功能不创建表、不执行任意 SQL，也不提供数据修改或删除。

管理员登录继续使用 ADMIN_PASSWORD；服务端签发随机、签名的一小时 cookie，HttpOnly / SameSite=Strict / 生产 Secure。修改密码后旧会话无效；写操作检查来源，退出通过服务端 DELETE 清除 HttpOnly cookie。旧 true cookie 不能登录。

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

## 8. 本轮变更与剩余问题

已修复：移除预测接口/脚本硬编码凭据、停止跟踪 .env、替换后台伪造 cookie 认证、阻止管理数据离线缓存、统一失败回退和后台计数、过滤失败历史快照、修复预览结构、新增只读数据库检查。

仍需处理：历史凭据在服务商轮换、配额并发原子预留、年份硬编码与 WRC 重复定义、完整类型检查原有错误、F1 生成差距字段、WRC 跨实例重复抓取控制与线上性能验证。WRC 接口调研见 docs/wrc-api-research.md，本轮未替换未验证的数据源。

验证：认证/回退/数据库接口使用本地虚拟数据测试。首次构建意外触发原有赛历预抓取并加载仓库自带的 .env，可能访问其中的数据库；随后增加运行时请求限制，后续构建明确禁用数据库连接。实际生产数据展示与浏览器布局仍需授权浏览器访问后或由用户验证。

## 9. WRC 时间可信度与显示

估计 UTC 保留在数据契约中。详情、EventCard 展开内容和分享卡片显示“时间待确认”，不显示具体估计时间，也不生成精确倒计时、赛段天气、日历导出或提醒。场次 tentative 优先于赛事 tentative；明确 false 的场次仍显示确认时间，缺失时继承赛事标记。F1/FE 不受影响。

官网页面缓存与 Feed 共用 parseItineraryItems。日期支持 ISO、英文月份、序数词和显式年份；验证实际日历日期、小时 0–23、分钟 0–59、名称和 UTC/GMT 偏移，过滤重复场次。无效 FAQ 版本、空节点、错误字段和非数组列表不会阻止继续寻找有效版本；不会混合多个行程版本。有效官网场次明确标记 tentative=false。

FAQ 与普通 HTML 共用赛季归属检查。显式年份属于其他赛季时排除，但允许与赛事首日相差不超过七天的跨年日期。普通 HTML 必须有明确日期分区，不能把散落时间套到赛事首日冒充确认时间。FAQ 标题或 HTML 日期分区声明 UTC/GMT 时使用明确偏移；没有声明时使用赛事 IANA 时区，非法偏移不回落当地时区。

第三方索引用官方 eventSlug 匹配英文赛事名，拒绝空名称、仅 WRC/Rally 等通用词、其他赛季和多候选歧义。提供起始日期时须在目标日期前后七天内。时间区分明确 UTC 字段、带偏移 ISO 和当地墙上时间，不依赖服务器当地时区；显式偏移最大 ±14:00，保留秒和毫秒。

## 10. WRC 调度、请求复用与解析入口

先抓取最近五天开始的赛事，再抓未来十四天、过去十四天，其余按距当前日期排序。只改变请求顺序，输出仍按基础事件 ID 与轮次合并。总预算到期的排队任务跳过，不重启完整回退链。所有候选必须转换出有效赛段才算成功，包括 Feed、SSR 和旧 HTML 多页面回退。

单次抓取内使用 AsyncLocalStorage 共享已解析 Feed/JSON、成功 HTML 正文及进行中的 Promise。Feed 键含 slug 和用于解析年份的日期；JSON/HTML 键含完整 URL。消费者取得深拷贝；null 和异常不保留，不同抓取不共享。跨请求回退由数据库快照承担。

HTML 正文读取中断进入有限重试，403 等非 5xx 失败不重试。统一请求层取消非成功 HTTP 响应的未使用正文，清理异常不覆盖原始状态，成功正文仍可读取。

预渲染 script 提取支持属性换序、单/双引号、大小写和额外属性，仅匹配实际 id；数据必须为 JSON 对象。损坏候选继续查找后续缓存。页面发现的链接按 URL 解析，接受 HTTPS www.wrc.com 下本场路径的绝对或根相对地址；Results 查询参数合并，Feed slug 只取路径末段，不含查询或锚点。

官方目录验证 events 数组、去重字符串 ID，赛事卡片最多四个并发且隔离失败；校验 round、slug、日期、标题类型。部分目录保留全部已知本地轮次，未知/重复/其他赛季目标不覆盖。两份本地起始日期的对齐仅证明内部一致，不代表重新核实官方最新赛历。

## 11. WRC 历史快照与诊断

成功保存前按同一事件 ID 合并历史确认时间。整场回退到估计且旧快照全部确认时保留旧赛段；混合结果按 SS 编号、Shakedown 或规范名称恢复唯一匹配的确认场次，新确认时间优先。历史估计、无效时间或歧义匹配不会升级为确认。合并后重算待确认赛事数，来源说明标注保留历史赛段数。数据库写入失败由调用方处理，不重复插入。

抓取结果 diagnostics 随成功快照保存；只含计数和耗时，不含 URL、密钥、请求头或正文：

| 字段 | 含义 |
| --- | --- |
| requests | 实际网络请求次数 |
| networkFailures | 收到 HTTP 响应前的网络失败；不含 HTTP 错误、正文读取或解析失败 |
| httpStatuses | 收到的 HTTP 状态码计数 |
| cacheHits | 本次解析数据或 HTML 正文的缓存复用次数 |
| durationMs | 当前抓取总耗时 |
| budgetExpired | 180 秒预算是否已耗尽 |

后台手动抓取成功响应的 data 和失败响应顶层都提供本次诊断。回退旧快照时保留历史快照诊断，并单独提供当前尝试诊断，避免混淆。失败不生成成功快照。爬虫管理页显示本次计数、状态、耗时；新一轮 WRC 抓取、退出登录或刷新清除展示。

验证使用固定本地 HTTP 响应，覆盖官网 HTML、HTML 失败后的 Feed 优先回退、UTC 解析、稳定 ID、部分估计、无效候选、坏字段、年份、缓存隔离和快照保护，不连接生产数据库或消耗第三方额度。浏览器权限目前阻止部署域名访问，测试及 GitHub 部署成功均不等同线上页面或上游可用性已验证。
