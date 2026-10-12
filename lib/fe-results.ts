const FE_SITE = "https://www.fiaformulae.com"
export type FeDriver = { code: string; name: string; team: string; country: string; countryCode: string; photoUrl: string; points: number; position: number }
export type FeRace = { id: string; name: string; sequence: number; date: string; city: string; country: string }
export type FeResult = { position: string; driver: string; driverCode: string; team: string; points: number }

function text(html: string) {
  return html.replace(/<svg\b[\s\S]*?<\/svg>/gi, "").replace(/<[^>]+>/g, " ")
    .replace(/&#(?:x([0-9a-f]+)|(\d+));/gi, (_, hex, decimal) => String.fromCodePoint(Number.parseInt(hex || decimal, hex ? 16 : 10)))
    .replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim()
}
function field(row: string, name: string) {
  return row.match(new RegExp(`<span[^>]*class="[^"]*__${name}__[^"]*"[^>]*>([\\s\\S]*?)<\\/span>`))?.[1] ?? ""
}
function rows(html: string, testId: string) {
  return [...html.matchAll(new RegExp(`<tr\\b[^>]*data-testid="${testId}"[^>]*>[\\s\\S]*?<\\/tr>`, "g"))].map(match => match[0])
}
export function parseFeStandings(html: string): FeDriver[] {
  const drivers = rows(html, "standings-row-driver").map(row => {
    const nameHtml = field(row, "nameLabel")
    const slug = nameHtml.match(/href="\/en\/drivers\/([^"?]+)"/)?.[1]
    const position = Number(text(row.match(/<th\b[^>]*>([\s\S]*?)<\/th>/)?.[1] ?? ""))
    const points = Number(text(row.match(/<td[^>]*class="[^"]*__points__[^"]*"[^>]*>([\s\S]*?)<\/td>/)?.[1] ?? "NaN"))
    const name = text(nameHtml)
    if (!slug || !name || !Number.isFinite(points) || !Number.isInteger(position) || position < 1) throw new Error("FE 积分榜结构发生变化")
    return { code: slug, name, team: text(field(row, "teamLabel")), country: "", countryCode: "", photoUrl: "", points, position }
  })
  if (!drivers.length) throw new Error("FE 官网未返回积分榜")
  return drivers
}
export function parseFeRaceResults(html: string): FeResult[] {
  return rows(html, "results-row-result").map(row => {
    const position = text(row.match(/<td\b[^>]*>([\s\S]*?)<\/td>/)?.[1] ?? "").match(/^(?:\d+|—|DNF|DNS|DSQ|NC)/)?.[0] ?? ""
    const nameHtml = field(row, "nameLabel")
    const driver = text(nameHtml)
    const driverCode = nameHtml.match(/href="\/en\/drivers\/([^"?]+)"/)?.[1] ?? ""
    const pointsHtml = row.match(/<td[^>]*class="[^"]*__value--points__[^"]*"[^>]*>([\s\S]*?)<\/td>/)?.[1]
    const points = Number(text(pointsHtml ?? "NaN"))
    if (!position || !driver || !driverCode || !Number.isFinite(points)) throw new Error("FE 赛果结构发生变化")
    return { position, driver, driverCode, team: text(field(row, "teamLabel")), points }
  })
}
export function parseFeRounds(html: string): { rounds: FeRace[]; selectedRound: string } {
  // Parse JSON data only; never execute the website's scripts.
  let stream = ""
  for (const match of html.matchAll(/self\.__next_f\.push\((.+?)\)<\/script>/g)) {
    try { const chunk = JSON.parse(match[1]); if (chunk[0] === 1 && typeof chunk[1] === "string") stream += chunk[1] } catch { /* Other script blocks. */ }
  }
  let catalog: { rounds: { key: string; roundNum: number; raceDate: string; location: string; countryCode: string }[]; selectedRound: string } | undefined
  function visit(value: unknown) {
    if (!value || typeof value !== "object") return
    const object = value as Record<string, unknown>
    if (Array.isArray(object.rounds) && object.rounds.length && typeof object.rounds[0]?.key === "string" && "selectedRound" in object) catalog = object as unknown as typeof catalog
    for (const item of Object.values(object)) visit(item)
  }
  for (const line of stream.split("\n")) { try { visit(JSON.parse(line.slice(line.indexOf(":") + 1))) } catch { /* RSC non-JSON frames. */ } }
  if (!catalog) throw new Error("FE 官网未返回赛季赛历")
  const found = catalog as NonNullable<typeof catalog>
  const rounds = found.rounds.map(round => {
    if (!/^\d+-[a-z0-9-]+$/.test(round.key) || !/^\d{4}-\d{2}-\d{2}$/.test(round.raceDate) || !Number.isInteger(round.roundNum)) throw new Error("FE 赛历结构发生变化")
    return { id: round.key, name: `${round.location} E-Prix`, sequence: round.roundNum, date: round.raceDate, city: round.location, country: round.countryCode }
  })
  return { rounds, selectedRound: found.selectedRound }
}
export function parseFeSeason(html: string): number {
  let stream = ""
  for (const match of html.matchAll(/self\.__next_f\.push\((.+?)\)<\/script>/g)) {
    try { const chunk = JSON.parse(match[1]); if (chunk[0] === 1 && typeof chunk[1] === "string") stream += chunk[1] } catch { /* Non-JSON script. */ }
  }
  let season: number | undefined
  function visit(value: unknown) {
    if (!value || typeof value !== "object") return
    const object = value as Record<string, unknown>
    if (object.active === true && typeof object.text === "string" && /^Season \d+$/.test(object.text)) {
      const number = Number(object.text.slice(7))
      if (String(object.id) === String(number)) season = number
    }
    for (const item of Object.values(object)) visit(item)
  }
  for (const line of stream.split("\n")) { try { visit(JSON.parse(line.slice(line.indexOf(":") + 1))) } catch { /* RSC non-JSON frames. */ } }
  if (!season) throw new Error("FE 官网未返回选中赛季")
  return season
}
async function page(query: string, season?: number) {
  const response = await fetch(`${FE_SITE}/en/results-and-standings${query}`, {
    next: { revalidate: 3600 }, signal: AbortSignal.timeout(10000),
  } as RequestInit)
  if (!response.ok) throw new Error(`FE HTTP ${response.status}`)
  const html = await response.text()
  // Official SEO titles can remain on the default season for historical queries.
  if (html.length > 5_000_000 || (season && parseFeSeason(html) !== season)) throw new Error("FE 返回的赛季不匹配")
  return html
}
export async function fetchFeStandings(season?: number) {
  const query = season ? `?season=${season}&tab=drivers` : "?tab=drivers"
  return parseFeStandings(await page(query, season))
}
export async function fetchFeResults(year: number, raceId?: string) {
  const season = year - 2014 // Season 1 finished in 2015; season 12 in 2026.
  const html = await page(`?season=${season}`, season)
  const { rounds, selectedRound } = parseFeRounds(html)
  const target = raceId ? rounds.find(round => round.id === raceId) : rounds.find(round => round.id === selectedRound)
  if (raceId && !target) throw new Error("未找到该 FE 赛事")
  const results: Record<string, FeResult[]> = {}
  if (target && target.date <= new Date().toISOString().slice(0, 10)) {
    const raceHtml = target.id === selectedRound ? html : await page(`?season=${season}&round=${encodeURIComponent(target.id)}`, season)
    if (parseFeRounds(raceHtml).selectedRound !== target.id) throw new Error("FE 返回的赛事不匹配")
    const parsed = parseFeRaceResults(raceHtml)
    if (!parsed.length) throw new Error("FE 该站赛果暂不可用")
    results[target.id] = parsed
  }
  return { races: rounds, results }
}
