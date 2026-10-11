type Target = { round: number; eventSlug: string; startDate: string; tz: string }

/** Keep every local round; override only an unambiguous same-season official target. */
export function mergeWrcTargets<T extends Target>(local: readonly T[], official: readonly Target[]): T[] {
  const candidates = new Map<number, Target[]>()
  for (const target of official) {
    const list = candidates.get(target.round) || []
    list.push(target)
    candidates.set(target.round, list)
  }
  return local.map(base => {
    const list = candidates.get(base.round)
    if (list?.length !== 1) return { ...base }
    const target = list[0]
    const year = base.startDate.slice(0, 4)
    const namedYear = target.eventSlug.match(/-(20\d{2})$/)?.[1]
    if (target.startDate.slice(0, 4) !== year || namedYear && namedYear !== year) return { ...base }
    return { ...base, eventSlug: target.eventSlug, startDate: target.startDate,
      tz: target.tz && target.tz !== "UTC" ? target.tz : base.tz }
  })
}
