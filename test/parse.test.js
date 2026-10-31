import assert from "node:assert/strict"
import test from "node:test"
import { contentKey, formatTried, parseTpaf, triedAtMs } from "../src/parse.js"

const sample = `<?xml version="1.0"?>
<sets>
  <set D_TRY="01/02/2020 01:05:00 PM" S_EXCERSIZE_NAME="Squat" N_LOAD="100" S_UNIT="kg" N_FILTER="35" N_PARTIAL_AVG_RANGE="50" S_NOTE="">
    <rep N_VALUE_ID="1" N_LOAD_REP="100" S_UNIT_REP="kg" N_AVERAGE_VELOCITY="1" N_PEAK_VELOCITY="1.2" N_PEAK_POWER="800" N_PEAK_FORCE="1200" N_AVERAGE_POWER="700" N_ECCEN_VEL="0.4">
      <i_data>1250#1250#1000#</i_data>
    </rep>
    <rep N_VALUE_ID="2" N_LOAD_REP="40" S_UNIT_REP="lb" N_AVERAGE_VELOCITY="0.5" N_PEAK_VELOCITY="0.8" N_PEAK_POWER="300">
      <i_data>2000#1500</i_data>
    </rep>
  </set>
  <set D_TRY="01/02/2020 01:10:00 AM" S_EXCERSIZE_NAME="Bench" N_PARTIAL_AVG_RANGE="40">
    <rep N_VALUE_ID="1" N_LOAD_REP="50" S_UNIT_REP="kg" N_AVERAGE_VELOCITY="0.5" N_PEAK_VELOCITY="0.8" N_PEAK_POWER="400">
      <i_data>1800#1800</i_data>
    </rep>
  </set>
</sets>`

test("a file with two sets keeps both", () => {
  const parsed = parseTpaf(sample)
  assert.equal(parsed.sets.length, 2)
  assert.equal(parsed.sets[0].exercise, "Squat")
  assert.equal(parsed.sets[0].filterCm, 35)
  assert.equal(parsed.sets[0].partialPercent, 50)
  assert.deepEqual(parsed.sets[0].reps[0].counts, [1250, 1250, 1000])
  assert.equal(parsed.sets[0].reps[0].tendo.peakForce, 1200)
  assert.equal(parsed.sets[0].reps[1].tendo.peakForce, null)
  assert.equal(parsed.sets[0].reps[1].load.unit, "lb")
  assert.equal(parsed.sets[1].exercise, "Bench")
  assert.equal(parsed.sets[1].partialPercent, 40)
  assert.equal(parsed.sets[1].filterCm, null)
})

test("dates are month first", () => {
  assert.equal(formatTried("01/02/2020 01:05:00 PM"), "Jan 2, 2020, 1:05 PM")
  assert.equal(formatTried("12/31/1999 12:00:00 AM"), "Dec 31, 1999, 12:00 AM")
  assert.equal(formatTried("not a date"), "not a date")
  assert.ok(triedAtMs("01/01/2026 12:00:00 AM") > triedAtMs("12/31/2025 11:59:00 PM"))
})

test("the same export has the same content key", () => {
  assert.equal(contentKey(parseTpaf(sample).sets), contentKey(parseTpaf(sample).sets))
})

test("a missing partial range uses the full rise", () => {
  const xml = `<sets><set D_TRY="01/02/2020 01:05:00 PM" S_EXCERSIZE_NAME="Squat">
    <rep N_VALUE_ID="1" N_LOAD_REP="20" S_UNIT_REP="kg" N_AVERAGE_VELOCITY="1" N_PEAK_VELOCITY="1" N_PEAK_POWER="1">
      <i_data>1000#1000</i_data>
    </rep>
  </set></sets>`
  assert.equal(parseTpaf(xml).sets[0].partialPercent, 100)
})

test("a file without sets is rejected", () => {
  assert.throws(() => parseTpaf("<sets></sets>"), /not a Tendo/)
})
