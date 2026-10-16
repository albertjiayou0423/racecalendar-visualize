"use client"

import { useId } from 'react'
import { ClockParallax } from './clock-parallax'
/** Based on photographed fixtures: F1 five four-lamp columns, FE a two-row panel. */
export function StartLights({ series, lit, green, delayed, previewTilt }: { series: 'F1' | 'FE'; lit: number; green: boolean; delayed: boolean; previewTilt?: { x: number; y: number } }) {
  const patternId = useId().replaceAll(':', '')
  const width = 420
  const rows = series === 'F1' ? 4 : 2
  return <ClockParallax previewTilt={previewTilt}><div className={`start-signal ${series === 'FE' ? 'fe-signal' : ''}`}>
    <div className="signal-depth" aria-hidden="true">{Array.from({ length: series === 'F1' ? 5 : 1 }, (_, column) => <div key={column} className="signal-case" style={series === 'F1' ? { left: `${(column * 82 + 10) / 420 * 100}%`, top: `${13 / 238 * 100}%`, width: `${70 / 420 * 100}%`, height: `${220 / 238 * 100}%` } : { left: `${6 / 420 * 100}%`, top: '10%', width: `${408 / 420 * 100}%`, height: `${110 / 130 * 100}%` }}>
      <span className="signal-case-back" /><span className="signal-case-left" /><span className="signal-case-right" /><span className="signal-case-top" /><span className="signal-case-bottom" />
    </div>)}</div>
    <svg className="signal-body" viewBox={`0 0 ${width} ${rows * 54 + 22}`} aria-hidden="true">
      <path d="M0 8H420" stroke="#34373b" strokeWidth="4" />
      {series === 'FE' && <rect x="6" y="13" width="408" height="110" rx="3" fill="#101215" stroke="#36393d" />}
      {Array.from({ length: 5 }, (_, column) => <g key={column}>
        {series === 'F1' && <rect x={column * 82 + 10} y="13" width="70" height="220" rx="2" fill="#101215" stroke="#36393d" />}
        {Array.from({ length: rows }, (_, row) => <circle key={row} cx={column * 82 + 45} cy={row * 54 + 42} r="22" fill="#0b0d0f" stroke="#34373b" strokeWidth="1.5" />)}
      </g>)}
    </svg>
    <svg className="signal-lenses" viewBox={`0 0 ${width} ${rows * 54 + 22}`} aria-hidden="true">
      <defs>{Object.entries({ green: '#4deb77', red: '#ff3541', amber: '#ffbb42', off: '#45494b' }).map(([name, color]) => <pattern key={name} id={`${patternId}-${name}`} width="4" height="4" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r="1" fill={color} /></pattern>)}</defs>
      {Array.from({ length: 5 }, (_, column) => <g key={column}>
        {Array.from({ length: rows }, (_, row) => {
          const isGreen = green && row === (series === 'F1' ? 1 : 0)
          const isRed = column < lit && row >= (series === 'F1' ? 2 : 1)
          const isAmber = delayed && row === 0
          const color = isGreen ? '#4deb77' : isRed ? '#ff3541' : isAmber ? '#ffbb42' : '#45494b'
          return <g key={row} style={{ color }} className={isGreen ? 'signal-green' : isRed ? 'signal-red' : isAmber ? 'signal-amber' : ''}>
            <circle cx={column * 82 + 45} cy={row * 54 + 42} r="19" fill={`url(#${patternId}-${isGreen ? 'green' : isRed ? 'red' : isAmber ? 'amber' : 'off'})`} />
          </g>
        })}
      </g>)}
    </svg>
  </div></ClockParallax>
}
