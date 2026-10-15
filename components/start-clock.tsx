// Thirteen square pixels per digit, with row widths 3 / 2 / 3 / 2 / 3.
const PIXELS = [[0,0],[6,0],[12,0],[0,6],[12,6],[0,12],[6,12],[12,12],[0,18],[12,18],[0,24],[6,24],[12,24]]
const NUMERALS = [
  '111'+'11'+'101'+'11'+'111',
  '001'+'01'+'001'+'01'+'001',
  '111'+'01'+'111'+'10'+'111',
  '111'+'01'+'111'+'01'+'111',
  '101'+'11'+'111'+'01'+'001',
  '111'+'10'+'111'+'01'+'111',
  '111'+'10'+'111'+'11'+'111',
  '111'+'01'+'001'+'01'+'001',
  '111'+'11'+'111'+'11'+'111',
  '111'+'11'+'111'+'01'+'111',
]
const width = (text: string) => [...text].reduce((sum, char) => sum + (char === ':' ? 10 : 24), 0)

function Code({ text, x }: { text: string; x: number }) {
  let cursor = x
  return <>{[...text].map((char, index) => {
    const offset = cursor
    cursor += char === ':' ? 10 : 24
    return <g key={index} data-digit={char === ':' ? undefined : char} transform={`translate(${offset} 0)`}>{char === ':'
      ? <><rect x="1" y="6" width="6" height="6" /><rect x="1" y="18" width="6" height="6" /></>
      : PIXELS.map(([x, y], pixel) => <rect key={pixel} x={x} y={y} width="6" height="6" fill={NUMERALS[Number(char)][pixel] === '1' ? 'currentColor' : '#240d0e'} />)}
    </g>
  })}</>
}

/** One baseline and one digit scale for both clocks; no font dependency. */
export function StartClock({ seconds, started, now = Date.now(), timeZone = 'Asia/Shanghai' }: { seconds: number; started: boolean; now?: number; timeZone?: string }) {
  const text = started ? '00' : seconds >= 60 ? `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}` : String(seconds).padStart(2, '0')
  const time = new Intl.DateTimeFormat('en-GB', { timeZone, hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).format(now)
  const label = `当地时间 ${time}；${started ? '赛程时间已到' : `倒计时 ${seconds} 秒`}`
  // A shared scale keeps both clocks equal; trim unused countdown slots instead of leaving a gap.
  const countStart = width(time) + 8
  const end = countStart + width(text)
  const referenceWidth = width('00:00:00') + 8 + width('00:00')
  return <div className="rally-inline" role="img" aria-label={label} title={timeZone}>
    <svg style={{ width: `${end / Math.max(referenceWidth, end) * 100}%` }} viewBox={`0 0 ${end} 30`} aria-hidden="true"><g className="rally-local-digits"><Code text={time} x={0} /></g><Code text={text} x={countStart} /></svg>
  </div>
}
