"use client"
import { useEffect, useState } from 'react'
import type { F1StartState } from './f1-start-state'
export function useF1Start(target: string, enabled: boolean) {
  const [state, setState] = useState<F1StartState | null>(null)
  useEffect(() => {
    setState(null)
    if (!enabled) return
    let stopped = false
    let timer: ReturnType<typeof setTimeout>
    let controller: AbortController | undefined
    const poll = async () => {
      if (stopped) return
      if (document.visibilityState === 'visible') {
        controller = new AbortController()
        const deadline = setTimeout(() => controller?.abort(), 10000)
        try {
          const response = await fetch('/api/f1-start?target=' + encodeURIComponent(target), { signal: controller.signal })
          if (!response.ok) throw new Error('unavailable')
          const value = await response.json()
          if (!['unknown', 'formation', 'delayed', 'racing', 'finished'].includes(value.phase) || !Number.isFinite(Date.parse(value.observedAt))) throw new Error('invalid-state')
          if (!stopped) setState(current => current && ['racing', 'finished', 'delayed'].includes(current.phase) && value.phase === 'unknown' ? current : value)
        } catch { /* Preserve the last signal on transport failure; callers check its age. */ }
        finally { clearTimeout(deadline) }
      }
      if (!stopped) timer = setTimeout(poll, 10000)
    }
    void poll()
    return () => { stopped = true; clearTimeout(timer); controller?.abort() }
  }, [target, enabled])
  return state
}
