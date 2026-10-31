// Tendo FAQ, "What is a sampling frequency?": at 2 m/s the rate is 200 Hz.
// 2 / 200 = 0.01 m, so each impulse is one centimetre of cord.
// The same page says the unit times "small impulses with known distance".
// https://www.tendosport.com/support/faq/
export const STEP_M = 0.01

// Mean velocity is distance / time. With a 1 cm step, the tick that matches
// a 24-rep export to Tendo's displayed 0.01 m/s on every rep is 8 µs
// (0.01 / 8e-6 = 1250). The only constants in that match band are 1249.1
// to 1252.2, and 1250 is the center. The export is not in this repo.
export const TICK_S = 8e-6

// The fastest single centimetre sits about 2.6% above Tendo's peak velocity.
// The fastest 9 consecutive centimetres is the only integer width that lands
// on Tendo's peak to 0.01 m/s on every rep of that export. The manual never
// states this width.
export const PEAK_WINDOW = 9

// Conventional standard acceleration of gravity.
export const G = 9.80665

// International pound, exactly, since the 1959 yard and pound agreement.
export const LB_TO_KG = 0.45359237

// Tendo MyUnit manual 1.2 states peak power and peak force as
// P = F * v, F = (m * g) + (m * a).
// The same manual introduces average power as F = m * g, P = F * v.
// https://www.tendosport.com/wp-content/uploads/2022/04/Tendo-MyUnit-manual-eng-1.2.pdf
// Peak force is the maximum inside the partial range, measured from the
// start of the rep. Manual section 4.5. The export stores that percent
// on the set as N_PARTIAL_AVG_RANGE.

export function massKg(load) {
  const unit = String(load.unit).toLowerCase()
  if (unit === "kg") return load.value
  if (unit === "lb" || unit === "lbs") return load.value * LB_TO_KG
  throw new Error(`Unknown load unit ${load.unit}`)
}

export function roundTo(value, digits) {
  const scale = 10 ** digits
  return Math.round((value + Number.EPSILON) * scale) / scale
}

function prefixSums(counts) {
  const sums = [0]
  let total = 0
  for (const count of counts) {
    total += count
    sums.push(total)
  }
  return sums
}

function fastest(counts, width) {
  const span = Math.min(width, counts.length)
  const sums = prefixSums(counts)
  let best = -Infinity
  let start = 0
  for (let i = 0; i + span <= counts.length; i++) {
    const ticks = sums[i + span] - sums[i]
    const velocity = (span * STEP_M) / (ticks * TICK_S)
    if (velocity > best) {
      best = velocity
      start = i
    }
  }
  const t0 = sums[start] * TICK_S
  const t1 = sums[start + span] * TICK_S
  return { velocity: best, time: (t0 + t1) / 2, span }
}

function centeredAcceleration(velocity) {
  const accel = new Array(velocity.length).fill(0)
  if (velocity.length >= 3) {
    for (let i = 1; i < velocity.length - 1; i++) {
      accel[i] = (velocity[i + 1].y - velocity[i - 1].y) / (velocity[i + 1].t - velocity[i - 1].t)
    }
    return reuseNearestCentered(accel)
  }
  if (velocity.length === 2) {
    const step = (velocity[1].y - velocity[0].y) / (velocity[1].t - velocity[0].t)
    accel[0] = step
    accel[1] = step
  }
  return accel
}

function reuseNearestCentered(accel) {
  accel[0] = accel[1]
  accel[accel.length - 1] = accel[accel.length - 2]
  return accel
}

export function analyze(counts, mass, partialPercent) {
  if (!counts.length) throw new Error("This rep has no samples")
  const sums = prefixSums(counts)
  const duration = sums[sums.length - 1] * TICK_S
  const distance = counts.length * STEP_M
  const meanVelocity = distance / duration

  const step = fastest(counts, 1)
  const reported = counts.length >= PEAK_WINDOW ? fastest(counts, PEAK_WINDOW) : step

  const velocity = []
  const displacement = [{ t: 0, y: 0 }]
  let elapsed = 0
  for (let i = 0; i < counts.length; i++) {
    const dt = counts[i] * TICK_S
    const speed = STEP_M / dt
    velocity.push({ t: elapsed + dt / 2, y: speed, xEnd: (i + 1) * STEP_M })
    elapsed += dt
    displacement.push({ t: elapsed, y: (i + 1) * STEP_M })
  }

  const accel = centeredAcceleration(velocity)

  const power = velocity.map((sample, i) => ({
    t: sample.t,
    y: mass * (G + accel[i]) * sample.y,
  }))
  const force = velocity.map((sample, i) => ({
    t: sample.t,
    y: mass * (G + accel[i]),
    xEnd: sample.xEnd,
  }))

  const fraction = Number.isFinite(partialPercent) ? partialPercent / 100 : 1
  const limit = distance * fraction
  const inRange = force.filter((sample) => sample.xEnd <= limit + 1e-9)
  const forceSamples = inRange.length ? inRange : force.slice(0, 1)

  return {
    duration,
    distance,
    meanVelocity,
    meanPower: mass * G * meanVelocity,
    peakVelocity: reported.velocity,
    peakVelocityStep: step.velocity,
    timeToPeak: reported.time,
    peakPower: Math.max(...power.map((sample) => sample.y)),
    peakForce: Math.max(...forceSamples.map((sample) => sample.y)),
    velocity: velocity.map(({ t, y }) => ({ t, y })),
    power,
    displacement,
  }
}
