# 项目开发约定

## 范围与技术栈

本文件适用于整个仓库。项目是中文赛车日历，覆盖 F1、WRC、Formula E，以及赛果、积分榜、天气、预测投票、管理后台和 PWA。

- Next.js 16 App Router、React 19、TypeScript、Tailwind CSS 4。
- 包管理器使用 pnpm，保留并更新 `pnpm-lock.yaml`；不要混入其他包管理器的锁文件。
- Vercel 构建配置见 `vercel.json`。README 记录 main 合并会自动部署，因此提交或推送前先说明影响；不能将本地构建成功视为线上已验证。

## 用户确认的协作规则

- 开发前使用独立开发分支，所有开发提交只落在开发分支；禁止直接在 main 提交或向 main 推送。
- 只有用户明确要求创建 PR 时才创建；不能自动创建 PR 或合并到 main。
- 当前开发分支是 `dev/data-pipeline`，后续任务可继续使用或按任务建立新分支。
- 部署使用 Vercel Hobby 免费版。用户已配置 Vercel 环境变量；这不代表本地或 Preview 环境也已配置，不要擅自覆盖线上变量。
- 用户会提供绑定开发分支的 Vercel 部署链接。用于部署的提交需推送到该开发分支；推送后预留约两分钟，再检查部署链接和版本。两分钟只是预期构建时间，不是部署成功的证据。

## 代码地图

- `app/`：页面；`app/api/`：服务端接口。
- `components/schedule-view.tsx`：首页数据请求、离线缓存、筛选和视图。
- `lib/types.ts`：`RaceEvent`、`RaceSession`、`ScheduleResponse` 数据契约。
- `lib/fetchers.ts`：F1 / FE 适配，重新导出 WRC 获取函数。
- `lib/wrc-puppeteer.ts`：WRC 官网接口、HTML 解析及第三方回退。名字含 puppeteer，但当前实现不启动 Puppeteer。
- `lib/wrc-data.ts`：硬编码 WRC 2026 日历和估计赛段。
- `lib/crawl-store.ts`：Neon 快照、配额、人工覆盖。
- `lib/db.ts`：数据库连接及其他业务表初始化。
- `lib/tz.ts`、`lib/format.ts`：UTC 转换和北京时间展示。
- `public/sw.js`：PWA 缓存；`public/circuits/`：实际使用的赛道图。
- 数据链路细节与已知问题见 `docs/data-flow.md`。

## 数据改动原则

- 场次时间保存为 UTC ISO 字符串，展示通过明确时区转换；保持北京时间主视图。当地时间转换需考虑夏令时。
- 保持事件 ID 稳定：人工覆盖、投票和通知依赖 ID。
- 保留 `tentative` 的真实含义，估计数据不能标成官方已确认数据；系列 `ok` 不等于所有赛事均已确认。
- 新增或修改数据源时同时考虑缓存、超时、失败返回、快照、配额和来源提示，并更新数据链路文档。
- 人工覆盖目前是顶层浅合并，`sessions` 等数组整体替换；改变合并策略前检查后台编辑和预览。
- 快照、Next fetch 缓存、SWR、localStorage 和 Service Worker 是不同层，变更刷新逻辑时分别验证。
- 不直接运行数据库管理/备份脚本或触发线上爬取来验证普通改动；这些动作可能连接生产库或消耗外部额度。使用明确的本地或测试环境。

## 环境与凭据

- 服务端环境变量：`DATABASE_URL`、`ADMIN_PASSWORD`、`OCBLACKTOP_API_KEY`、`NVIDIA_NIM_API_KEY`。
- 本地变量放 `.env.local`，不能提交密钥、数据库连接密码、真实用户数据，也不能复制到文档或日志。不要将服务端密钥改成 `NEXT_PUBLIC_*`。
- 仓库现有预测接口和数据库脚本存在硬编码凭据，不能沿用或传播这些默认值；相关功能开发前改用环境变量。凭据轮换需要在服务商和部署环境完成。
- 没有 `DATABASE_URL` 时，数据库功能降级：快照/覆盖不可用、配额不持久化。不要把降级结果当成持久化成功。
- 后台当前依赖 `admin_auth=true` cookie 的薄弱检查；新增管理接口时使用可验证的服务端认证，不复制该模式。

## 开发与验证

常用命令：`pnpm install --frozen-lockfile`、`pnpm dev`、`pnpm exec tsc --noEmit`、`pnpm build`。

- 当前没有测试脚本；`pnpm lint` 引用 eslint，但 package.json 未声明 eslint，也没有已提交的 ESLint 配置。不能宣称 lint 已通过。
- `next.config.mjs` 开启 `typescript.ignoreBuildErrors`，所以构建通过不代表类型检查通过。分别报告类型检查和构建结果，区分原有错误与新增错误。
- 文档和低影响改动做相应静态检查即可；数据逻辑改动覆盖成功、部分失败、全失败、无数据库、快照与配额耗尽、估计标记、时区边界等相关路径。
- UI 改动检查手机和桌面视图、加载/空数据/错误状态；保留中文产品文案与现有风格。
- 最终说明改了什么、验证了什么、还存在什么限制。避免未经用户要求顺带重构或改动部署设置。
