"use client"

import { useEffect, useState } from 'react'
import { subscribeDeviceTilt } from '@/lib/device-tilt'

/** Test-page diagnostics only; never sends sensor data to the server. */
export function TiltDiagnostics() {
  const [message, setMessage] = useState('正在检查姿态传感器…')
  useEffect(() => {
    if (!window.isSecureContext || !('DeviceOrientationEvent' in window)) {
      setMessage('当前浏览器无法提供姿态传感器')
      return
    }
    const motion = matchMedia('(prefers-reduced-motion: reduce)')
    let unsubscribe: (() => void) | undefined
    let timer: ReturnType<typeof setTimeout> | undefined
    const update = () => {
      unsubscribe?.(); clearTimeout(timer)
      if (motion.matches) { setMessage('系统已启用减少动态效果，姿态透视暂停'); return }
      unsubscribe = subscribeDeviceTilt(() => {}, status => {
        clearTimeout(timer)
        if (status === 'active') setMessage('姿态传感器已连接 · 默认跟随手机转动；手动透视非零时优先预览，恢复正视即可跟随')
        else if (status === 'denied') setMessage('浏览器未允许姿态传感器，请检查站点的运动传感器权限')
        else {
          setMessage('等待姿态数据，请轻轻转动手机')
          timer = setTimeout(() => setMessage('尚未收到姿态数据：安卓 Chrome 请检查 设置 → 网站设置 → 运动传感器；桌面电脑通常没有传感器'), 5000)
        }
      })
    }
    update(); motion.addEventListener('change', update)
    return () => { unsubscribe?.(); clearTimeout(timer); motion.removeEventListener('change', update) }
  }, [])
  return <p role="status" className="mt-2 text-xs leading-6 text-muted-foreground">{message}</p>
}
