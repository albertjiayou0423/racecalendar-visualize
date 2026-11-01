const clamp = (value: number, limit: number) => Math.max(-limit, Math.min(limit, value))

/** Screen-relative CSS rotation, calibrated to the initial pose and facing the viewer. */
export function clockTilt(beta: number, gamma: number, baseBeta: number, baseGamma: number, screenAngle = 0) {
  if (![beta, gamma, baseBeta, baseGamma, screenAngle].every(Number.isFinite)) return { x: 0, y: 0 }
  const angle = screenAngle * Math.PI / 180
  const vertical = ((beta - baseBeta + 540) % 360) - 180
  const horizontal = gamma - baseGamma
  return {
    // The display counter-rotates against the device to reveal its depth.
    // Convert screen-relative sensor axes to the viewer-facing CSS plane once.
    x: clamp((vertical * Math.cos(angle) - horizontal * Math.sin(angle)) * .32, 5),
    y: clamp(-(horizontal * Math.cos(angle) + vertical * Math.sin(angle)) * .32, 6),
  }
}

/** Frame-rate independent damping, with a small dead zone for sensor noise. */
export function smoothClockTilt(current: { x: number; y: number }, target: { x: number; y: number }, elapsedMs: number) {
  const weight = 1 - Math.exp(-Math.max(0, Math.min(50, elapsedMs)) / 100)
  const axis = (value: number, goal: number) => Math.abs(goal - value) < .025 ? goal : value + (goal - value) * weight
  return { x: axis(current.x, clamp(target.x, 5)), y: axis(current.y, clamp(target.y, 6)) }
}
