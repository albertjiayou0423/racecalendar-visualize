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

再请求 WRC 官网 `/v3/api/graphql/v1/v3/content/...` 的赛季 Event Series 和每场 card，从中获取 round、正确 slug 和起始日期。失败时使用第二套硬编码的 WRC_RALLIES。两套静态日期及部分 slug 不一致。动态赛历用于更新本地目标中对应轮次的 slug、日期和已知时区；部分动态赛历不会移除其他本地轮次。跨赛季、重复轮次和未知轮次不覆盖本地目标。成功结果只替换基础列表中相同 round 的场次，不能自动新增基础列表之外的赛事。

每场官网行程按以下次序尝试：

0. 先读取赛事官网页面，发现 itinerary URL（无法发现时使用标准路径），读取并解析行程 HTML / 预渲染缓存。成功获得有效场次就直接返回，不调用 feed 回退。页面访问失败或没有可用赛段时间，才进入以下回退链路；feed 为最高优先级。

1. 并行尝试四种 itinerary slug，请求官方 feed 的 `event-details` / `inlineContent`。解析 FAQ 中的日期和赛段时间。
2. 全部失败时读取 mainSubPage 补充信息用于日志，然后进入旧链路。
3. 获取赛事首页 HTML：直接请求 → `_escaped_fragment_=` 页面 → PhantomJsCloud 渲染服务。
4. 提取 HTML 的 `rb3-prerender-data-cache`，从 pageTabs 发现 itinerary slug；发现失败时再尝试常见 slug。
5. 请求发现的 itinerary Feed API。
6. 仍失败则请求 itinerary 的 `_escaped_fragment_=` 页面，解析预渲染 JSON 或 HTML。
7. 仍失败且首页存在预渲染缓存时，尝试 itinerary / results 页面，直接请求或 PhantomJsCloud 渲染，再解析 JSON 或 HTML。

官网时间按赛事 IANA 时区转换为 UTC，Power Stage 标为主场次。

如果配置 `OCBLACKTOP_API_KEY` 且允许回退，先获取 ocblacktop 的 rally 索引。官网每场失败后按赛事信息匹配索引，请求详细赛段并转换时间，第三方成功事件依然标记 `tentative=true`。

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
- 仓库未配置 Vercel cron 或 GitHub Actions 抓取任务。当前抓取由请求触发，不是后台独立定时同步。

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

仍需处理：历史凭据在服务商轮换、配额并发原子预留、年份硬编码与 WRC 重复定义、完整类型检查原有错误、F1 生成差距字段、首页快照优先架构、WRC 限制抓取范围。WRC 接口调研见 docs/wrc-api-research.md，本轮未替换未验证的数据源。

验证：认证/回退/数据库接口使用本地虚拟数据测试。首次构建意外触发原有赛历预抓取并加载仓库自带的 .env，可能访问其中的数据库；随后增加运行时请求限制，后续构建明确禁用数据库连接。实际生产数据展示与浏览器布局仍需授权浏览器访问后或由用户验证。

## WRC 估计时间显示

赛历中保留估计 UTC 以兼容现有数据契约，但详情页、分享卡片和卡片展开详情不显示估计场次的具体时间。统一显示“时间待确认”；不展示由估计值推导的精确倒计时、赛段天气、日历导出和提醒。场次 tentative 优先于赛事 tentative：明确 false 的已确认场次继续显示真实时间，字段缺失时继承赛事标记。F1/FE 不受此规则影响。

官方行程转换会验证实际日历日期、小时 0-23 和分钟 0-59，过滤重复赛段与空名称。FAQ 日期无法识别时不使用赛事起始日冒充已确认日期。有效官网场次明确标记 tentative=false。

抓取调度先处理最近五天开始的赛事（可能正在进行），随后未来十四天赛事、过去十四天赛事，剩余赛事按距当前日期排序。只改变请求顺序，输出仍按原有赛事 ID 和轮次合并。总预算到期的排队任务直接跳过，不重启完整回退。Feed 候选必须转换出至少一个有效场次才能结束候选搜索，非空但无效的日期或时间不算成功。

FAQ 标题明确声明 UTC/GMT 或带正负偏移时，按声明的偏移转换到 UTC；没有声明时才使用赛事 IANA 当地时区。超出有效范围的偏移不会回落当地时区，而是丢弃相关无效场次。日期支持英文序数词、明确年份与 ISO 日期，防止跨年行程套用错误年份。本次复查官网 Croatia feed 返回 403，当前可用性不能由历史 200 推断。

