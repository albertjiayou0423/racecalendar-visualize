import test from 'node:test'
import assert from 'node:assert/strict'
import { sessionWeatherDate } from '../lib/weather-date.ts'

test('session weather dates tolerate missing and malformed session times', () => {
  assert.equal(sessionWeatherDate('2026-10-13T12:34:56Z'), '2026-10-13')
  assert.equal(sessionWeatherDate(''), null)
  assert.equal(sessionWeatherDate('not-a-date'), null)
})
