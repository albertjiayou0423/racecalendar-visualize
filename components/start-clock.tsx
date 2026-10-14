const DIGITS = [
  ['01110','10001','10011','10101','11001','10001','01110'],
  ['00100','01100','00100','00100','00100','00100','01110'],
  ['01110','10001','00001','00010','00100','01000','11111'],
  ['11110','00001','00001','01110','00001','00001','11110'],
  ['00010','00110','01010','10010','11111','00010','00010'],
  ['11111','10000','10000','11110','00001','00001','11110'],
  ['01110','10000','10000','11110','10001','10001','01110'],
  ['11111','00001','00010','00100','01000','01000','01000'],
  ['01110','10001','10001','01110','10001','10001','01110'],
  ['01110','10001','10001','01111','00001','00001','01110'],
]
/** Rally-style LED countdown clock; event-specific hardware may differ. */
export function StartClock({ seconds, started, now = Date.now(), timeZone = 'Asia/Shanghai' }: { seconds: number; started: boolean; now?: number; timeZone?: string }) {
  const text = seconds > 60 ? `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}` : String(seconds).padStart(3, '0')
  const time = new Intl.DateTimeFormat('en-GB', { timeZone, hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).format(now)
  return <div className={`rally-clock ${started ? 'go' : ''}`}><div className="rally-clock-time"><span>{time}</span><small>{timeZone === 'Asia/Shanghai' ? '北京时间' : '当地时间'}</small></div><div className="rally-countdown-row"><span className={`rally-start-dot ${started ? 'green' : 'red'}`} /><svg viewBox={`0 0 ${text.length * 60 + 8} 82`} role="img" aria-label={`起跑计时 ${text}`}>
    {text.split('').flatMap((digit, d) => digit === ':' ? [<circle key={`${d}-a`} cx={32 + d * 60} cy={31} r={3.2} fill="currentColor" />, <circle key={`${d}-b`} cx={32 + d * 60} cy={51} r={3.2} fill="currentColor" />] : DIGITS[Number(digit)].flatMap((row, y) => row.split('').map((on, x) =>
      <circle key={`${d}-${y}-${x}`} cx={12 + d * 60 + x * 10} cy={11 + y * 10} r={3.2} fill={on === '1' ? 'currentColor' : '#202319'} />)))}
  </svg></div></div>
}
