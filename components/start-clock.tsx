/** Rally timing display. Uses the event timezone and planned first-car start time. */
export function StartClock({ seconds, started, now = Date.now(), timeZone = 'Asia/Shanghai' }: { seconds: number; started: boolean; now?: number; timeZone?: string }) {
  const text = started ? '00' : seconds >= 60 ? `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}` : String(seconds).padStart(2, '0')
  const time = new Intl.DateTimeFormat('en-GB', { timeZone, hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).format(now)
  const finalSeconds = !started && seconds <= 5
  return <div className={`rally-timer ${started ? 'released' : ''} ${finalSeconds ? 'final-beat' : ''}`}>
    <div className="rally-timer-columns">
      <div className="rally-time-column"><span className="rally-timer-label">当地时间</span><time className="rally-local-time" title={timeZone}>{time}</time><small>时 / 分 / 秒</small></div>
      <div className="rally-count-column"><span className="rally-timer-label">倒计时</span><strong key={finalSeconds ? seconds : 'steady'} className={`rally-count-number ${seconds >= 60 && !started ? 'compact' : ''}`} aria-label={started ? '赛程时间已到' : `倒计时 ${seconds} 秒`}>{text}</strong><small>{seconds >= 60 && !started ? '分钟 / 秒' : '秒'}</small></div>
    </div>
    <div className="rally-timer-line" aria-hidden="true"><span style={{ transform: `scaleX(${started ? 1 : Math.min(1, seconds / 30)})` }} /></div>
    <p className="rally-timer-status">{started ? '已到达计划发车时间' : finalSeconds ? '即将发车' : '距赛段首车发车'}</p>
  </div>
}