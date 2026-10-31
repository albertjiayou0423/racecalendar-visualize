# 界面动效适配

采用选型 HTML 中选中的原生库预设；保留现有页面布局、字体、配色和数据请求逻辑。依赖通过 pnpm 固定版本并随项目打包，不使用运行时 CDN。

| 选型 | 库 / 预设 | 项目中的触发位置 |
| --- | --- | --- |
| 12 | CSShake / little | 反馈表单必填项、邮箱校验失败 |
| 13 | CSShake / horizontal | 新旧首页搜索无结果时按 Enter，输入期间不抖动 |
| 15 | Loaders.css / ball-pulse | 赛历加载区域，保留原有骨架 |
| 16 | Loaders.css / ball-grid-pulse | 新版来源详情的刷新按钮，保留已有内容及来源栏布局 |
| 17 | Loaders.css / line-scale | Live Timing 首次请求 |
| 18 | SpinKit / plane | 仅 Playground 预设，正式首页不叠加第二种加载动画 |
| 19 | SpinKit / chase | 天气组件请求中 |
| 20 | SpinKit / circle | F1、WRC 积分榜请求中；FE 保留原骨架屏 |
| 22 | Hamburgers / spring | 仅 Playground 预设；正式筛选恢复原 Filter 图标，避免与菜单语义混淆 |
| 25 | Tippy.js / scale | 新版原有收藏按钮操作确认，状态仍由原收藏逻辑维护 |
| 43 | Driver.js / spotlight | 旧版使用指南的目标聚焦，沿用原指南内容、对话框和步骤控制 |
| 48 | Typed.js / type | 仅 Playground 预设；正式标题保持静态，避免阅读和排版干扰 |
| 49 | Typed.js / backspace | 新旧首页搜索 placeholder，聚焦立即停止，不操作输入值 |
| 50 | Typed.js / fade | 仅 Playground 预设；正式来源状态保持静态，避免容器宽度变化 |

共用实现：`components/interface-motion.tsx` 与 `interface-motion.css`。没有计时器人为延长加载；失败和空数据仍由原组件决定。JavaScript 动效库按需导入，组件卸载时销毁实例和计时器。

v2.3.2 的 Playground 新增 `MotionLoader`、`MotionInput`、`MotionText`、`FavoriteMotion` 和 `SpringToggle` 行。加载器提供六个独立预设，尺寸限制为 8–64 px；输入框有搜索提示、无结果和邮箱校验预设；收藏仅在预览内切换状态，不保存偏好。`UsageGuide` 继续在原有组件行中测试。新旧版首页及反馈邮箱直接使用同一 `MotionInput`，预览不是第二份动画实现。

`prefers-reduced-motion: reduce` 下保留静态加载标记和完整文字，关闭抖动、打字、灯点旋转、菜单过渡与气泡缩放。库不注入字体；Tippy 使用现有设计变量，同时只展示一个收藏反馈，滚动、失焦和 Escape 均收起。

Driver 的全局 pointer-events / overflow 样式不引入：只使用其原生聚焦 SVG 和淡入预设，将遮罩放进现有原生 dialog，以免遮罩落到顶层对话框后方或使关闭按钮失效。原有边框与面板布局保留；库未加载时继续使用现有聚焦实现。

验证不应额外提交真实反馈、触发生产爬取或修改数据库。加载、失败、空数据应使用 Playground 或本地测试数据检查。
