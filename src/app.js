import { drawSeries } from "./chart.js"
import { deleteSession, getSession, listSessions, putSession } from "./db.js"
import { analyze, massKg, roundTo } from "./physics.js"
import { contentKey, formatTried, parseTpaf, triedAtMs } from "./parse.js"

const app = document.querySelector("#app")
const fileInput = document.querySelector("#file")

let sessions = []
let notice = ""
let observers = []

function esc(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
}

function formatLoad(load) {
  return `${load.value} ${load.unit}`
}

function velocity(value) {
  return roundTo(value, 2).toFixed(2)
}

function watts(value) {
  return String(Math.round(value))
}

function loadList(reps) {
  const labels = []
  for (const rep of reps) {
    const label = formatLoad(rep.load)
    if (!labels.includes(label)) labels.push(label)
  }
  return labels.join(", ")
}

function repCount(sets) {
  return sets.reduce((sum, set) => sum + set.reps.length, 0)
}

function pair(tendo, computed) {
  return `<span class="pair"><b>${esc(tendo)}</b><span>${esc(computed)}</span></span>`
}

function stopObservers() {
  for (const observer of observers) observer.disconnect()
  observers = []
}

function mountCharts(curve) {
  stopObservers()
  const specs = [
    ["velocity", curve.velocity, "#9a3412"],
    ["power", curve.power, "#1d4ed8"],
    ["displacement", curve.displacement.map((point) => ({ t: point.t, y: point.y * 100 })), "#3f6212"],
  ]
  for (const [name, points, color] of specs) {
    const canvas = document.querySelector(`[data-chart="${name}"]`)
    if (!canvas) continue
    const paint = () => drawSeries(canvas, { points, marker: curve.timeToPeak, color })
    paint()
    const observer = new ResizeObserver(paint)
    observer.observe(canvas)
    observers.push(observer)
  }
}

function banner() {
  return notice ? `<p class="alert" role="alert">${esc(notice)}</p>` : ""
}

function header(backHref) {
  const back = backHref ? `<a class="back" href="${esc(backHref)}">Back</a>` : `<span class="brand">vbt lab</span>`
  return `<header class="bar">
    ${back}
    <label class="button" for="file">Import</label>
  </header>`
}

function home() {
  const empty = sessions.length
    ? ""
    : `<section class="empty">
        <h1>Import a Tendo session</h1>
        <p>Pick a .tpaf export from Files. The curves stay on this iPad.</p>
        <label class="button big" for="file">Import a session</label>
      </section>`
  const cards = sessions
    .map((session) => {
      const set = session.sets[0]
      const count = repCount(session.sets)
      return `<a class="card" href="#/s/${esc(session.id)}">
        <strong>${esc(set.exercise)}</strong>
        <span>${esc(formatTried(set.triedAt))}</span>
        <span>${count} reps · ${esc(loadList(session.sets.flatMap((item) => item.reps)))}</span>
      </a>`
    })
    .join("")
  app.innerHTML = `${header(null)}<main>${banner()}${empty}<div class="cards">${cards}</div></main>`
}

function curveFor(set, rep) {
  return analyze(rep.counts, massKg(rep.load), set.partialPercent)
}

function sessionView(session) {
  const groups = session.sets
    .map((set, setIndex) => {
      const rows = set.reps
        .map((rep, repIndex) => {
          const curve = curveFor(set, rep)
          const href = `#/s/${session.id}/${setIndex}/${repIndex}`
          return `<tr data-go="${esc(href)}" tabindex="0">
            <td data-label="Rep">${esc(rep.index)}</td>
            <td data-label="Load">${esc(formatLoad(rep.load))}</td>
            <td data-label="Mean v">${pair(velocity(rep.tendo.meanVelocity), velocity(curve.meanVelocity))}</td>
            <td data-label="Peak v">${pair(velocity(rep.tendo.peakVelocity), velocity(curve.peakVelocity))}</td>
            <td data-label="Peak power">${pair(watts(rep.tendo.peakPower), watts(curve.peakPower))}</td>
            <td data-label="Time to peak">${velocity(curve.timeToPeak)} s</td>
          </tr>`
        })
        .join("")
      const title =
        session.sets.length > 1
          ? `<h2>${esc(set.exercise)} · ${esc(formatTried(set.triedAt))}</h2>`
          : ""
      return `${title}
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Load</th>
                <th>Mean v <small>m/s</small></th>
                <th>Peak v <small>m/s</small></th>
                <th>Peak power <small>W</small></th>
                <th>Time to peak <small>s</small></th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        </div>`
    })
    .join("")
  const first = session.sets[0]
  const threshold = first.filterCm == null ? "" : `<p class="meta">Minimum movement threshold ${esc(first.filterCm)} cm.</p>`
  const note = first.note ? `<p class="meta">${esc(first.note)}</p>` : ""
  app.innerHTML = `${header("#/")}
    <main>
      ${banner()}
      <h1>${esc(first.exercise)}</h1>
      <p class="sub">${esc(formatTried(first.triedAt))} · ${repCount(session.sets)} reps</p>
      ${note}
      ${threshold}
      <p class="legend">Bold is Tendo. The number under it is computed here. Peak velocity is the fastest 9 cm.</p>
      ${groups}
      <button class="text" id="delete" type="button">Delete session</button>
    </main>`
  for (const row of document.querySelectorAll("[data-go]")) {
    const go = () => {
      location.hash = row.dataset.go
    }
    row.addEventListener("click", go)
    row.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault()
        go()
      }
    })
  }
  document.querySelector("#delete").addEventListener("click", async () => {
    if (!confirm("Delete this session from this iPad?")) return
    await deleteSession(session.id)
    sessions = sessions.filter((item) => item.id !== session.id)
    location.hash = "#/"
  })
}

