interface CountdownState { targetMs: number; series: string; started: boolean }

/** A new target or series is a reset, never a start signal. */
export function didCountdownStart(previous: CountdownState, current: CountdownState) {
  return Number.isFinite(current.targetMs) && previous.targetMs === current.targetMs && previous.series === current.series && !previous.started && current.started
}
