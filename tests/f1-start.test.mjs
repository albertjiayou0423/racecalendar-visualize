import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseF1StartState } from '../lib/f1-start-state.ts'
const target = Date.parse('2026-10-14T12:00:00Z')
const now = target + 60000
const snapshot = (messages = []) => ({ SessionInfo: { Name: 'Race', StartDate: '2026-10-14T20:00:00', GmtOffset: '08:00:00' }, SessionStatus: { Status: 'Inactive' }, RaceControlMessages: { Messages: messages } })
test('match the race in local offset and reject old or other session snapshots', () => {
  const current = snapshot([{ Message: 'FORMATION LAP', Utc: '2026-10-14T12:00:00' }])
  assert.equal(parseF1StartState(current, target, now).phase, 'formation')
  assert.equal(parseF1StartState({ ...current, SessionInfo: { ...current.SessionInfo, StartDate: '2026-10-11T20:00:00' } }, target, now).phase, 'unknown')
  assert.equal(parseF1StartState({ ...current, SessionInfo: { ...current.SessionInfo, Name: 'Practice 1' } }, target, now).phase, 'unknown')
  assert.equal(parseF1StartState({ ...current, SessionInfo: { ...current.SessionInfo, StartDate: '2026-10-14T07:00:00', GmtOffset: '-05:00:00' } }, target, now).phase, 'formation')
})
test('generic green flag and practice start incidents cannot trigger a race start', () => {
  assert.equal(parseF1StartState(snapshot([{ Message: 'GREEN FLAG', Utc: '2026-10-14T12:00:00' }, { Message: 'PRACTICE START INFRINGEMENT', Utc: '2026-10-14T12:00:10' }]), target, now).phase, 'unknown')
  assert.equal(parseF1StartState(snapshot([{ Message: 'RACE START', Utc: '2026-10-14T12:03:00' }]), target, now).phase, 'unknown')
})
test('latest explicit signal wins, finished and delayed states suppress normal start lamps', () => {
  const state = snapshot([{ Message: 'FORMATION LAP', Utc: '2026-10-14T12:00:00' }, { Message: 'RACE START', Utc: '2026-10-14T12:00:30' }])
  assert.equal(parseF1StartState(state, target, now).phase, 'racing')
  state.RaceControlMessages.Messages.push({ Message: 'START ABORTED', Utc: '2026-10-14T12:00:40' })
  assert.equal(parseF1StartState(state, target, now).phase, 'delayed')
  assert.equal(parseF1StartState({ ...state, SessionStatus: { Status: 'Ends' } }, target, now).phase, 'finished')
})
