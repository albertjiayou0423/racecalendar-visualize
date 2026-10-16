"use client"

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { clockTilt } from '@/lib/clock-parallax'

type OrientationAPI = typeof DeviceOrientationEvent & { requestPermission?: () => Promise<'granted' | 'denied'> }

export function ClockParallax({ children, previewTilt }: { children: ReactNode; previewTilt?: { x: number; y: number } }) {
  const object = useRef<HTMLDivElement>(null)
  const [available, setAvailable] = useState(false)
  const [enabled, setEnabled] = useState(false)
  const [reduced, setReduced] = useState(true)
  const [visible, setVisible] = useState(true)
  const [message, setMessage] = useState('')
  useEffect(() => {
    const coarse = matchMedia('(pointer: coarse)')
    const motion = matchMedia('(prefers-reduced-motion: reduce)')
    const update = () => {
      setAvailable(coarse.matches && window.isSecureContext && 'DeviceOrientationEvent' in window)
      setReduced(motion.matches)
      if (motion.matches) setEnabled(false)
    }
    const visibility = () => setVisible(!document.hidden)
    update()
    visibility()
    coarse.addEventListener('change', update)
    motion.addEventListener('change', update)
    document.addEventListener('visibilitychange', visibility)
    return () => {
      coarse.removeEventListener('change', update)
      motion.removeEventListener('change', update)
      document.removeEventListener('visibilitychange', visibility)
    }
  }, [])
  useEffect(() => {
    if (!enabled || reduced || !visible || previewTilt) return
    let baseline: { beta: number; gamma: number } | undefined
    let frame = 0
    let tilt = { x: 0, y: 0 }
    const reset = () => { baseline = undefined }
    const receive = (event: DeviceOrientationEvent) => {
      if (event.beta === null || event.gamma === null || !Number.isFinite(event.beta) || !Number.isFinite(event.gamma)) return
      baseline ??= { beta: event.beta, gamma: event.gamma }
      tilt = clockTilt(event.beta, event.gamma, baseline.beta, baseline.gamma, window.screen.orientation?.angle ?? window.orientation ?? 0)
      if (frame) return
      frame = requestAnimationFrame(() => {
        object.current?.style.setProperty('--tilt-x', `${tilt.x}deg`)
        object.current?.style.setProperty('--tilt-y', `${tilt.y}deg`)
        frame = 0
      })
    }
    window.addEventListener('deviceorientation', receive)
    window.addEventListener('orientationchange', reset)
    return () => {
      window.removeEventListener('deviceorientation', receive)
      window.removeEventListener('orientationchange', reset)
      cancelAnimationFrame(frame)
      object.current?.style.removeProperty('--tilt-x')
      object.current?.style.removeProperty('--tilt-y')
    }
  }, [enabled, reduced, visible, previewTilt])
  async function toggle() {
    if (enabled) { setEnabled(false); return }
    setMessage('')
    try {
      const api = window.DeviceOrientationEvent as OrientationAPI
      if (api.requestPermission && await api.requestPermission() !== 'granted') {
        setMessage('未获得动作权限，仍可正常计时')
        return
      }
      setEnabled(true)
    } catch { setMessage('此浏览器暂时无法启用立体效果') }
  }
  const style = previewTilt && !reduced ? { '--tilt-x': `${previewTilt.x}deg`, '--tilt-y': `${previewTilt.y}deg` } as CSSProperties : undefined
  return <div className="rally-parallax">
    <div ref={object} className="rally-parallax-object" style={style}>{children}</div>
    {available && !reduced && !previewTilt && <button type="button" className="rally-depth-control" aria-pressed={enabled} onClick={toggle}>{enabled ? '关闭立体效果' : '开启立体效果'}</button>}
    {message && <p role="status" className="rally-depth-message">{message}</p>}
  </div>
}
