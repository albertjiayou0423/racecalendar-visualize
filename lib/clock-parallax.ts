const clamp = (value: number, limit: number) => Math.max(-limit, Math.min(limit, value))

/** Screen-relative tilt, calibrated to the user's initial holding position. */
export function clockTilt(beta: number, gamma: number, baseBeta: number, baseGamma: number, screenAngle = 0) {
  if (![beta, gamma, baseBeta, baseGamma, screenAngle].every(Number.isFinite)) return { x: 0, y: 0 }
  const angle = screenAngle * Math.PI / 180
  const vertical = ((beta - baseBeta + 540) % 360) - 180
  const horizontal = gamma - baseGamma
  return {
    x: clamp(-(vertical * Math.cos(angle) - horizontal * Math.sin(angle)) * .22, 5),
    y: clamp((horizontal * Math.cos(angle) + vertical * Math.sin(angle)) * .22, 6),
  }
}
