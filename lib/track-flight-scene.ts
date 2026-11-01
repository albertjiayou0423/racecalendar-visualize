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
  series: "F1" | "WRC" | "FE"
  accent: THREE.Color
  routeLength: number
}

const SERIES_COLORS = {
  F1: 0xef4444,
  WRC: 0x2f91ec,
  FE: 0x22c55e,
} as const

function seededRandom(seed: number) {
  let state = seed || 1
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0
    return state / 4294967296
  }
}

function makeRibbon(curve: THREE.Curve<THREE.Vector3>, width: number, segments: number, y: number) {
  const positions: number[] = []
  const uvs: number[] = []
  const indices: number[] = []
  for (let index = 0; index <= segments; index++) {
    const t = index / segments
    const point = curve.getPointAt(t)
    const tangent = curve.getTangentAt(t).normalize()
    const side = new THREE.Vector3(tangent.z, 0, -tangent.x).normalize()
    const left = point.clone().addScaledVector(side, width / 2)
    const right = point.clone().addScaledVector(side, -width / 2)
    left.y = y
    right.y = y
    positions.push(left.x, left.y, left.z, right.x, right.y, right.z)
    uvs.push(0, t * 90, 1, t * 90)
    if (index < segments) {
      const vertex = index * 2
      indices.push(vertex, vertex + 2, vertex + 1, vertex + 1, vertex + 2, vertex + 3)
    }
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  return geometry
}

function addSideObjects(scene: THREE.Scene, curve: THREE.CatmullRomCurve3, series: FlightScene["series"], seed: number) {
  const random = seededRandom(seed)
  const count = Math.max(32, Math.floor(curve.getLength() / (series === "FE" ? 13 : series === "WRC" ? 6.5 : 10)))
  const dummy = new THREE.Object3D()

  if (series !== "FE") {
    const trees = new THREE.InstancedMesh(
      new THREE.ConeGeometry(1.2, 5.1, 8),
      new THREE.MeshStandardMaterial({ color: series === "WRC" ? 0x29473e : 0x40584b, roughness: 1, flatShading: true }),
      count * 2,
    )
    const trunks = new THREE.InstancedMesh(
      new THREE.CylinderGeometry(0.14, 0.23, 1.45, 5),
      new THREE.MeshStandardMaterial({ color: 0x51463b, roughness: 1 }),
      count * 2,
    )
    let treeIndex = 0
    for (let index = 0; index < count; index++) {
      const t = 0.025 + index / count * 0.95
      const point = curve.getPointAt(t)
      const tangent = curve.getTangentAt(t)
      const side = new THREE.Vector3(tangent.z, 0, -tangent.x).normalize()
      for (const direction of [-1, 1]) {
        const offset = (series === "WRC" ? 11 : 16) + random() * (series === "WRC" ? 17 : 27)
        const position = point.clone().addScaledVector(side, direction * offset)
        const scale = (series === "WRC" ? 0.55 : 0.42) + random() * 0.45
        dummy.position.set(position.x, 2.45 * scale, position.z)
        dummy.rotation.y = random() * Math.PI * 2
        dummy.scale.setScalar(scale)
        dummy.updateMatrix()
        trees.setMatrixAt(treeIndex, dummy.matrix)
        dummy.position.set(position.x, 0.58 * scale, position.z)
        dummy.scale.set(scale, scale, scale)
        dummy.updateMatrix()
        trunks.setMatrixAt(treeIndex, dummy.matrix)
        treeIndex++
      }
    }
    trees.count = treeIndex
    trunks.count = treeIndex
    scene.add(trees, trunks)
    return
  }

  const blocks = new THREE.InstancedMesh(
    new THREE.BoxGeometry(1, 1, 1),
    new THREE.MeshStandardMaterial({ color: 0x333b40, roughness: 0.92, flatShading: true }),
    count * 2,
  )
  for (let index = 0; index < count; index++) {
    const t = 0.02 + index / count * 0.96
    const point = curve.getPointAt(t)
    const tangent = curve.getTangentAt(t)
    const side = new THREE.Vector3(tangent.z, 0, -tangent.x).normalize()
    for (const direction of [-1, 1]) {
      const position = point.clone().addScaledVector(side, 14 + random() * 13)
      const width = 4 + random() * 5
      const height = 7 + random() * 18
      dummy.position.set(position.x, height / 2, position.z)
      dummy.rotation.y = Math.atan2(tangent.x, tangent.z)
      dummy.scale.set(width, height, series === "FE" ? 5 + random() * 6 : 1.2)
      dummy.updateMatrix()
      blocks.setMatrixAt(index * 2 + (direction > 0 ? 1 : 0), dummy.matrix)
    }
  }
  scene.add(blocks)
}

function addCurbs(scene: THREE.Scene, curve: THREE.CatmullRomCurve3, series: FlightScene["series"], accent: THREE.Color) {
  if (series === "WRC") return
  const count = Math.max(80, Math.floor(curve.getLength() / 2.8))
  const curbs = new THREE.InstancedMesh(
    new THREE.BoxGeometry(2.55, 0.07, 0.38),
    new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9 }),
    count * 2,
  )
  const dummy = new THREE.Object3D()
  for (let index = 0; index < count; index++) {
    const t = index / count
    const point = curve.getPointAt(t)
    const tangent = curve.getTangentAt(t)
    const side = new THREE.Vector3(tangent.z, 0, -tangent.x).normalize()
    const angle = Math.atan2(tangent.x, tangent.z)
    for (const direction of [-1, 1]) {
      const position = point.clone().addScaledVector(side, direction * 4.12)
      dummy.position.set(position.x, 0.17, position.z)
      dummy.rotation.set(0, angle, 0)
      dummy.scale.set(1, 1, 1)
      dummy.updateMatrix()
      const curbIndex = index * 2 + (direction > 0 ? 1 : 0)
      curbs.setMatrixAt(curbIndex, dummy.matrix)
      curbs.setColorAt(curbIndex, index % 2 ? accent : new THREE.Color(0xf0ede4))
    }
  }
  scene.add(curbs)
}

