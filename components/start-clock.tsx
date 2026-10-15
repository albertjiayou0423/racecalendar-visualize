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
const LETTERS: Record<string, string[]> = {
  G: ['01110','10001','10000','10111','10001','10001','01110'],
  O: ['01110','10001','10001','10001','10001','10001','01110'],
}

/** Minimal rally start display. Schedule timing, not an individual car's start signal. */
export function StartClock({ seconds, started, now = Date.now(), timeZone = 'Asia/Shanghai' }: { seconds: number; started: boolean; now?: number; timeZone?: string }) {
  const text = started ? 'GO' : seconds >= 60 ? `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}` : String(seconds).padStart(2, '0')
  const time = new Intl.DateTimeFormat('en-GB', { timeZone, hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).format(now)
  // The separator occupies half a digit so long countdowns stay legible on phones.
  let cursor = 0
  const glyphs = text.split('').map(char => { const x = cursor; cursor += char === ':' ? 26 : 60; return { char, x } })
  return <div className={`rally-display ${started ? 'released' : ''}`}>
    <div className="rally-caption"><span className="rally-status-dot" />{started ? '赛程时间已到' : '距赛段首车出发'}</div>
    <svg className="rally-digits" viewBox={`0 0 ${cursor - 10} 70`} role="img" aria-label={started ? '赛程时间已到' : `倒计时 ${seconds} 秒`}>
      {glyphs.flatMap(({ char, x }) => char === ':' ? [22, 42].map(y => <rect key={`${x}-${y}`} x={x + 5} y={y} width="6" height="6" rx="1" fill="currentColor" />) : (LETTERS[char] ?? DIGITS[Number(char)]).flatMap((row, y) => row.split('').map((on, col) =>
        <rect key={`${x}-${y}-${col}`} x={x + col * 10 + 1} y={y * 10 + 1} width="7" height="7" rx="1" fill={on === '1' ? 'currentColor' : '#171915'} />)))}
    </svg>
    <div className="rally-release-line" aria-hidden="true"><span style={{ transform: `scaleX(${started ? 1 : Math.min(1, seconds / 30)})` }} /></div>
    <div className="rally-readout"><span><small>{timeZone === 'Asia/Shanghai' ? '北京时间' : '当地时间'}</small><time>{time}</time></span><span><small>{started ? '赛段状态' : '倒计时单位'}</small><b>{started ? '已到达计划发车时间' : seconds >= 60 ? '分钟 / 秒' : '秒'}</b></span></div>
  </div>
}
