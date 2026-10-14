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
  const text = seconds >= 60 ? `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}` : String(seconds)
  const time = new Intl.DateTimeFormat('en-GB', { timeZone, hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).format(now)
  const handAngle = (Math.floor(now / 1000) % 60) * 6
  return <div className={`rally-clock ${started ? 'go' : ''}`}><div className="rally-clock-face"><svg viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="40" fill="none" stroke="#547c87" strokeWidth="1.5" />{Array.from({ length: 12 }, (_, i) => <line key={i} x1="50" y1="10" x2="50" y2="15" stroke="#729ba5" transform={`rotate(${i * 30} 50 50)`} />)}<line x1="50" y1="50" x2="50" y2="16" stroke="#d9e8e7" strokeWidth="2" transform={`rotate(${handAngle} 50 50)`} /><circle cx="50" cy="50" r="2" fill="#d9e8e7" /></svg><span>{time}</span><small>{timeZone === 'Asia/Shanghai' ? '北京时间' : '当地时间'}</small></div><div className="rally-countdown-row"><svg viewBox={`0 0 ${text.length * 60 + 8} 82`} role="img" aria-label={`起跑计时 ${text}`}>
    {text.split('').flatMap((digit, d) => digit === ':' ? [<circle key={`${d}-a`} cx={32 + d * 60} cy={31} r={3.2} fill="currentColor" />, <circle key={`${d}-b`} cx={32 + d * 60} cy={51} r={3.2} fill="currentColor" />] : DIGITS[Number(digit)].flatMap((row, y) => row.split('').map((on, x) =>
      <circle key={`${d}-${y}-${x}`} cx={12 + d * 60 + x * 10} cy={11 + y * 10} r={2.8} fill={on === '1' ? 'currentColor' : '#171c14'} />)))}
  </svg><small>{seconds >= 60 ? '分 : 秒' : '秒'}</small></div></div>
}
