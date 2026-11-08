import { mkdir, writeFile } from "node:fs/promises"
import { join } from "node:path"
import { fileURLToPath } from "node:url"

const revision = "0c941730f3d3279da6a553f79c15e9ed62780b2c"
const files = [
  "albert_park_circuit", "autodromo_hermanos_rodriguez", "autodromo_jose_carlos_pace",
  "autodromo_nazionale_monza", "baku_city_circuit", "circuit_de_barcelona_catalunya",
  "circuit_de_monaco", "circuit_de_spa_francorchamps", "circuit_gilles_villeneuve",
  "circuit_of_the_americas", "circuit_zandvoort", "hungaroring", "las_vegas_strip_circuit",
  "lusail_international_circuit", "madring", "marina_bay_street_circuit",
  "miami_international_autodrome", "red_bull_ring", "sepang_international_circuit",
  "shanghai_international_circuit", "silverstone_circuit", "suzuka_international_racing_course",
  "yas_marina_circuit",
]
const root = fileURLToPath(new URL("../public/track-routes/", import.meta.url))
const target = join(root, "f1-active.json")
const records = {}

function resample(points, count = 150) {
  const closed = points.length > 2 && Math.hypot(points[0].x - points.at(-1).x, points[0].y - points.at(-1).y) < 1e-6
  const source = closed ? points.slice(0, -1) : points
  const line = closed ? [...source, source[0]] : source
  const cumulative = [0]
  for (let index = 1; index < line.length; index++) {
    cumulative.push(cumulative.at(-1) + Math.hypot(line[index].x - line[index - 1].x, line[index].y - line[index - 1].y))
  }
  const total = cumulative.at(-1) ?? 0
  if (!total) return []
  const output = []
  for (let sample = 0; sample < count; sample++) {
    const targetDistance = total * sample / count
    let index = 1
    while (index < cumulative.length - 1 && cumulative[index] < targetDistance) index++
    const before = line[index - 1]
    const after = line[index]
    const segmentLength = cumulative[index] - cumulative[index - 1]
    const t = segmentLength ? (targetDistance - cumulative[index - 1]) / segmentLength : 0
    output.push([
      Math.round((before.x + (after.x - before.x) * t) * 10) / 10,
      Math.round((before.y + (after.y - before.y) * t) * 10) / 10,
    ])
  }
  return output
}

await mkdir(root, { recursive: true })
for (const file of files) {
  const sourceUrl = `https://raw.githubusercontent.com/GameDev-Toolkit/global-motorsport-circuits-json/${revision}/f1/active/${file}.json`
  const response = await fetch(sourceUrl)
  if (!response.ok) throw new Error(`Could not fetch ${file}: HTTP ${response.status}`)
  const source = await response.json()
  records[file] = { name: source.name, points: resample(source.points) }
}

const licenseUrl = `https://raw.githubusercontent.com/GameDev-Toolkit/global-motorsport-circuits-json/${revision}/LICENSE`
const licenseResponse = await fetch(licenseUrl)
if (!licenseResponse.ok) throw new Error(`Could not fetch dataset license: HTTP ${licenseResponse.status}`)
await writeFile(target, `${JSON.stringify({ sourceRevision: revision, records })}\n`, "utf8")
await writeFile(join(root, "LICENSE-APACHE-2.0.txt"), await licenseResponse.text(), "utf8")
await writeFile(join(root, "ATTRIBUTION.md"), `# Track route data\n\n- Source: [Global Motorsport Circuits JSON](https://github.com/GameDev-Toolkit/global-motorsport-circuits-json)\n- Pinned revision: \`${revision}\`\n- License: Apache-2.0; full text is in [LICENSE-APACHE-2.0.txt](./LICENSE-APACHE-2.0.txt).\n- Imported files: the source repository's \`f1/active\` records, resampled to 150 points and rounded to one decimal place. The JSON file is a transformed derivative.\n- The upstream project says its geometry has no documented provenance or accuracy guarantee. The animation therefore labels these outlines as visual references, not authoritative event maps.\n- Formula E and WRC routes are not included in this F1 dataset. The video renderer uses an explicitly labeled route illustration for events without a matched F1 outline.\n`, "utf8")
console.log(`Imported ${Object.keys(records).length} F1 route outlines to ${target}`)
