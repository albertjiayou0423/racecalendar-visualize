import { NextRequest, NextResponse } from "next/server"

const API_BASE = "https://p-p.redbull.com/rb-wrccom-lintegration-yv-prod/api"
const CACHE_SECONDS = 3600

type Season = { seasonId: number; name: string; year: number }
type Championship = {
  championshipId: number
  seasonId: number
  name: string
  type: string
  fieldOneDescription?: string
  fieldTwoDescription?: string
  fieldThreeDescription?: string
  fieldFourDescription?: string
  fieldFiveDescription?: string
  championshipEntries?: ChampionshipEntry[]
}
type ChampionshipEntry = {
  championshipEntryId: number
  fieldOne?: string | null
  fieldTwo?: string | null
  fieldThree?: string | null
  fieldFour?: string | null
  fieldFive?: string | null
  driverProfileUrl?: string | null
}
type EntryResult = {
  championshipEntryId: number
  overallPosition: number | string
  overallPoints: number | string
  roundResults?: Array<{ eventId: number; totalPoints: number | string; position: string }>
}

async function getJson<T>(path: string): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    next: { revalidate: CACHE_SECONDS },
    headers: { Accept: "application/json" },
  })
  if (!response.ok) throw new Error(`WRC API returned ${response.status}`)
  return response.json() as Promise<T>
}

export async function GET(request: NextRequest) {
  try {
    const seasons = (await getJson<Season[]>("/seasons.json"))
      .filter((season) => season.name === "World Rally Championship")
      .sort((a, b) => b.year - a.year)
    const requestedYear = Number(request.nextUrl.searchParams.get("season"))
    const selectedSeason = seasons.find((season) => season.year === requestedYear) ?? seasons[0]
    if (!selectedSeason) throw new Error("No WRC seasons available")

    const seasonDetail = await getJson<{ championships?: Championship[] }>(
      `/season-detail.json?seasonId=${selectedSeason.seasonId}`
    )
    const championships = seasonDetail.championships ?? []
    const requestedChampionshipId = Number(request.nextUrl.searchParams.get("championship"))
    const selectedChampionship = championships.find(
      (championship) => championship.championshipId === requestedChampionshipId
    ) ?? championships.find((championship) => championship.type === "Drivers")

    if (!selectedChampionship) throw new Error("No WRC driver championship available")

    const [championshipDetail, results] = await Promise.all([
      getJson<Championship>(
        `/championship-detail.json?championshipId=${selectedChampionship.championshipId}&seasonId=${selectedSeason.seasonId}`
      ),
      getJson<{ entryResults?: EntryResult[] }>(
        `/championship-overall-results.json?championshipId=${selectedChampionship.championshipId}&seasonId=${selectedSeason.seasonId}`
      ),
    ])

    const entries = new Map(
      (championshipDetail.championshipEntries ?? []).map((entry) => [entry.championshipEntryId, entry])
    )
    const standings = (results.entryResults ?? []).map((result) => {
      const entry = entries.get(result.championshipEntryId)
      return {
        id: result.championshipEntryId,
        position: result.overallPosition,
        points: result.overallPoints,
        name: selectedChampionship.type === "Manufacturer"
          ? entry?.fieldOne ?? ""
          : [entry?.fieldOne, entry?.fieldTwo].filter(Boolean).join(" "),
        countryCode: selectedChampionship.type === "Manufacturer" ? "" : entry?.fieldThree ?? "",
        team: selectedChampionship.type === "Manufacturer"
          ? entry?.fieldTwo ?? ""
          : entry?.fieldFive || entry?.fieldFour || "",
        profileUrl: entry?.driverProfileUrl ?? null,
        rounds: result.roundResults ?? [],
      }
    })

    return NextResponse.json({
      ok: true,
      season: selectedSeason,
      seasons,
      championship: {
        championshipId: selectedChampionship.championshipId,
        name: selectedChampionship.name,
        type: selectedChampionship.type,
      },
      championships: championships.map(({ championshipId, name, type }) => ({ championshipId, name, type })),
      standings,
    }, { headers: { "Cache-Control": `public, s-maxage=${CACHE_SECONDS}, stale-while-revalidate=86400` } })
  } catch (error) {
    console.error("Failed to fetch official WRC standings:", error)
    return NextResponse.json(
      { ok: false, note: "WRC 官方积分榜暂时无法加载，请稍后重试。" },
      { status: 502, headers: { "Cache-Control": "no-store" } }
    )
  }
}
