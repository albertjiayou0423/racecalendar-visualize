/** Bounded requests for WebViews without AbortSignal.timeout/any. */
export function browserTimeoutSignal(ms: number, parent?: AbortSignal): AbortSignal {
  const controller = new AbortController()
  const abort = () => controller.abort(parent?.reason)
  const timer = setTimeout(() => controller.abort(new DOMException("Request timed out", "TimeoutError")), ms)
  controller.signal.addEventListener("abort", () => {
    clearTimeout(timer)
    parent?.removeEventListener("abort", abort)
  }, { once: true })
  if (parent?.aborted) abort()
  else parent?.addEventListener("abort", abort, { once: true })
  return controller.signal
}
