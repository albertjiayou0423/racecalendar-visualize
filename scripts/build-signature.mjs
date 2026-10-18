import fs from "node:fs"

// This variable-width outline contains both sampled edges of one pen stroke.
// Pair the edges to recover its centreline, and reveal the untouched outline
// through a narrow animated mask. Drawing the outline itself would trace its
// perimeter twice rather than reproduce the handwriting.
const source = fs.readFileSync(new URL("../app/new/assets/signature.svg", import.meta.url), "utf8")
const d = source.match(/<path\s+d="([^"]+)"/)?.[1]
if (!d || /[^MLHVZ0-9.,\s-]/.test(d)) throw new Error("Unsupported signature outline")
let x = 0, y = 0
const points = []
for (const match of d.matchAll(/([MLHVZ])([^MLHVZ]*)/g)) {
  if (match[1] === "Z") continue
  const values = match[2].trim().split(/[ ,]+/).filter(Boolean).map(Number)
  if (match[1] === "M" || match[1] === "L") [x, y] = values
  else if (match[1] === "H") x = values[0]
  else y = values[0]
  if (!Number.isFinite(x) || !Number.isFinite(y)) throw new Error("Invalid signature coordinate")
  points.push([x, y])
}
const count = (points.length - 1) / 2
if (!Number.isInteger(count) || count < 2 || points[0].some((value, i) => value !== points.at(-1)[i])) throw new Error("Expected a closed, paired single-stroke outline")
const centre = [], widths = []
for (let i = 0; i < count; i++) {
  const a = points[i], b = points[points.length - 2 - i]
  centre.push([(a[0] + b[0]) / 2, (a[1] + b[1]) / 2])
  widths.push(Math.hypot(a[0] - b[0], a[1] - b[1]))
}
if (Math.max(...widths) > 3) throw new Error("Paired edges no longer match; review centreline before generating")
const line = centre.map((point, i) => (i ? "L" : "M") + point.map(value => Number(value.toFixed(3))).join(" ")).join("")
const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="299" height="107" viewBox="0 0 299 107" fill="none">\n<title>Huo_sai 手写签名</title>\n<style>.pen{animation:write 3.8s cubic-bezier(.3,.05,.25,1) .15s both}@keyframes write{from{stroke-dashoffset:1}to{stroke-dashoffset:0}}@media(prefers-reduced-motion:reduce){.pen{animation:none;stroke-dashoffset:0}}</style>\n<defs><mask id="ink" maskUnits="userSpaceOnUse" x="0" y="0" width="299" height="107"><path class="pen" d="' + line + '" stroke="white" stroke-width="3.1" stroke-linecap="round" stroke-linejoin="round" pathLength="1" stroke-dasharray="1" stroke-dashoffset="1"/></mask></defs>\n<path d="' + d + '" fill="#e6e6e6" mask="url(#ink)"/>\n</svg>\n'
fs.writeFileSync(new URL("../public/signature-write.svg", import.meta.url), svg)
console.log("Generated signature-write.svg from " + count + " paired samples")
