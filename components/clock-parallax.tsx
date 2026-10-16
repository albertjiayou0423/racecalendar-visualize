"use client"

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { subscribeDeviceTilt } from '@/lib/device-tilt'

function paint(node: HTMLElement, tilt: { x: number; y: number }) {
  node.style.setProperty('--tilt-x', `${tilt.x.toFixed(4)}deg`)
  node.style.setProperty('--tilt-y', `${tilt.y.toFixed(4)}deg`)
  node.style.setProperty('--glare-x', `${50 + tilt.y * 2}%`)
  node.style.setProperty('--glare-y', `${35 - tilt.x * 2}%`)
}

export function ClockParallax({ children, previewTilt }: { children: ReactNode; previewTilt?: { x: number; y: number } }) {
  const object = useRef<HTMLDivElement>(null)
  const [active, setActive] = useState(false)
  const [reduced, setReduced] = useState(true)
  const previewing = !!previewTilt
  useEffect(() => {
    const coarse = matchMedia('(pointer: coarse)')
    const motion = matchMedia('(prefers-reduced-motion: reduce)')
    const update = () => {
      setReduced(motion.matches)
      setActive(coarse.matches && !motion.matches && window.isSecureContext && 'DeviceOrientationEvent' in window)
    }
    update()
    coarse.addEventListener('change', update)
    motion.addEventListener('change', update)
    return () => { coarse.removeEventListener('change', update); motion.removeEventListener('change', update) }
  }, [])
  useEffect(() => {
    const node = object.current
    if (!node || !active || previewing) return
    const unsubscribe = subscribeDeviceTilt(tilt => paint(node, tilt))
    return () => { unsubscribe(); paint(node, { x: 0, y: 0 }) }
  }, [active, previewing])
  useEffect(() => {
    if (!object.current) return
    if (previewTilt && !reduced) paint(object.current, previewTilt)
    else if (!active) paint(object.current, { x: 0, y: 0 })
  }, [previewTilt?.x, previewTilt?.y, reduced, active])
  return <div className="rally-parallax"><div ref={object} className="rally-parallax-object" data-tilt-live={active && !previewing || undefined}>{children}</div></div>
}
