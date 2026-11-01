import * as THREE from "three"
import type { TrackFlightRoute } from "@/lib/track-flight"

const WIDTH = 540
const HEIGHT = 960

type FlightScene = {
  renderer: THREE.WebGLRenderer
  scene: THREE.Scene
  camera: THREE.PerspectiveCamera
  curve: THREE.CatmullRomCurve3
  closed: boolean
  routeLength: number
  series: "F1" | "WRC" | "FE"
}

const SERIES_COLORS = {
  F1: 0xef4444,
  WRC: 0x3b9cf4,
  FE: 0x42d392,
} as const

export function createTrackFlightScene(route: TrackFlightRoute, series: FlightScene["series"]): FlightScene {
  const bounds = route.points.reduce((value, point) => ({
    minX: Math.min(value.minX, point[0]), maxX: Math.max(value.maxX, point[0]),
    minY: Math.min(value.minY, point[1]), maxY: Math.max(value.maxY, point[1]),
  }), { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity })
  const span = Math.max(bounds.maxX - bounds.minX, bounds.maxY - bounds.minY, 0.1)
  const points = route.points.map(([x, y]) => new THREE.Vector3(
    ((x - (bounds.minX + bounds.maxX) / 2) / span) * 154,
    0,
    ((y - (bounds.minY + bounds.maxY) / 2) / span) * 154,
  ))
  const curve = new THREE.CatmullRomCurve3(points, route.closed, "centripetal", 0.15)
  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(54, WIDTH / HEIGHT, 0.1, 360)
  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: "low-power" })
  renderer.setSize(WIDTH, HEIGHT, false)
  renderer.setPixelRatio(1)
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.setClearColor(0x000000, 0)

  // One route only: no ground mesh, scenery, barriers, or drone model.
  const trackLine = new THREE.Mesh(
    new THREE.TubeGeometry(curve, 1800, 0.36, 8, route.closed),
    new THREE.MeshBasicMaterial({ color: SERIES_COLORS[series], toneMapped: false }),
  )
  scene.add(trackLine)

  return { renderer, scene, camera, curve, closed: route.closed, routeLength: curve.getLength(), series }
}

export function renderTrackFlightFrame(flight: FlightScene, animationProgress: number) {
  const { camera, curve, closed, renderer, scene, routeLength } = flight
  const progress = THREE.MathUtils.clamp(animationProgress, 0, 1)
  const lookAhead = Math.min(0.12, 52 / Math.max(routeLength, 1))
  const position = curve.getPointAt(progress)
  const tangent = curve.getTangentAt(progress).normalize()
  let target: THREE.Vector3

  if (closed) {
    target = curve.getPointAt((progress + lookAhead) % 1)
  } else {
    const targetProgress = progress + lookAhead
    target = targetProgress <= 1
      ? curve.getPointAt(targetProgress)
      : curve.getPointAt(1).addScaledVector(curve.getTangentAt(1).normalize(), (targetProgress - 1) * routeLength)
  }

  camera.position.set(position.x, flight.series === "WRC" ? 4.8 : 5.4, position.z)
  target.y = 1.2
  camera.up.set(0, 1, 0)
  camera.lookAt(target)
  const bankWindow = Math.min(0.045, 18 / Math.max(routeLength, 1))
  const beforeProgress = closed ? (progress - bankWindow + 1) % 1 : Math.max(0, progress - bankWindow)
  const afterProgress = closed ? (progress + bankWindow) % 1 : Math.min(1, progress + bankWindow)
  const beforeTangent = curve.getTangentAt(beforeProgress).normalize()
  const afterTangent = curve.getTangentAt(afterProgress).normalize()
  const turn = Math.atan2(
    beforeTangent.x * afterTangent.z - beforeTangent.z * afterTangent.x,
    beforeTangent.x * afterTangent.x + beforeTangent.z * afterTangent.z,
  )
  // GSAP drives route progress; banking follows spline curvature so turns tilt the POV smoothly.
  camera.rotateZ(THREE.MathUtils.clamp(-turn * 0.78, -0.24, 0.24))
  renderer.render(scene, camera)
  return { progress, canvas: renderer.domElement }
}

export function disposeTrackFlightScene(flight: FlightScene) {
  flight.scene.traverse(object => {
    if (object instanceof THREE.Mesh) {
      object.geometry.dispose()
      const materials = Array.isArray(object.material) ? object.material : [object.material]
      materials.forEach(material => material.dispose())
    }
  })
  flight.renderer.dispose()
  flight.renderer.forceContextLoss()
}
