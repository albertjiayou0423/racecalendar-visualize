"use client"

import { clockTilt, smoothClockTilt } from './clock-parallax'

type Tilt = { x: number; y: number }
type OrientationAPI = typeof DeviceOrientationEvent & { requestPermission?: () => Promise<'granted' | 'denied'> }
const listeners = new Set<(tilt: Tilt) => void>()
let permission: 'unknown' | 'pending' | 'granted' | 'denied' = 'unknown'
let current: Tilt = { x: 0, y: 0 }
let target: Tilt = { x: 0, y: 0 }
let baseline: { beta: number; gamma: number } | undefined
let frame = 0
let previousFrame = 0
let running = false
function emit() { for (const listener of listeners) listener(current) }
function animate(now: number) {
  frame = 0
  current = smoothClockTilt(current, target, previousFrame ? now - previousFrame : 16.67)
  previousFrame = now
  emit()
  if (Math.abs(current.x - target.x) > .005 || Math.abs(current.y - target.y) > .005) frame = requestAnimationFrame(animate)
  else previousFrame = 0
}
function receive(event: DeviceOrientationEvent) {
  if (event.beta === null || event.gamma === null || !Number.isFinite(event.beta) || !Number.isFinite(event.gamma)) return
  baseline ??= { beta: event.beta, gamma: event.gamma }
  const next = clockTilt(event.beta, event.gamma, baseline.beta, baseline.gamma, window.screen.orientation?.angle ?? window.orientation ?? 0)
  if (Math.abs(next.x - target.x) < .04 && Math.abs(next.y - target.y) < .04) return
  target = next
  if (!frame) frame = requestAnimationFrame(animate)
}
function recalibrate() {
  baseline = undefined
  target = { x: 0, y: 0 }
  if (!frame) frame = requestAnimationFrame(animate)
}
function stop() {
  window.removeEventListener('deviceorientation', receive)
  window.removeEventListener('orientationchange', recalibrate)
  cancelAnimationFrame(frame)
  frame = previousFrame = 0
  baseline = undefined
  current = target = { x: 0, y: 0 }
  running = false
  emit()
}
function start() {
  if (running || !listeners.size || document.hidden || permission !== 'granted') return
  running = true
  window.addEventListener('deviceorientation', receive, { passive: true })
  window.addEventListener('orientationchange', recalibrate)
}
function visibility() { if (document.hidden) stop(); else start() }
function removeGesture() { document.removeEventListener('pointerup', requestAccess) }
function requestAccess() {
  removeGesture()
  if (permission !== 'unknown') return
  const api = window.DeviceOrientationEvent as OrientationAPI
  if (!api.requestPermission) { permission = 'granted'; start(); return }
  permission = 'pending'
  try {
    api.requestPermission().then(result => { permission = result; start() }).catch(() => { permission = 'denied' })
  } catch { permission = 'denied' }
}
/** One sensor listener and animation loop shared by every clock/light fixture. */
export function subscribeDeviceTilt(listener: (tilt: Tilt) => void) {
  listeners.add(listener)
  listener(current)
  if (listeners.size === 1) {
    document.addEventListener('visibilitychange', visibility)
    const api = window.DeviceOrientationEvent as OrientationAPI
    if (!api.requestPermission && permission === 'unknown') permission = 'granted'
    if (permission === 'unknown') document.addEventListener('pointerup', requestAccess)
    else start()
  }
  return () => {
    listeners.delete(listener)
    if (!listeners.size) {
      removeGesture()
      document.removeEventListener('visibilitychange', visibility)
      stop()
    }
  }
}
