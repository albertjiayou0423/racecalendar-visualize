// Eight-segment LED: seven numeral bars plus the decimal point.
const SEGMENTS = {
  a: '4,0 18,0 21,3 18,6 4,6 1,3',
  b: '20,4 23,7 23,18 20,21 17,18 17,7',
  c: '20,23 23,26 23,37 20,40 17,37 17,26',
  d: '4,38 18,38 21,41 18,44 4,44 1,41',
  e: '0,26 3,23 6,26 6,37 3,40 0,37',
  f: '0,7 3,4 6,7 6,18 3,21 0,18',
  g: '4,19 18,19 21,22 18,25 4,25 1,22',
}
const NUMERALS = ['abcdef', 'bc', 'abdeg', 'abcdg', 'bcfg', 'acdfg', 'acdefg', 'abc', 'abcdefg', 'abcdfg']
const width = (text: string) => [...text].reduce((sum, char) => sum + (char === ':' ? 12 : 34), 0)

function Code({ text, x }: { text: string; x: number }) {
  let cursor = x
  return <>{[...text].map((char, index) => {
    const offset = cursor
    cursor += char === ':' ? 12 : 34
    return <g key={index} transform={`translate(${offset} 0)`}>{char === ':'
      ? <><rect x="1" y="12" width="4" height="4" /><rect x="1" y="28" width="4" height="4" /></>
      : <>{Object.entries(SEGMENTS).map(([name, points]) => <polygon key={name} points={points} fill={NUMERALS[Number(char)].includes(name) ? 'currentColor' : '#240d0e'} />)}<rect x="26" y="40" width="4" height="4" fill="#240d0e" /></>}
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
    <svg viewBox={`0 0 ${end} 44`} aria-hidden="true"><Code text={time} x={0} /><Code text={text} x={end - width(text)} /></svg>
  </div>
}