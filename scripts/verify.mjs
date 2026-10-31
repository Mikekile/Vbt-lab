import { readFileSync } from "node:fs"
import { analyze, massKg, roundTo } from "../src/physics.js"
import { parseTpaf } from "../src/parse.js"

const path = process.argv[2]
if (!path) {
  console.error("usage: node scripts/verify.mjs <file.tpaf>")
  process.exit(1)
}

const parsed = parseTpaf(readFileSync(path, "utf8"))
const rows = []

function pct(computed, tendo) {
  if (!tendo) return null
  return (100 * (computed - tendo)) / tendo
}

for (const set of parsed.sets) {
  for (const rep of set.reps) {
    const curve = analyze(rep.counts, massKg(rep.load), set.partialPercent)
    rows.push({
      rep: rep.index,
      load: `${rep.load.value} ${rep.load.unit}`,
      meanT: rep.tendo.meanVelocity,
      meanC: curve.meanVelocity,
      peakT: rep.tendo.peakVelocity,
      peakC: curve.peakVelocity,
      peakStep: curve.peakVelocityStep,
      powerT: rep.tendo.peakPower,
      powerC: curve.peakPower,
      forceT: rep.tendo.peakForce,
      forceC: curve.peakForce,
      meanPowerT: rep.tendo.meanPower,
      meanPowerC: curve.meanPower,
      timeToPeak: curve.timeToPeak,
    })
  }
}

function line(cells) {
  console.log(cells.map((cell) => String(cell).padStart(8)).join(" "))
}

line(["rep", "load", "vAvgT", "vAvgC", "e%", "vPkT", "vPkC", "e%", "PpkT", "PpkC", "e%", "FpkT", "FpkC", "e%"])
const buckets = { mean: [], peak: [], power: [], force: [], meanPower: [], meanShown: [], peakShown: [] }
for (const row of rows) {
  const meanE = pct(row.meanC, row.meanT)
  const peakE = pct(row.peakC, row.peakT)
  const powerE = pct(row.powerC, row.powerT)
  const forceE = row.forceT == null ? null : pct(row.forceC, row.forceT)
  const meanPowerE = row.meanPowerT == null ? null : pct(row.meanPowerC, row.meanPowerT)
  buckets.mean.push(meanE)
  buckets.peak.push(peakE)
  buckets.power.push(powerE)
  if (forceE != null) buckets.force.push(forceE)
  if (meanPowerE != null) buckets.meanPower.push(meanPowerE)
  buckets.meanShown.push(pct(roundTo(row.meanC, 2), row.meanT))
  buckets.peakShown.push(pct(roundTo(row.peakC, 2), row.peakT))
  line([
    row.rep,
    row.load,
    row.meanT.toFixed(2),
    row.meanC.toFixed(3),
    meanE.toFixed(2),
    row.peakT.toFixed(2),
    row.peakC.toFixed(3),
    peakE.toFixed(2),
    row.powerT,
    Math.round(row.powerC),
    powerE.toFixed(1),
    row.forceT ?? "",
    Math.round(row.forceC),
    forceE == null ? "" : forceE.toFixed(1),
  ])
}

function summarize(name, values) {
  const abs = values.map((value) => Math.abs(value))
  const mae = abs.reduce((sum, value) => sum + value, 0) / abs.length
  const max = Math.max(...abs)
  console.log(`${name}  n=${values.length}  mae ${mae.toFixed(3)}%  max ${max.toFixed(3)}%`)
}

console.log("")
summarize("mean velocity unrounded", buckets.mean)
summarize("mean velocity shown at 0.01", buckets.meanShown)
summarize("peak velocity unrounded", buckets.peak)
summarize("peak velocity shown at 0.01", buckets.peakShown)
summarize("peak power", buckets.power)
summarize("peak force in partial range", buckets.force)
summarize("mean power m*g*v", buckets.meanPower)
const shownPeakMiss = rows.filter((row) => roundTo(row.peakC, 2) !== row.peakT).length
const shownMeanMiss = rows.filter((row) => roundTo(row.meanC, 2) !== row.meanT).length
console.log(`displayed mean mismatches ${shownMeanMiss}/${rows.length}`)
console.log(`displayed peak mismatches ${shownPeakMiss}/${rows.length}`)
