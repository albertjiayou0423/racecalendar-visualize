# 沉浸式开赛倒计时

视觉使用扁平化设计：纯色灯板与信号、细边框、点阵数字。允许亮灯与点阵的少量柔和光晕；不使用渐变外壳、立体阴影或透视，不再画模拟车辆或赛道路线。

首页可见时，已确认场次距开始 0–30 秒（不包含归零）自动覆盖进入倒计时，适用于全部系列与首页视图。WRC 每站只允许时间最早的有效赛段自动触发：先按时间选第一段，再判断时间确认状态与触发窗口，不会在第一段过去后改为自动弹出后续段。忽略无效、估计、客户端待核验时间；有其他模态窗口时等待。多个场次选最近开赛者，不受首页筛选影响。

赛事详情时间线中，每个有有效且非估计时间的 WRC 赛段均提供手动倒计时按钮；待定赛段不虚构倒计时。

自动进入采用 1.25 秒的自下向上波浪转场，波浪离场后露出计时画面，关闭按钮始终可用。移动端粗指针设备尝试短震 35 毫秒；浏览器不支持、限制震动或没有用户激活时静默降级。减少动态效果模式不播放波浪也不震动。手动进入不触发该自动入场震动。

进入后保留该场次，不随首页下一场目标变化。sessionStorage 按赛事 ID 与 UTC 记录本标签页已展示场次，关闭、刷新后不重复弹出；存储不可用时使用内存记录。后台标签页不触发，回到首页可见时重新判断。离开首页不显示。

数字使用 NumberFlow 按位滚动，长倒计时拆分天、小时、分钟、秒；分钟与秒的十位限制为 5。最后五秒只显示秒。减少动态效果偏好由库默认尊重。

起跑装置仅在最后 30 分钟显示（明确启动的 Playground 演示除外）。F1 依据实拍与 FIA 图示展示五列四灯位，下方两红灯成对亮起；FE 依据 2026 马德里起跑图展示上下两排五灯，下排红灯，上排辅助绿灯。F1 2026 蓝色预启动提示单独画出，不把红灯染蓝。WRC 依据墨西哥站设备布局展示当地时钟与点阵倒计时，保留每站设备可能不同的说明。

F1、FE 正赛到达赛程时间后自动播放灯光程序，无车辆和路线动画。F1 模拟绿灯 30 秒、灯灭等待至模拟第 90 秒，再蓝色提示 5 秒、红灯逐组亮起 5 秒、全亮保持 1.5 秒后熄灭；FE 模拟绿灯就位 20 秒后红灯序列，不称完整暖胎圈。以上时长是明确标注的模拟参数，不是对实际暖胎圈结束时刻的断言。用户在 F1 赛程开始后两分钟或 FE 开始后半分钟内到达首页，也可进入一次。正赛手动演示采用压缩时长；练习赛和排位赛不播放正赛暖胎圈程序。

F1 实时状态来自 `/api/f1-start`，详见 `docs/data-flow.md`。明确 FORMATION LAP 消息自动显示绿灯（消息开始后 30 秒熄灭），明确 RACE START 或场次已 Started 且有圈数时，显示比赛已开始并熄灯；延迟信号亮橙色提示，结束信号停止程序。当前场次日期、类型、GMT 偏移、消息时间均校验；普通 GREEN FLAG、涉及练习起步的处罚、不匹配日期不能触发。真实消息优先于模拟；上游不提供逐灯遥测，蓝灯/红灯序列不可标为现场同步。失联不重播已经识别的比赛开始/结束/延迟状态。免费接口只验证过协商和结束场次快照，正式实时发车期间仍需验收。

资料：[FIA 灯光图](https://argent.fia.com/web/fia-public.nsf/1330F0769A59327AC125736200478FB9/$FILE/03__Recommended_light_signals.pdf)、[F1 2026 蓝色预启动](https://www.formula1.com/en/latest/article/explained-why-race-starts-will-be-different-in-2026.7ADR4zkfl299T7i3ZYVTYK)、[FE 2025–26 规则](https://www.fia.com/system/files/documents/2025-2026_fia_formula_e_world_championship_-_sporting_regulations_27.02.2026_-_clean.pdf)、[马德里 FE 起跑画面](https://mediasetinfinity.mediaset.it/video/formulae/la-partenza-delle-prix-di-madrid_F314264701006C01)、[WRC 墨西哥设备实拍](https://www.aztecabajio.com/deportes/rally-guanajuato-2023-itinerario-las-etapas-cuando-inicia-rally-2023)、[FastF1 免费源客户端](https://github.com/theOehrly/Fast-F1/blob/master/fastf1/livetiming/client.py)。

全屏是覆盖页面的模态层，不自动调用浏览器 Fullscreen API。支持关闭与 ESC、焦点限制与恢复、滚动恢复。无自动音频。减少动态效果模式关闭动画，保留信号状态。Playground 仍是内联预览，不自动覆盖或锁滚动。
