/** Bounded workers preserve input ordering and isolate individual rally failures. */
export async function mapSettledWithConcurrency<T, R>(items: readonly T[], limit: number, worker: (item: T, index: number) => Promise<R>): Promise<PromiseSettledResult<R>[]> {
  if (!Number.isInteger(limit) || limit < 1) throw new RangeError("Concurrency must be a positive integer")
  const results: PromiseSettledResult<R>[] = new Array(items.length)
  let cursor = 0
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor++
      try { results[index] = { status: "fulfilled", value: await worker(items[index], index) } }
      catch (reason) { results[index] = { status: "rejected", reason } }
    }
  }))
  return results
}
