import { massKg } from "./physics.js"

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

function decode(value) {
  return value
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&apos;", "'")
    .replaceAll("&amp;", "&")
}

function attrs(source) {
  const found = {}
  for (const match of source.matchAll(/([\w:]+)="([^"]*)"/g)) {
    found[match[1]] = decode(match[2])
  }
  return found
}

function required(bag, name, label) {
  const value = bag[name]
  if (value == null || value === "") throw new Error(`${label} is missing ${name}`)
  return value
}

function numberAttr(bag, name, label) {
  const parsed = Number(required(bag, name, label))
  if (!Number.isFinite(parsed)) throw new Error(`${label} has a bad ${name}`)
  return parsed
}

function optionalNumber(bag, name) {
  if (bag[name] == null || bag[name] === "") return null
  const parsed = Number(bag[name])
  if (!Number.isFinite(parsed)) throw new Error(`Bad ${name}`)
  return parsed
}

function countsFrom(text, label) {
  if (text == null) throw new Error(`${label} has no i_data`)
  const counts = text
    .trim()
    .split("#")
    .map((part) => part.trim())
    .filter((part) => part.length > 0)
    .map((part) => {
      if (!/^[0-9]+$/.test(part)) throw new Error(`${label} has a bad sample`)
      return Number(part)
    })
  if (!counts.length) throw new Error(`${label} has no samples`)
  if (counts.some((count) => count <= 0)) throw new Error(`${label} has a bad sample`)
  return counts
}

function loadFrom(value, unit) {
  const load = { value, unit }
  massKg(load)
  return load
}

// Tendo writes D_TRY as month/day/year and a 12-hour clock.
export function triedAtMs(raw) {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})\s+(\d{1,2}):(\d{2}):(\d{2})\s+(AM|PM)$/i.exec(String(raw).trim())
  if (!match) return 0
  const month = Number(match[1])
  const day = Number(match[2])
  const year = Number(match[3])
  let hour = Number(match[4])
  const ampm = match[7].toUpperCase()
  if (ampm === "PM" && hour < 12) hour += 12
  if (ampm === "AM" && hour === 12) hour = 0
  return Date.UTC(year, month - 1, day, hour, Number(match[5]), Number(match[6]))
}

export function formatTried(raw) {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})\s+(\d{1,2}):(\d{2}):(\d{2})\s+(AM|PM)$/i.exec(String(raw).trim())
  if (!match) return String(raw)
  const month = Number(match[1])
  const day = Number(match[2])
  const year = Number(match[3])
  let hour = Number(match[4])
  const minute = match[5]
  const ampm = match[7].toUpperCase()
  if (month < 1 || month > 12 || day < 1 || day > 31) return String(raw)
  if (ampm === "PM" && hour < 12) hour += 12
  if (ampm === "AM" && hour === 12) hour = 0
  const shown = hour % 12 === 0 ? 12 : hour % 12
  const suffix = hour < 12 ? "AM" : "PM"
  return `${MONTHS[month - 1]} ${day}, ${year}, ${shown}:${minute} ${suffix}`
}

export function parseTpaf(xml) {
  const source = String(xml).replace(/^\uFEFF/, "")
  const sets = []
  for (const setMatch of source.matchAll(/<set\b([^>]*)>([\s\S]*?)<\/set>/g)) {
    const setAttrs = attrs(setMatch[1])
    const exercise = required(setAttrs, "S_EXCERSIZE_NAME", "A set")
    const triedAt = required(setAttrs, "D_TRY", exercise)
    const reps = []
    for (const repMatch of setMatch[2].matchAll(/<rep\b([^>]*)>([\s\S]*?)<\/rep>/g)) {
      const repAttrs = attrs(repMatch[1])
      const label = `Rep ${repAttrs.N_VALUE_ID ?? reps.length + 1}`
      const dataMatch = /<i_data>([\s\S]*?)<\/i_data>/.exec(repMatch[2])
      reps.push({
        index: numberAttr(repAttrs, "N_VALUE_ID", label),
        load: loadFrom(numberAttr(repAttrs, "N_LOAD_REP", label), required(repAttrs, "S_UNIT_REP", label)),
        counts: countsFrom(dataMatch && dataMatch[1], label),
        tendo: {
          meanVelocity: numberAttr(repAttrs, "N_AVERAGE_VELOCITY", label),
          peakVelocity: numberAttr(repAttrs, "N_PEAK_VELOCITY", label),
          meanPower: optionalNumber(repAttrs, "N_AVERAGE_POWER"),
          peakPower: numberAttr(repAttrs, "N_PEAK_POWER", label),
          peakForce: optionalNumber(repAttrs, "N_PEAK_FORCE"),
          eccentricVelocity: optionalNumber(repAttrs, "N_ECCEN_VEL"),
        },
      })
    }
    if (!reps.length) throw new Error(`${exercise} has no reps`)
    sets.push({
      exercise,
      triedAt,
      note: setAttrs.S_NOTE || "",
      filterCm: optionalNumber(setAttrs, "N_FILTER"),
      // A missing partial-range attribute does not record the device setting.
      // The manual default is 50, but guessing that would drop the second half
      // of the force curve, so a missing value uses the full range.
      partialPercent: optionalNumber(setAttrs, "N_PARTIAL_AVG_RANGE") ?? 100,
      reps,
    })
  }
  if (!sets.length) throw new Error("That file is not a Tendo .tpaf export.")
  return { sets }
}

export function contentKey(sets) {
  return sets
    .map((set) =>
      [
        set.exercise,
        set.triedAt,
        set.reps
          .map((rep) => `${rep.index}:${rep.load.value}${rep.load.unit}:${rep.counts.join(",")}`)
          .join(";"),
      ].join("|"),
    )
    .join("||")
}
