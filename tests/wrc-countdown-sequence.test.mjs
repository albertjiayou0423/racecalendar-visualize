import test from 'node:test'
import assert from 'node:assert/strict'
import { nextWrcCountdown } from '../lib/wrc-countdown-sequence.ts'

const session = (name, second, extra = {}) => ({ name, utc: new Date(second * 1000).toISOString(), ...extra })
const first = session('SS1', 10)
const rally = sessions => ({ series: 'WRC', sessions })

test('advance to the earliest future stage even when the schedule is out of order', () => {
  const second = session('SS2', 30)
  const third = session('SS3', 50)
  const event = rally([third, first, second, { ...first, name: 'duplicate' }])
  assert.equal(nextWrcCountdown(event, first, 12_000), second)
  assert.equal(nextWrcCountdown(event, second, 32_000), third)
  assert.equal(nextWrcCountdown(event, first, 35_000), third)
})

test('never count down estimates, unverified uploads, invalid UTC or non-WRC events', () => {
  const valid = session('SS5', 60)
  const event = rally([first, session('SS2', 20, { tentative: true }), session('SS3', 30, { clientUploadedAt: 'pending' }), { name: 'bad', utc: 'invalid' }, valid])
  assert.equal(nextWrcCountdown(event, first, 12_000), valid)
  assert.equal(nextWrcCountdown({ ...event, series: 'F1' }, first, 12_000), undefined)
  assert.equal(nextWrcCountdown(event, { ...first, utc: 'bad' }, 12_000), undefined)
  assert.equal(nextWrcCountdown(event, first, NaN), undefined)
})

test('last stage, all-past stages and tentative event defaults never wrap back', () => {
  const second = session('SS2', 30)
  assert.equal(nextWrcCountdown(rally([first, second]), second, 31_000), undefined)
  assert.equal(nextWrcCountdown(rally([first, second]), first, 30_000), undefined)
  assert.equal(nextWrcCountdown({ ...rally([second]), tentative: true }, first, 12_000), undefined)
  const confirmed = { ...second, tentative: false }
  assert.equal(nextWrcCountdown({ ...rally([confirmed]), tentative: true }, first, 12_000), confirmed)
})
