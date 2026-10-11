type RaceResults = { season: string; round: string; Results: { position: string }[] }

/** Jolpica paginates result rows, so a race can be split across pages. */
export async function fetchJolpicaResults<T extends RaceResults>(season: string, fetcher: typeof fetch = fetch): Promise<T[]> {
  const races = new Map<string, T>()
  let offset = 0
  for (let page = 0; page < 100; page++) {
    const response = await fetcher(`https://api.jolpi.ca/ergast/f1/${season}/results.json?limit=100&offset=${offset}`, {
      next: { revalidate: 3600 }, signal: AbortSignal.timeout(10000),
    } as RequestInit)
    if (!response.ok) throw new Error(`Jolpica HTTP ${response.status}`)
    const data = (await response.json()).MRData
    const total = Number(data?.total)
    const returnedOffset = Number(data?.offset)
    const batch = data?.RaceTable?.Races
    if (!Number.isSafeInteger(total) || total < 0 || returnedOffset !== offset || !Array.isArray(batch)) {
      throw new Error("Jolpica 分页响应无效")
    }
    let count = 0
    for (const race of batch as T[]) {
      if (!Array.isArray(race.Results)) throw new Error("Jolpica 赛果响应无效")
      count += race.Results.length
      const key = `${race.season}-${race.round}`
      const previous = races.get(key)
      const results = new Map((previous?.Results ?? []).map(result => [result.position, result]))
      for (const result of race.Results) results.set(result.position, result)
      races.set(key, { ...race, Results: [...results.values()].sort((a, b) => Number(a.position) - Number(b.position)) })
    }
    offset += count
    if (offset >= total) return [...races.values()].sort((a, b) => Number(a.round) - Number(b.round))
    if (count === 0) throw new Error("Jolpica 分页提前结束")
  }
  throw new Error("Jolpica 分页超出限制")
}