第三方回退按官网 eventSlug 匹配英文赛事名，拒绝空名称、只有 WRC/Rally 等通用词的匹配，以及多个候选。候选明确年份必须与当前赛事一致；提供起始日期时必须在目标日期前后七天内。日期缺失但存在多个候选时不猜测第一条。第三方时间区分明确 UTC 字段、带偏移 ISO 时间和当地墙上时间；不依赖服务器 getFullYear/getDate 时区，过滤非法日期与时间。

同一次 WRC 更新中的 feed 和通用 JSON 请求通过 AsyncLocalStorage 请求作用域共享已解析数据与进行中的 Promise。Feed 键包含 slug 和用于解析年份的起始日期；JSON 键包含完整 URL。返回深拷贝，避免不同消费者改动共享数据。失败与 null 结果不保留，不同更新之间不复用此缓存；持久化快照仍负责跨请求回退。

完整链路测试使用本地固定 HTTP 响应，覆盖官网 HTML 成功、HTML 失败后的 feed 优先回退、UTC FAQ 解析、稳定事件 ID、部分赛事保留估计值，以及未知轮次不计作成功。爬取成功数只统计真正合并进输出的轮次；来源说明按输出赛事的 tentative/场次 tentative 计算待确认赛事数量，而不只统计本次尝试失败的目标。此测试不连接生产数据库或消耗第三方 API 配额，不代替线上可用性验证。

官网赛季目录先检查 events 是否为数组，只处理非空字符串事件 ID 并去重。赛事卡片最多四个并发，单卡失败隔离；轮次、slug、日期和标题检查字段类型，过滤无效日历日期及异常路径。坏目录降级为本地赛历，坏卡片跳过，不因 standfirst/startDate 等字段类型变化中断整次抓取。

WRC 快照合并的来源说明会重新计算仍待确认的赛事数量，并标注保留的历史已确认场次数；不会将旧的估计时间升级为已确认。新增纯函数测试覆盖全失败估计、混合场次、新确认时间更新、事件 ID 隔离与歧义身份。

WRC 快照写入失败会直接交给调用方标记持久化失败，不在合并异常处理内重复插入；历史赛段合并失败时仍尝试保存本次数据。

官方页面缓存与 Feed 在选择 FAQ 行程版本前验证日期、赛段时间和 UTC 偏移；无有效赛段的版本会跳过，继续检查同一响应中的后续版本，不混合多个版本。

FAQ 解析会跳过空节点、非字符串文本以及非数组列表结构，避免单个异常节点导致后续有效官方赛段丢失；该规则同时用于页面缓存和 Feed。

第三方时间戳显式偏移按数值转换为 UTC，拒绝超过 ±14:00 或偏移分钟超过 59 的值；支持单数字小时与毫秒，并验证跨日转换。

旧版 HTML 回退链也以可转换的有效赛段作为成功条件：SSR 或首个候选页面仅有无效时间时继续后续行程页面，不以解析出文字列表就停止。

直接 HTML 请求的正文读取也在异常处理范围内；正文中断按原有限重试策略处理，连续失败返回空结果继续回退。403 等非 5xx 响应仍只请求一次。

WRC 统一请求层对非成功 HTTP 响应主动取消未使用的正文，释放资源后交给原有状态判断和回退逻辑；成功响应仍保留可读取正文，取消异常不覆盖原始 HTTP 失败。

WRC 抓取结果包含 diagnostics，随成功快照保存：requests 为实际请求次数，networkFailures 为收到 HTTP 响应前的网络失败数，httpStatuses 为状态码计数，cacheHits 为同一抓取中的解析缓存复用次数，durationMs 为总耗时，budgetExpired 表示总预算是否耗尽。计数按抓取隔离，不含 URL、密钥、请求头或正文；不把 HTTP 错误或正文解析失败计入 networkFailures。

后台手动抓取接口返回本次尝试的 diagnostics，失败响应放在顶层、成功响应放在 data 内；回退旧快照时不会用历史快照诊断替代本次诊断。全失败不保存快照，诊断只随当次管理接口响应提供。

爬虫管理页在手动 WRC 抓取后展示本次诊断（包括失败响应），显示请求/网络失败/缓存命中/HTTP 状态/耗时/预算结果；新一轮 WRC 抓取和退出登录清除旧诊断，刷新页面也清除。
