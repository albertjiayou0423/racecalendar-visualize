import type { TrackFlightRoute } from "@/lib/track-flight"

export type DrawingPoint = { x: number; y: number }

export type TrackDrawing = {
  points: DrawingPoint[]
  distances: number[]
  length: number
  center: DrawingPoint
  width: number
  height: number
  fitScale: number
  closed: boolean
}

const WORLD_SIZE = 1200

export function prepareTrackDrawing(route: TrackFlightRoute): TrackDrawing {
  const source = route.points.map(([x, y]) => ({ x, y }))
  const bounds = source.reduce((result, point) => ({
    minX: Math.min(result.minX, point.x), maxX: Math.max(result.maxX, point.x),
    minY: Math.min(result.minY, point.y), maxY: Math.max(result.maxY, point.y),
  }), { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity })
  const span = Math.max(bounds.maxX - bounds.minX, bounds.maxY - bounds.minY, 0.001)
  const centerX = (bounds.minX + bounds.maxX) / 2
  const centerY = (bounds.minY + bounds.maxY) / 2
  const points = source.map(point => ({
    x: ((point.x - centerX) / span) * WORLD_SIZE,
    y: (-(point.y - centerY) / span) * WORLD_SIZE,
  }))
  if (route.closed && points.length > 2) points.push({ ...points[0] })

  const distances = [0]
  for (let index = 1; index < points.length; index++) {
    distances.push(distances[index - 1] + Math.hypot(points[index].x - points[index - 1].x, points[index].y - points[index - 1].y))
  }
  const width = (bounds.maxX - bounds.minX) / span * WORLD_SIZE
  const height = (bounds.maxY - bounds.minY) / span * WORLD_SIZE
  const fitScale = Math.min(580 / Math.max(width, 1), 630 / Math.max(height, 1))

  return {
    points,
    distances,
    length: distances.at(-1) ?? 1,
    center: { x: 0, y: 0 },
    width,
    height,
    fitScale,
    closed: route.closed,
  }
}

export function pointAtDistance(track: TrackDrawing, requestedDistance: number): DrawingPoint {
  const distance = Math.min(track.length, Math.max(0, requestedDistance))
  let index = 1
  while (index < track.distances.length - 1 && track.distances[index] < distance) index++
  const startDistance = track.distances[index - 1] ?? 0
  const endDistance = track.distances[index] ?? startDistance
  const ratio = endDistance === startDistance ? 0 : (distance - startDistance) / (endDistance - startDistance)
  const start = track.points[index - 1] ?? track.points[0] ?? { x: 0, y: 0 }
  const end = track.points[index] ?? start
  return { x: start.x + (end.x - start.x) * ratio, y: start.y + (end.y - start.y) * ratio }
}

export function smoothstep(value: number) {
  const t = Math.min(1, Math.max(0, value))
  return t * t * (3 - 2 * t)
}
