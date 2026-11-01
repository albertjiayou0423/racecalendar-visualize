import type { RaceEvent } from "@/lib/types"
import routeData from "@/public/track-routes/f1-active.json"

type RouteRecord = { name: string; points: [number, number][] }
type RouteCatalog = { sourceRevision: string; records: Record<string, RouteRecord> }

export interface TrackFlightRoute {
  points: [number, number][]
  closed: boolean
  source: "public-reference" | "illustration"
  sourceLabel: string
}

const F1_ROUTE_ALIASES: Array<[string, string[]]> = [
  ["albert_park_circuit", ["albert park", "melbourne"]],
  ["autodromo_hermanos_rodriguez", ["hermanos rodriguez", "mexico city"]],
  ["autodromo_jose_carlos_pace", ["jose carlos pace", "interlagos", "sao paulo"]],
  ["autodromo_nazionale_monza", ["monza"]],
  ["baku_city_circuit", ["baku"]],
  ["circuit_de_barcelona_catalunya", ["barcelona-catalunya", "circuit de catalunya"]],
  ["circuit_de_monaco", ["monaco"]],
  ["circuit_de_spa_francorchamps", ["spa-francorchamps", "spa"]],
  ["circuit_gilles_villeneuve", ["gilles-villeneuve", "montreal"]],
  ["circuit_of_the_americas", ["circuit of the americas", "austin"]],
  ["circuit_zandvoort", ["zandvoort"]],
  ["hungaroring", ["hungaroring"]],
  ["las_vegas_strip_circuit", ["las vegas"]],
  ["lusail_international_circuit", ["lusail", "losail"]],
  ["madring", ["madring", "madrid"]],
  ["marina_bay_street_circuit", ["marina bay", "singapore"]],
  ["miami_international_autodrome", ["miami"]],
  ["red_bull_ring", ["red bull ring", "spielberg"]],
  ["sepang_international_circuit", ["sepang"]],
  ["shanghai_international_circuit", ["shanghai", "上海国际赛车场", "上海"]],
  ["silverstone_circuit", ["silverstone"]],
  ["suzuka_international_racing_course", ["suzuka"]],
  ["yas_marina_circuit", ["yas marina", "abu dhabi"]],
]

function stableSeed(value: string) {
  let seed = 2166136261
  for (let index = 0; index < value.length; index++) {
    seed ^= value.charCodeAt(index)
    seed = Math.imul(seed, 16777619)
  }
  return seed >>> 0
}

function randomFor(seed: number) {
  let state = seed || 1
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0
    return state / 4294967296
  }
}

function illustrationRoute(event: RaceEvent): TrackFlightRoute {
  const random = randomFor(stableSeed(`${event.id}:${event.circuit}:${event.locality}`))
  const nodes = Array.from({ length: event.series === "WRC" ? 11 : 13 }, (_, index) => {
    const angle = event.series === "WRC"
      ? Math.PI * (0.08 + index / 12 * 0.84)
      : Math.PI * 2 * index / 13
    const wobble = (random() - 0.5) * 0.48
    const radius = 0.58 + random() * 0.34
    return [Math.cos(angle + wobble) * radius, Math.sin(angle + wobble) * radius] as [number, number]
  })
  const points: [number, number][] = []
  const segmentCount = event.series === "WRC" ? nodes.length - 1 : nodes.length
  for (let segment = 0; segment < segmentCount; segment++) {
    const p0 = nodes[Math.max(0, segment - 1)]
    const p1 = nodes[segment]
    const p2 = nodes[(segment + 1) % nodes.length]
    const p3 = nodes[Math.min(nodes.length - 1, segment + 2)]
    for (let step = 0; step < 9; step++) {
      const t = step / 9
      const t2 = t * t
      const t3 = t2 * t
      points.push([0, 1].map(axis => 0.5 * (
        2 * p1[axis] + (-p0[axis] + p2[axis]) * t
        + (2 * p0[axis] - 5 * p1[axis] + 4 * p2[axis] - p3[axis]) * t2
        + (-p0[axis] + 3 * p1[axis] - 3 * p2[axis] + p3[axis]) * t3
      )) as [number, number])
    }
  }
  return {
    points,
    closed: event.series !== "WRC",
    source: "illustration",
    sourceLabel: event.series === "WRC" ? "赛段路线示意" : "赛道路线示意",
  }
}

function matchingF1Route(event: RaceEvent, catalog: RouteCatalog) {
  if (event.series !== "F1") return undefined
  const identity = `${event.circuit} ${event.locality} ${event.name}`.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
  for (const [key, aliases] of F1_ROUTE_ALIASES) {
    if (aliases.some(alias => identity.includes(alias))) {
      const record = catalog.records[key]
      if (record?.points.length > 20) return record
    }
  }
  return undefined
}

export function getTrackFlightRoute(event: RaceEvent): TrackFlightRoute {
  const catalog = routeData as unknown as RouteCatalog
  const record = matchingF1Route(event, catalog)
  if (record) {
    return {
      points: record.points,
      closed: true,
      source: "public-reference",
      sourceLabel: "公开赛道几何参考",
    }
  }
  return illustrationRoute(event)
}
