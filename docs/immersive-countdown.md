# 沉浸式开赛倒计时

视觉使用扁平化设计：纯色灯板与信号、细边框、点阵数字与二维示意路线。允许亮灯与点阵的少量柔和光晕，熄灯时消退；不使用渐变外壳、立体阴影或透视。

首页可见时，已确认场次距开始 0–30 秒（不包含归零）自动覆盖进入倒计时，适用于全部系列与首页视图。WRC 每站只允许时间最早的有效赛段自动触发：先按时间选第一段，再判断时间确认状态与触发窗口，不会在第一段过去后改为自动弹出后续段。忽略无效、估计、客户端待核验时间；有其他模态窗口时等待。多个场次选最近开赛者，不受首页筛选影响。

赛事详情时间线中，每个有有效且非估计时间的 WRC 赛段均提供手动倒计时按钮；待定赛段不虚构倒计时。

自动进入采用 1.25 秒的自下向上波浪转场，波浪离场后露出计时画面，关闭按钮始终可用。移动端粗指针设备尝试短震 35 毫秒；浏览器不支持、限制震动或没有用户激活时静默降级。减少动态效果模式不播放波浪也不震动。手动进入不触发该自动入场震动。

进入后保留该场次，不随首页下一场目标变化。sessionStorage 按赛事 ID 与 UTC 记录本标签页已展示场次，关闭、刷新后不重复弹出；存储不可用时使用内存记录。后台标签页不触发，回到首页可见时重新判断。离开首页不显示。

数字使用 NumberFlow 按位滚动，长倒计时拆分天、小时、分钟、秒；分钟与秒的十位限制为 5。最后五秒只显示秒。减少动态效果偏好由库默认尊重。

起跑装置仅在最后 30 分钟显示。F1 最后五秒逐秒亮起五组红灯，归零熄灯；WRC 展示三位点阵计时牌；FE 使用五组红灯，不再使用虚构能量环。归零文案是“赛程时间已到”，不宣称实际发车。

正赛可手动观看压缩时长的程序演示：F1 示意暖胎圈 12 秒、2026 蓝色预启动提示 5 秒、红灯序列 5 秒；FE 演示预备发车区到正式发车位的移动 12 秒，再显示红灯序列。模拟时间为展示节奏，不是官方暖胎圈时长。无实时 API 驱动，不代表现场状态；练习赛和排位赛不提供该正赛演示。WRC 装置以点阵时钟为设计参考，不保证每站硬件外观一致。

资料：[F1 发车与暖胎圈](https://www.formula1.com/en/latest/article/the-beginners-guide-to-the-f1-weekend.5RFZzGXNhEi9AEuMXwo987)、[F1 2026 蓝色预启动](https://www.formula1.com/en/latest/article/explained-why-race-starts-will-be-different-in-2026.7ADR4zkfl299T7i3ZYVTYK)、[FE 官方周末指南](https://www.fiaformulae.com/en/news/races/explained-season-10-and-mexico-cdey-is-here-so-how-does-a-formula-e-race-weekend-work)、[FE 2025–26 规则](https://api.fia.com/system/files/documents/2025-2026_fia_formula_e_world_championship_-_sporting_regulations_10.12.2025_-_marked_up_2.pdf)、[WRC 2026 规则](https://api.fia.com/system/files/documents/wrc_2026_sr_version_13_january_2026.pdf)。OpenF1 实时数据需要认证，因此本版未接入实时发车信号。

全屏是覆盖页面的模态层，不自动调用浏览器 Fullscreen API。支持关闭与 ESC、焦点限制与恢复、滚动恢复。无自动音频。减少动态效果模式关闭动画，保留信号状态。Playground 仍是内联预览，不自动覆盖或锁滚动。
