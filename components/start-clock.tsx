// Thirteen square pixels per digit, with row widths 3 / 2 / 3 / 2 / 3.
const PIXELS = [[0,0],[8,0],[16,0],[0,8],[16,8],[0,16],[8,16],[16,16],[0,24],[16,24],[0,32],[8,32],[16,32]]
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
const width = (text: string) => [...text].reduce((sum, char) => sum + (char === ':' ? 12 : 28), 0)

function Code({ text, x }: { text: string; x: number }) {
  let cursor = x
  return <>{[...text].map((char, index) => {
    const offset = cursor
    cursor += char === ':' ? 12 : 28
    return <g key={index} data-digit={char === ':' ? undefined : char} transform={`translate(${offset} 0)`}>{char === ':'
      ? <><rect x="1" y="8" width="6" height="6" /><rect x="1" y="24" width="6" height="6" /></>
      : PIXELS.map(([x, y], pixel) => <rect key={pixel} x={x} y={y} width="6" height="6" fill={NUMERALS[Number(char)][pixel] === '1' ? 'currentColor' : '#240d0e'} />)}
    </g>
  })}</>
}

/** One baseline and one digit scale for both clocks; no font dependency. */
export function StartClock({ seconds, started, now = Date.now(), timeZone = 'Asia/Shanghai' }: { seconds: number; started: boolean; now?: number; timeZone?: string }) {
  const text = started ? '00' : seconds >= 60 ? `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}` : String(seconds).padStart(2, '0')
  const time = new Intl.DateTimeFormat('en-GB', { timeZone, hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).format(now)
  const label = `当地时间 ${time}；${started ? '赛程时间已到' : `倒计时 ${seconds} 秒`}`
  // Reserve mm:ss even when only seconds remain, so neither clock changes size.
  const end = width('00:00:00') + 32 + width('00:00')
  return <div className="rally-inline" role="img" aria-label={label} title={timeZone}>
    <svg viewBox={`0 0 ${end} 38`} aria-hidden="true"><g className="rally-local-digits"><Code text={time} x={0} /></g><Code text={text} x={end - width(text)} /></svg>
  </div>
}
