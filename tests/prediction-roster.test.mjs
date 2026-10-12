import test from 'node:test'
import assert from 'node:assert/strict'
import {
  LEGACY_DRIVER_LABELS,
  mapFePredictionDrivers,
  mapWrcPredictionDrivers,
  predictionRosterUrl,
} from '../lib/prediction-roster.ts'

test('WRC prediction candidates follow official standings and have unique stable codes', () => {
  const drivers = mapWrcPredictionDrivers([
    { id: 8203, name: 'Elfyn EVANS', team: 'TOYOTA GAZOO RACING WRT' },
    { id: 8204, name: 'Oliver SOLBERG', team: 'TOYOTA GAZOO RACING WRT' },
    { id: 8205, name: 'Yohan ROSSEL', team: 'Citroen Racing' },
    { id: 8206, name: 'Leo ROSSEL', team: 'Citroen Racing' },
    { id: 0, name: 'Invalid driver' },
  ])

  assert.deepEqual(drivers.map(({ code }) => code), ['EVANS', 'SOLBERG', 'ROSSEL', 'ROSSEL-2'])
  assert.equal(drivers[0].team, 'TOYOTA GAZOO RACING WRT')
  assert.equal(drivers.length, 4)
})

test('Formula E candidates use current official drivers while retaining known vote codes', () => {
  const drivers = mapFePredictionDrivers([
    { code: 'mitch-evans', name: 'Mitch Evans', team: 'Jaguar TCS Racing' },
    { code: 'antonio-felix-da-costa', name: 'António Félix da Costa', team: 'Porsche' },
    { code: 'new-driver', name: 'New Driver', team: '' },
    { code: '', name: 'Invalid driver' },
  ])

  assert.deepEqual(drivers.map(({ code }) => code), ['EVANS', 'DA_COSTA', 'FE-NEW-DRIVER'])
  assert.equal(drivers[1].name, 'António Félix da Costa')
  assert.equal(LEGACY_DRIVER_LABELS.FE.JEV, 'Nicolas Prost')
})

test('each series roster request uses the season encoded by its event ID', () => {
  assert.equal(predictionRosterUrl('F1', 'f1-2026-17', 2027), '/api/prediction-drivers?season=2026')
  assert.equal(predictionRosterUrl('WRC', 'wrc-2025-8', 2027), '/api/wrc-standings?season=2025&championship=333')
  assert.equal(predictionRosterUrl('FE', 'fe-12-mexico-city', 2027), '/api/fe-drivers?season=12')
  assert.equal(predictionRosterUrl('FE', 'fe-race-without-season', 2027), '/api/fe-drivers')
})
