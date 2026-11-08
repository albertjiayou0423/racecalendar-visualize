# 赛事飞行短片

赛事详情页的“赛道飞行短片”使用 2D Canvas 生成浏览器本地的 9:16、22 秒描线动画。开场展示赛事名称，文字虚化并缩成笔尖，同时镜头推近起跑线；随后逐段画出完整赛道并跟随笔尖平移。闭合赛道画完一圈，开放赛段从首端画到末端。画完后镜头拉远展示完整轮廓，再显示赛事标题、地点和时间。画面使用主题色单线与深色渐变背景，不绘制立体场景或无人机模型。GSAP Timeline 控制描线路径进度与镜头推拉；录制时通过 Web Audio API 合成轻柔氛围和弦，滤波亮度、和弦音高与音量逐步上升，在视频结束时达到峰值。录制需要用户点击开始；生成的视频保留在当前页面内，可预览、下载，或通过浏览器原生文件分享。实现按浏览器支持情况选择 MP4 或 WebM；没有可用录制能力时提示用户继续使用 PNG 分享卡片。

短片按赛事系列使用 F1 红、WRC 蓝、FE 绿。路线有两类：

- F1 轮廓参考 Global Motorsport Circuits JSON 的 23 条 `f1/active` 路线，数据固定到 revision `0c941730f3d3279da6a553f79c15e9ed62780b2c`，经重采样后随站点静态发布。轮廓只作视觉参考，不代表官方地图。
- FE 与 WRC 暂无匹配的公开几何数据；视频明确显示“赛道路线示意”或“赛段路线示意”，不会冒充真实赛道轨迹。WRC 使用点到点的开放路线表现赛段，F1/FE 示意路线为闭环。

公开几何的来源、固定版本、变换说明和 Apache-2.0 许可证见 [`public/track-routes/ATTRIBUTION.md`](../public/track-routes/ATTRIBUTION.md)。可用 `node scripts/import-track-routes.mjs` 重新生成静态数据和许可证副本。该来源本身没有记录几何来源或精度保证，因此界面会说明路线是参考还是示意。

描线路径与镜头时间线使用 [GSAP Timeline](https://gsap.com/docs/v3/GSAP/Timeline/)，氛围音乐由浏览器原生 [Web Audio API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API) 合成并与画面流合并。最终画布通过浏览器原生 [Canvas `captureStream()`](https://developer.mozilla.org/en-US/docs/Web/API/HTMLCanvasElement/captureStream) 与 [MediaRecorder 格式能力检测](https://developer.mozilla.org/en-US/docs/Web/API/MediaRecorder/isTypeSupported_static) 导出视频。