function repView(session, setIndex, repIndex) {
  const set = session.sets[setIndex]
  const rep = set.reps[repIndex]
  if (!set || !rep) {
    app.innerHTML = `${header(`#/s/${esc(session.id)}`)}<main>${banner()}<h1>That rep is not in this session.</h1></main>`
    return
  }
  const curve = curveFor(set, rep)
  const forceLine = rep.tendo.peakForce == null ? "N" : `Tendo ${watts(rep.tendo.peakForce)} N`
  const prev = repIndex > 0 ? `#/s/${session.id}/${setIndex}/${repIndex - 1}` : ""
  const next = repIndex < set.reps.length - 1 ? `#/s/${session.id}/${setIndex}/${repIndex + 1}` : ""
  const link = (href, label) =>
    href ? `<a class="button ghost" href="${esc(href)}">${label}</a>` : `<span class="button ghost dead">${label}</span>`
  app.innerHTML = `${header(`#/s/${esc(session.id)}`)}
    <main>
      ${banner()}
      <h1>Rep ${esc(rep.index)}</h1>
      <p class="sub">${esc(formatLoad(rep.load))} · ${esc(set.exercise)}</p>
      <div class="stats">
        <div class="stat"><span>Mean velocity</span><b>${velocity(curve.meanVelocity)}</b><small>Tendo ${velocity(rep.tendo.meanVelocity)} m/s</small></div>
        <div class="stat"><span>Peak velocity</span><b>${velocity(curve.peakVelocity)}</b><small>Tendo ${velocity(rep.tendo.peakVelocity)}</small><small>Fastest 1 cm ${velocity(curve.peakVelocityStep)}</small></div>
        <div class="stat"><span>Peak power</span><b>${watts(curve.peakPower)}</b><small>Tendo ${watts(rep.tendo.peakPower)} W</small></div>
        <div class="stat"><span>Time to peak</span><b>${velocity(curve.timeToPeak)}</b><small>seconds</small></div>
        <div class="stat"><span>Peak force</span><b>${watts(curve.peakForce)}</b><small>${esc(forceLine)}</small></div>
      </div>
      <p class="legend">Concentric phase. The line marks time to peak velocity, the middle of the fastest 9 cm.</p>
      <section class="chart"><h2>Velocity <small>m/s</small></h2><canvas data-chart="velocity"></canvas></section>
      <section class="chart"><h2>Power <small>W</small></h2><canvas data-chart="power"></canvas></section>
      <section class="chart"><h2>Displacement <small>cm</small></h2><canvas data-chart="displacement"></canvas></section>
      <nav class="pager">${link(prev, "Previous")}${link(next, "Next")}</nav>
    </main>`
  mountCharts(curve)
}

function parseRoute() {
  const parts = location.hash.replace(/^#\/?/, "").split("/").filter(Boolean)
  if (parts[0] !== "s" || !parts[1]) return { name: "home" }
  const setIndex = Number(parts[2])
  const repIndex = Number(parts[3])
  if (Number.isInteger(setIndex) && Number.isInteger(repIndex)) {
    return { name: "rep", id: parts[1], setIndex, repIndex }
  }
  return { name: "session", id: parts[1] }
}

async function render() {
  stopObservers()
  const route = parseRoute()
  if (route.name === "home") {
    home()
    return
  }
  const session = sessions.find((item) => item.id === route.id) ?? (await getSession(route.id))
  if (!session) {
    app.innerHTML = `${header("#/")}<main>${banner()}<h1>That session is not on this iPad.</h1></main>`
    return
  }
  if (route.name === "rep") repView(session, route.setIndex, route.repIndex)
  else sessionView(session)
}

async function importFile(file) {
  notice = ""
  let text
  try {
    text = await file.text()
  } catch {
    notice = "Could not read that file."
    await render()
    return
  }
  let parsed
  try {
    parsed = parseTpaf(text)
  } catch (error) {
    notice = error instanceof Error ? error.message : "That file is not a Tendo .tpaf export."
    await render()
    return
  }
  const key = contentKey(parsed.sets)
  const existing = sessions.find((session) => session.contentKey === key)
  if (existing) {
    location.hash = `#/s/${existing.id}`
    return
  }
  const session = {
    id: crypto.randomUUID(),
    importedAt: new Date().toISOString(),
    contentKey: key,
    sets: parsed.sets,
  }
  try {
    await putSession(session)
  } catch {
    notice = "This browser blocked on-device storage. Leave private mode and try again."
    await render()
    return
  }
  sessions.push(session)
  sessions.sort((a, b) => triedAtMs(b.sets[0].triedAt) - triedAtMs(a.sets[0].triedAt))
  const target = `#/s/${session.id}`
  if (location.hash === target) await render()
  else location.hash = target
}

fileInput.addEventListener("change", () => {
  const file = fileInput.files && fileInput.files[0]
  fileInput.value = ""
  if (file) importFile(file)
})

window.addEventListener("hashchange", () => {
  notice = ""
  render()
})

listSessions()
  .then((rows) => {
    sessions = rows.sort((a, b) => triedAtMs(b.sets[0]?.triedAt) - triedAtMs(a.sets[0]?.triedAt))
  })
  .catch(() => {
    notice = "This browser blocked on-device storage. Leave private mode and try again."
  })
  .finally(() => {
    render()
  })
