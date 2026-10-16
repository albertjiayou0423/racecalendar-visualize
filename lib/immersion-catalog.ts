export const immersionCases = [
  { id: 'countdown', name: '沉浸式倒计时', description: '真实倒计时、归零收束、关闭与键盘操作。' },
  { id: 'countdown-entry', name: '完整入场与倒计时', description: '入场波浪、倒计时与归零连续体验；全屏模式包含移动端入场震动。' },
  { id: 'lights-f1', name: 'F1 发车灯', description: '五列四灯位，调整红灯组数、辅助绿灯和延迟提示。' },
  { id: 'lights-fe', name: 'FE 发车灯', description: '上下两排灯位，使用实际灯板组件。' },
  { id: 'clock-wrc', name: 'WRC 单行计时', description: '当地时间与倒计时，13 个无缝方块字形，左右同字号。' },
  { id: 'wrc-sequence', name: 'WRC 连续赛段', description: '真实连续倒计时组件：归零后接下一已确认赛段，示例间隔 15 秒。' },
  { id: 'entrance', name: '入场波浪', description: '单独重播或定位入场波浪的任意时间。' },
  { id: 'final-pulse', name: '最后五秒边缘脉冲', description: '单独检查 WRC 每秒一次的屏幕边缘脉冲。' },
  { id: 'impact', name: '归零仪式动效', description: 'F1、FE 扩散与 WRC 主题色双帘，可逐帧检查。' },
] as const

export type ImmersionCaseId = typeof immersionCases[number]['id']