function addTrackBarriers(scene: THREE.Scene, curve: THREE.CatmullRomCurve3, accent: THREE.Color) {
  for (const offset of [-9.5, 9.5]) {
    const points = Array.from({ length: 240 }, (_, index) => {
      const point = curve.getPointAt(index / 240)
      const tangent = curve.getTangentAt(index / 240)
      const side = new THREE.Vector3(tangent.z, 0, -tangent.x).normalize()
      point.addScaledVector(side, offset)
      point.y = 0.72
      return point
    })
    const barrierCurve = new THREE.CatmullRomCurve3(points, curve.closed, "centripetal")
    const barrier = new THREE.Mesh(
      new THREE.TubeGeometry(barrierCurve, 260, 0.48, 6, curve.closed),
      new THREE.MeshStandardMaterial({ color: 0x555e62, roughness: 0.86, metalness: 0.05 }),
    )
    const accentStrip = new THREE.Mesh(
      new THREE.TubeGeometry(barrierCurve, 260, 0.12, 5, curve.closed),
      new THREE.MeshStandardMaterial({ color: accent, roughness: 0.8 }),
    )
    accentStrip.position.y = 0.32
    scene.add(barrier, accentStrip)
  }
}

export function createTrackFlightScene(route: TrackFlightRoute, series: FlightScene["series"], seed: number): FlightScene {
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
  const accent = new THREE.Color(SERIES_COLORS[series])
  scene.background = new THREE.Color(series === "WRC" ? 0x91a69d : series === "FE" ? 0x8998a4 : 0x87949c)
  scene.fog = new THREE.Fog(scene.background, 105, 290)

  const camera = new THREE.PerspectiveCamera(54, WIDTH / HEIGHT, 0.1, 360)
  const renderer = new THREE.WebGLRenderer({ alpha: false, antialias: true, powerPreference: "low-power" })
  renderer.setSize(WIDTH, HEIGHT, false)
  renderer.setPixelRatio(1)
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.08

  scene.add(new THREE.HemisphereLight(0xe5edf0, 0x2c3430, 2.3))
  const sunlight = new THREE.DirectionalLight(0xfff2dc, 2.6)
  sunlight.position.set(-45, 90, 28)
  scene.add(sunlight)

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(900, 900),
    new THREE.MeshStandardMaterial({ color: series === "WRC" ? 0x52675c : series === "FE" ? 0x505c61 : 0x4c5559, roughness: 1 }),
  )
  ground.rotation.x = -Math.PI / 2
  ground.position.y = -0.5
  scene.add(ground)

  const shoulder = new THREE.Mesh(
    makeRibbon(curve, series === "WRC" ? 11 : 16, 900, 0.06),
    new THREE.MeshStandardMaterial({ color: series === "WRC" ? 0x7d7868 : 0x7a7f7d, roughness: 0.98, side: THREE.DoubleSide }),
  )
  const road = new THREE.Mesh(
    makeRibbon(curve, series === "WRC" ? 6.2 : 8.2, 900, 0.12),
    new THREE.MeshStandardMaterial({ color: 0x282d31, roughness: 0.93, metalness: 0.02, side: THREE.DoubleSide }),
  )
  scene.add(shoulder, road)

  addCurbs(scene, curve, series, accent)
  if (series !== "WRC") addTrackBarriers(scene, curve, accent)
  addSideObjects(scene, curve, series, seed)

  return { renderer, scene, camera, curve, closed: route.closed, series, accent, routeLength: curve.getLength() }
}

export function renderTrackFlightFrame(flight: FlightScene, animationProgress: number) {
  const { camera, curve, closed, renderer, scene } = flight
  const eased = THREE.MathUtils.clamp(animationProgress, 0, 1)
  const travel = closed ? 0.28 : 0.84
  const start = closed ? 0.07 : 0.035
  const progress = Math.min(start + eased * travel, closed ? 0.98 : 0.98)
  const lookAhead = Math.min(0.11, 34 / flight.routeLength)
  const position = curve.getPointAt(progress)
  const target = curve.getPointAt(Math.min(progress + lookAhead, 0.995))
  const tangent = curve.getTangentAt(progress)

  camera.position.set(position.x, flight.series === "WRC" ? 16 : 19, position.z)
  target.y = 1.2
  camera.up.set(0, 1, 0)
  camera.lookAt(target)
  const nextTangent = curve.getTangentAt(Math.min(progress + lookAhead * 1.8, 0.995))
  const turn = tangent.x * nextTangent.z - tangent.z * nextTangent.x
  camera.rotateZ(THREE.MathUtils.clamp(-turn * 0.14, -0.12, 0.12))
  renderer.render(scene, camera)
  return { progress: eased, canvas: renderer.domElement }
}

export function disposeTrackFlightScene(flight: FlightScene) {
  flight.scene.traverse(object => {
    if (object instanceof THREE.Mesh || object instanceof THREE.InstancedMesh) {
      object.geometry.dispose()
      const materials = Array.isArray(object.material) ? object.material : [object.material]
      materials.forEach(material => material.dispose())
    }
  })
  flight.renderer.dispose()
  flight.renderer.forceContextLoss()
}
