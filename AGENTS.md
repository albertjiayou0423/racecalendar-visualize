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
- 部署检查链接：`https://racecalendar-visualize.vercel.app/`。浏览器权限被拒绝时不得绕过；可检查 GitHub 的部署状态，但不能将状态成功等同实际页面已验证。

## 标准开发流程

1. 开始前检查当前分支、工作区改动和未跟踪文件，并阅读本文件及任务涉及的文档；保留用户已有改动，不要顺手清理无关文件。
2. 在开发分支上工作。若当前处于 `main`，先切换到合适的开发分支再修改；默认沿用 `dev/data-pipeline`，除非任务适合单独分支。修改前确认不会把用户未提交的改动混入任务。
3. 先理解相关页面、组件、数据契约和调用链，再做范围最小的实现。涉及数据来源、持久化或用户可见状态时，同步更新对应文档。
4. 按改动范围运行验证：至少检查 diff 和格式错误；UI 变更尽量检查手机与桌面显示，数据逻辑变更覆盖其关键成功与失败路径。分别报告 `pnpm exec tsc --noEmit` 和 `pnpm build` 的结果；因仓库现有问题无法通过时，指出实际错误，不用构建成功代替类型检查结论。
5. 每项更改或开发任务完成并通过相应本地验证后，直接将本任务明确修改的文件提交到当前开发分支，并推送到该分支触发 Vercel 预览部署，不必再次询问用户。使用清晰、简短的提交说明；不要把用户已有改动或无关临时产物混入提交。提交和推送前检查当前分支，绝不提交或推送到 `main`。不得自动创建 PR 或合并，只有用户明确要求时才执行。
6. 每次推送后等待约两分钟，再检查部署状态并用 `https://racecalendar-visualize.vercel.app/` 验证实际效果。部署状态 READY 或 HTTP 200 只证明部署/请求可用；涉及视觉行为时必须实际检查目标页面，并覆盖相关的桌面/手机及加载、空数据或错误状态。浏览器权限被拒绝时不得绕过；浏览器不可用时如实说明限制，不以部署成功代替页面验收。
7. 最后说明改动文件与行为、验证结果、提交和部署状态，以及未解决的问题或验证限制；确认工作区中没有误提交的无关改动。

## 代码地图

- `app/`：页面；`app/api/`：服务端接口。
- `components/schedule-view.tsx`：首页数据请求、离线缓存、筛选和视图。
- `lib/types.ts`：`RaceEvent`、`RaceSession`、`ScheduleResponse` 数据契约。
- `lib/fetchers.ts`：F1 / FE 适配，重新导出 WRC 获取函数。
- `lib/wrc-puppeteer.ts`：WRC 官网接口、HTML 解析及第三方回退。名字含 puppeteer，但当前实现不启动 Puppeteer。
- `lib/wrc-data.ts`：硬编码 WRC 2026 日历和估计赛段。
- `lib/crawl-store.ts`：Neon 快照、配额、人工覆盖。
- `lib/db.ts`：数据库连接及其他业务表初始化。
- `lib/admin-session.ts` / `lib/admin-auth.ts`：签名管理员会话及服务端授权。
- `app/api/admin/database/route.ts` / `components/database-inspector.tsx`：业务表只读检查。
- `lib/fetch-with-snapshot.ts` / `lib/schedule-fetch.ts`：首页与后台共用的失败回退、成功持久化及计数策略。
- `components/client-crawl.tsx` / `app/api/client-crawl/route.ts` / `lib/client-crawl.ts` / `lib/client-crawl-store.ts`：访客网络辅助采集、任务令牌、自动补缺和事务持久化；细节见 `docs/client-crawl.md`。
- `lib/tz.ts`、`lib/format.ts`：UTC 转换和北京时间展示。
- `public/sw.js`：PWA 缓存；`public/circuits/`：实际使用的赛道图。
- 数据链路细节与已知问题见 `docs/data-flow.md`。

## 数据改动原则

- 场次时间保存为 UTC ISO 字符串，展示通过明确时区转换；保持北京时间主视图。当地时间转换需考虑夏令时。
- 保持事件 ID 稳定：人工覆盖、投票和通知依赖 ID。
- 保留 `tentative` 的真实含义，估计数据不能标成官方已确认数据；系列 `ok` 不等于所有赛事均已确认。
- 客户端上传只补已知赛事的缺失场次或无效 UTC，不覆盖已有有效时间；保留待核验和客户端来源标记。所有应用快照写入共用系列事务锁，不能绕过锁引入并发覆盖。
- 新增或修改数据源时同时考虑缓存、超时、失败返回、快照、配额和来源提示，并更新数据链路文档。
- 人工覆盖目前是顶层浅合并，`sessions` 等数组整体替换；改变合并策略前检查后台编辑和预览。
- 快照、Next fetch 缓存、SWR、localStorage 和 Service Worker 是不同层，变更刷新逻辑时分别验证。
- 不直接运行数据库管理/备份脚本或触发线上爬取来验证普通改动；这些动作可能连接生产库或消耗外部额度。使用明确的本地或测试环境。

## 环境与凭据

- 服务端环境变量：`DATABASE_URL`、`ADMIN_PASSWORD`、`OCBLACKTOP_API_KEY`、`NVIDIA_NIM_API_KEY`。
- 本地变量放 `.env.local`，不能提交密钥、数据库连接密码、真实用户数据，也不能复制到文档或日志。不要将服务端密钥改成 `NEXT_PUBLIC_*`。
- 预测接口和数据库脚本已移除硬编码凭据，`.env` 已停止跟踪；历史提交曾包含凭据，应在服务商轮换并更新部署变量，不能恢复这些默认值。
- 没有 `DATABASE_URL` 时，数据库功能降级：快照/覆盖不可用、配额不持久化。不要把降级结果当成持久化成功。
- 后台使用 `ADMIN_PASSWORD` 签名的随机会话，有效期一小时。旧 `admin_auth=true` 无效；新增管理接口必须调用 `requireAdmin`，私有响应禁止缓存。

## 开发与验证

常用命令：`pnpm install --frozen-lockfile`、`pnpm dev`、`pnpm exec tsc --noEmit`、`pnpm build`。

- 使用 Node 24 运行 `pnpm test`，测试覆盖认证、数据失败回退、数据库只读查询与分页。`pnpm lint` 引用 eslint，但 package.json 未声明 eslint，也没有已提交的 ESLint 配置。不能宣称 lint 已通过。
- 完整类型检查目前有原有问题，包括未被使用、内容损坏的 `lib/circuit-db.ts` 及其他页面类型错误；报告实际限制，不能只看忽略类型的构建结果。
- `next.config.mjs` 开启 `typescript.ignoreBuildErrors`，所以构建通过不代表类型检查通过。分别报告类型检查和构建结果，区分原有错误与新增错误。
- 文档和低影响改动做相应静态检查即可；数据逻辑改动覆盖成功、部分失败、全失败、无数据库、快照与配额耗尽、估计标记、时区边界等相关路径。
- UI 改动检查手机和桌面视图、加载/空数据/错误状态；保留中文产品文案与现有风格。
- 最终说明改了什么、验证了什么、还存在什么限制。避免未经用户要求顺带重构或改动部署设置。
