# 赛事飞行短片

赛事详情页的“赛道飞行短片”使用 Canvas 在浏览器本地绘制 9:16、8.5 秒动画，再通过 `canvas.captureStream()` 与 `MediaRecorder` 导出。录制需要用户点击开始；生成的视频保留在当前页面内，可预览、下载，或通过浏览器原生文件分享。实现按浏览器支持情况选择 MP4 或 WebM；没有可用录制能力时提示用户继续使用 PNG 分享卡片。

短片按赛事系列使用 F1 红、WRC 蓝、FE 绿。路线有两类：

- F1 轮廓参考 Global Motorsport Circuits JSON 的 23 条 `f1/active` 路线，数据固定到 revision `0c941730f3d3279da6a553f79c15e9ed62780b2c`，经重采样后随站点静态发布。轮廓只作视觉参考，不代表官方地图。
- FE 与 WRC 暂无匹配的公开几何数据；视频明确显示“赛道路线示意”或“赛段路线示意”，不会冒充真实赛道轨迹。WRC 使用点到点的开放路线表现赛段，F1/FE 示意路线为闭环。

公开几何的来源、固定版本、变换说明和 Apache-2.0 许可证见 [`public/track-routes/ATTRIBUTION.md`](../public/track-routes/ATTRIBUTION.md)。可用 `node scripts/import-track-routes.mjs` 重新生成静态数据和许可证副本。该来源本身没有记录几何来源或精度保证，因此界面会说明路线是参考还是示意。

Canvas 视频基于浏览器原生录制接口：[Canvas `captureStream()`](https://developer.mozilla.org/en-US/docs/Web/API/HTMLCanvasElement/captureStream) 与 [MediaRecorder 格式能力检测](https://developer.mozilla.org/en-US/docs/Web/API/MediaRecorder/isTypeSupported_static)。
