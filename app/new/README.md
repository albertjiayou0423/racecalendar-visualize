# 简洁新版

所有新版组件和页面在本目录中；旧页面仅增加版本入口。开发分支 dev/data-pipeline，不自动创建或合并 PR。

## 路由
/new 为赛历；/new/event/[id] 为详情；另有 standings、results、wallpaper、circuits、about、developer、admin、playground。
/new/playground/immersion 及其 [component] 子路由直接测试真实沉浸组件。

## 组件与数据
先建立 primitives、data-ui、过滤器、赛事卡片、日历、表格、图表、反馈和导出组件，再由各 view 组合页面。所有界面内部导航保持 /new，旧版出口显式使用 /?home=classic。
赛程继续调用 /api/schedule，复用原有浏览器缓存合并机制；不会另建数据库或更改持久化规则。估计、客户端待核验时间不用于精确倒计时。WRC 自动入场复用原有两分钟窗口与去重规则，连续赛段使用真实 WrcCountdownSequence。
天气、投票、计时只在对应面板打开后读取；AI 预测只在明确点击后请求。后台复用原有签名会话和 requireAdmin 接口，私有数据不写 localStorage。
进入新版首页写 racecalendar-home-version=new；旧版出口清除选择。localStorage 不可用时不阻塞页面。
开发者签名为用户提供的原始 SVG，保留路径与比例，深色下反相提高对比。

## 隔离与验证
全局采集和旧引导对新版后台、测试页做路由隔离；Playground 拦截所有业务与外部请求。真实组件的网络错误状态会明确显示，不伪装成成功。
本地 UI 验证使用 artifacts 下的不提交隔离代理，所有 /api 请求由测试响应拦截，不连接生产库或发起线上采集。
运行 pnpm exec tsc --noEmit、pnpm build、pnpm test。构建通过不等于页面验收。新版组件手册仍需继续补齐独立参数覆盖，后台写入操作需测试环境专项验收。
