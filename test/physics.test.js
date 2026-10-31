import assert from "node:assert/strict"
import test from "node:test"
import { analyze, massKg, G } from "../src/physics.js"

test("mean velocity is distance over time", () => {
  const out = analyze([1250, 1250, 1250, 1250], 10, 100)
  assert.equal(out.meanVelocity, 1)
  assert.equal(out.distance, 0.04)
  assert.equal(out.duration, 0.04)
})

test("a rep shorter than 9 cm reports the fastest centimetre", () => {
  const out = analyze([2000, 1000, 2000], 2, 50)
  assert.equal(out.peakVelocityStep, 1.25)
  assert.equal(out.peakVelocity, 1.25)
  assert.equal(out.meanVelocity, 0.75)
})

test("peak velocity is the fastest 9 cm once the rep is long enough", () => {
  const counts = new Array(20).fill(1250)
  for (let i = 4; i < 13; i++) counts[i] = 1000
  const out = analyze(counts, 10, 100)
  assert.ok(Math.abs(out.peakVelocity - 1.25) < 1e-12)
  assert.ok(Math.abs(out.peakVelocityStep - 1.25) < 1e-12)
  assert.ok(Math.abs(out.timeToPeak - 0.076) < 1e-12)
  assert.ok(Math.abs(out.meanVelocity - 0.2 / 0.182) < 1e-12)
})

test("acceleration is the centered change in velocity over the change in time", () => {
  const out = analyze([2000, 1500, 1000, 1500, 2000], 2, 100)
  const accel = 0.625 / 0.024
  const force = 2 * (G + accel)
  const power = force * (0.01 / 0.012)
  assert.ok(Math.abs(out.peakForce - force) < 1e-6)
  assert.ok(Math.abs(out.power[1].y - power) < 1e-6)
  const forceAt = (index) => out.power[index].y / out.velocity[index].y
  assert.ok(Math.abs(forceAt(0) - forceAt(1)) < 1e-6)
  assert.ok(Math.abs(out.meanPower - 2 * G * (0.05 / 0.064)) < 1e-6)
})

test("peak force stays inside the partial range", () => {
  const counts = new Array(10).fill(1250)
  counts[9] = 500
  const full = analyze(counts, 10, 100)
  const early = analyze(counts, 10, 50)
  assert.ok(full.peakForce > early.peakForce)
})

test("pounds convert with the international pound", () => {
  assert.equal(massKg({ value: 138, unit: "lb" }), 138 * 0.45359237)
  assert.equal(massKg({ value: 20, unit: "kg" }), 20)
  assert.throws(() => massKg({ value: 20, unit: "stone" }), /Unknown load unit/)
})
