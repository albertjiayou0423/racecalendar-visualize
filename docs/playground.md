# Playground 组件 Cheatsheet

`/playground` 按组件逐行展示：左侧直接挂载正式 React 组件，右侧调整该组件自己的参数。手机上预览在上、参数在下。每行的预设胶囊互相独立；可调 props 使用开关、输入框和下拉框，数组及完整对象 JSON 默认折叠。

组件只有在接近视口时才挂载，减少整页一次挂载 38 个组件带来的开销。没有公开 props 的组件提供默认、窄屏、全宽预设；没有可视界面的后台组件会注明。Playground 注入稳定样例时间和数据，拦截 `/api/` 及外部网络请求；不会将测试内容提交到业务接口。需要隔离的正式组件通过 `PlaygroundContext` 识别此页面。

组件目录由 `lib/playground-catalog.ts` 维护；新增条目时登记真实导出、默认/变体/边界 props，并在 `components/playground-preview.tsx` 登记对应动态导入。内部 Context、hook 和样式工具不是独立 UI 组件。
