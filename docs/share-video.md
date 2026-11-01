# 赛事飞行短片

赛事详情页的“赛道飞行短片”使用 Three.js 生成浏览器本地的 3D 画面，输出 9:16、22 秒无人机前视动画。画面只渲染一条主题色赛道线，背景为深色渐变；不建树木、护栏、无人机或其他场景模型。`PerspectiveCamera` 以低空前视角沿 `CatmullRomCurve3` 路线飞行；GSAP Timeline 以 22 秒的 `sine.inOut` 缓动控制镜头，左右倾斜幅度依据路线曲率平滑变化。闭合赛道从起点完整飞行一圈，开放赛段从首端飞到末端。赛事标题和日期叠加在最终录制画布上。录制需要用户点击开始；生成的视频保留在当前页面内，可预览、下载，或通过浏览器原生文件分享。实现按浏览器支持情况选择 MP4 或 WebM；没有可用录制能力时提示用户继续使用 PNG 分享卡片。

短片按赛事系列使用 F1 红、WRC 蓝、FE 绿。路线有两类：

- F1 轮廓参考 Global Motorsport Circuits JSON 的 23 条 `f1/active` 路线，数据固定到 revision `0c941730f3d3279da6a553f79c15e9ed62780b2c`，经重采样后随站点静态发布。轮廓只作视觉参考，不代表官方地图。
- FE 与 WRC 暂无匹配的公开几何数据；视频明确显示“赛道路线示意”或“赛段路线示意”，不会冒充真实赛道轨迹。WRC 使用点到点的开放路线表现赛段，F1/FE 示意路线为闭环。

公开几何的来源、固定版本、变换说明和 Apache-2.0 许可证见 [`public/track-routes/ATTRIBUTION.md`](../public/track-routes/ATTRIBUTION.md)。可用 `node scripts/import-track-routes.mjs` 重新生成静态数据和许可证副本。该来源本身没有记录几何来源或精度保证，因此界面会说明路线是参考还是示意。

3D 场景由 [Three.js](https://threejs.org/) 渲染；路线平滑与透视相机分别使用 [CatmullRomCurve3](https://threejs.org/docs/pages/CatmullRomCurve3.html) 和 [PerspectiveCamera](https://threejs.org/docs/pages/PerspectiveCamera.html)，镜头时间线和缓动使用 [GSAP](https://gsap.com/docs/v3/GSAP/Timeline/)。最终合成画布通过浏览器原生 [Canvas `captureStream()`](https://developer.mozilla.org/en-US/docs/Web/API/HTMLCanvasElement/captureStream) 与 [MediaRecorder 格式能力检测](https://developer.mozilla.org/en-US/docs/Web/API/MediaRecorder/isTypeSupported_static) 导出视频。
