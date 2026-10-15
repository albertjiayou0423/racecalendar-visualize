# 沉浸与仪式感测试

入口 `/playground/immersion`，原组件 Playground 顶部也提供链接。总览直接挂载真实组件，参数与重播各自独立；没有将组件截图或另写视觉替身嵌入页面。

每项都有 `/playground/immersion/<id>` 独立全屏路由：

| id | 真实组件 |
| --- | --- |
| countdown | ImmersiveCountdown |
| countdown-entry | ImmersiveCountdown，启用入口波浪 |
| lights-f1 | StartLights，F1 |
| lights-fe | StartLights，FE |
| clock-wrc | StartClock |
| entrance | CountdownEntrance |
| final-pulse | CountdownFinalPulse |
| impact | CountdownImpact，与系列对应的真实灯板/计时组件 |

CountdownEntrance、CountdownFinalPulse、CountdownImpact 同时用于实际倒计时页面和测试页。完整倒计时的内联模式只改变挂载方式，不锁滚动、不产生震动；全屏子页使用真实模态逻辑，包括焦点限制、ESC 与关闭。全屏测试控制放在该模态内部，键盘可以访问。

倒计时可选择 5/10/30/120 秒、长倒计时和已归零状态，也可输入秒数、切换赛事系列与当地时区。灯板可以调整红灯组数、辅助绿灯和延迟提示。纯动画提供时间滑块、关键帧按钮及完整重播；WRC 归零动效最长 2600 毫秒，其余效果使用实际时长。

全屏页顶部“返回”或 ESC 回到总览；参数面板可折叠，以免遮挡画面。每项均遵循系统减少动态效果偏好。所有路由位于 `/playground` 下，沿用网络保护，不爬取、不写数据库、不请求真实业务 API。测试系列不是实时比赛信号；实际赛事仍按确认时间与既有自动入场规则触发。
