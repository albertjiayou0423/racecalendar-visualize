import WebSocket from 'ws'
import { parseF1StartState, type F1StartState } from './f1-start-state'

const BASE = 'https://livetiming.formula1.com/signalrcore'
const TOPICS = ['SessionInfo', 'SessionStatus', 'RaceControlMessages', 'LapCount']
let cached: { target: number; until: number; value: F1StartState } | undefined
let pending: { target: number; promise: Promise<F1StartState> } | undefined

export async function readF1StartFeed(target: number): Promise<F1StartState> {
  if (cached?.target === target && cached.until > Date.now()) return cached.value
  if (pending?.target === target) return pending.promise
  const promise = sample(target).catch(() => ({ phase: 'unknown' as const, observedAt: new Date().toISOString(), reason: 'feed-unavailable' }))
  pending = { target, promise }
  try {
    const value = await promise
    cached = { target, until: Date.now() + 8000, value }
    return value
  } finally { if (pending?.promise === promise) pending = undefined }
}

async function sample(target: number): Promise<F1StartState> {
  const deadline = Date.now() + 7000
  const signal = AbortSignal.timeout(7000)
  const headers: Record<string, string> = { 'User-Agent': 'BestHTTP' }
  const first = await fetch(BASE + '/negotiate', { method: 'OPTIONS', headers, signal, cache: 'no-store' })
  const cookie = first.headers.getSetCookie().map(c => c.split(';')[0]).join('; ')
  if (cookie) headers.Cookie = cookie
  const response = await fetch(BASE + '/negotiate?negotiateVersion=1', { method: 'POST', headers, signal, cache: 'no-store' })
  if (!response.ok) throw new Error('negotiate-failed')
  const body = await response.json()
  if (typeof body.connectionToken !== 'string') throw new Error('missing-connection')
  const timeout = deadline - Date.now()
  if (timeout <= 0) throw new Error('deadline')
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(BASE.replace('https:', 'wss:') + '?id=' + encodeURIComponent(body.connectionToken), { headers, handshakeTimeout: timeout, maxPayload: 512 * 1024 })
    let settled = false
    let subscribed = false
    const finish = (state?: F1StartState) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      socket.terminate()
      if (state) resolve(state)
      else reject(new Error('feed-unavailable'))
    }
    const timer = setTimeout(() => finish(), timeout)
    socket.on('open', () => socket.send('{"protocol":"json","version":1}\x1e'))
    socket.on('message', raw => {
      for (const part of raw.toString().split('\x1e').filter(Boolean)) {
        let message
        try { message = JSON.parse(part) } catch { continue }
        if (message.error || message.type === 7) { finish(); return }
        if (!subscribed && message.type === undefined) {
          subscribed = true
          socket.send(JSON.stringify({ type: 1, invocationId: '1', target: 'Subscribe', arguments: [TOPICS] }) + '\x1e')
        }
        if (message.type === 3 && message.invocationId === '1') {
          finish(parseF1StartState(message.result ?? {}, target, Date.now()))
          return
        }
      }
    })
    socket.on('error', () => finish())
    socket.on('close', () => finish())
  })
}
