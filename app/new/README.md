# 新版

## 设计边界
新版首页采用独立简洁组件，可以创新布局与交互。其他界面直接复用现有页面和成熟组件，不为了统一外观而重做。所有对应路由保留在 /new 下。

## 页面与复用
/new 是新版赛历，/new/event/[id] 复用原赛事详情（EventHeader、SessionTimeline、WatchInfo、Highlights、DeepInfo、AIPrediction、ShareCard 等）。
standings、results、wallpaper、circuits、about、admin、playground 复用现有页面和真实组件。沉浸实验室复用同一个 ImmersionLab，通过 basePath 保持返回路径正确。
开发者页面复用 DeveloperProfile，新旧版都使用用户提供的新签名。signature-write.svg 保留原填充轮廓，沿双侧边缘恢复的中心线用遮罩一次写成；约四秒后保持完整签名。减少动态效果时直接显示静态签名。更换原始 SVG 后运行 node scripts/build-signature.mjs 重新生成。
EditionLink 只在 /new 内映射已知页面链接，旧页面行为不变，API、静态资源、外部链接与锚点不改写。新版壳仅包裹首页，避免简洁版样式影响原组件。

## 数据与偏好
首页 /api/schedule 继续使用原数据契约及浏览器缓存合并；估计和客户端待核验时间不参与精确倒计时。自动沉浸沿用两分钟窗口、去重及连续 WRC 赛段组件。
“下一场”跟随当前首页筛选；自动入场仍沿用全系列已确认场次的原有规则。空日期保留日历导航，可取消选日或清除筛选。首次挂载按实际北京时间校正月份，避免静态构建时间过期。来源详情中可手动刷新赛历。
新版赛事详情的“返回赛程”明确返回 /new，不依赖直接打开详情前的外部浏览历史。手机图标按钮提供可读名称；首页支持 / 搜索、F 沉浸和 1/2/3 切换视图，输入框及弹窗内不抢占快捷键。
进入新版首页保存 racecalendar-home-version=new，下次访问 / 自动进入 /new。/?home=classic 清除选择，旧版页面不受改版影响。
旧版只在页面底部功能胶囊中提供“试试新版”直达链接，不自动或手动弹出新版介绍弹窗。
新版后台和测试页不触发客户端采集，旧版引导不在新版自动弹出。Playground 阻止业务及外部请求。Service Worker 不拦截新版后台和测试页。

## 验证
分别运行 pnpm exec tsc --noEmit、pnpm build、pnpm test。使用不提交的本地隔离代理做 UI 检查，不连接生产库或手动触发线上采集。实际线上视觉验收与部署状态分别报告。
