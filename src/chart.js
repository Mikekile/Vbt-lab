function bounds(values) {
  let min = 0
  let max = 0
  for (const value of values) {
    if (value < min) min = value
    if (value > max) max = value
  }
  if (max - min < 1e-9) max = min + 1
  const pad = (max - min) * 0.08
  if (min === 0) return { min: 0, max: max + pad }
  if (max === 0) return { min: min - pad, max: 0 }
  return { min: min - pad, max: max + pad }
}

function formatTick(value) {
  const abs = Math.abs(value)
  if (abs >= 100) return String(Math.round(value))
  if (abs >= 10) return value.toFixed(1)
  return value.toFixed(2)
}

export function drawSeries(canvas, { points, marker, color }) {
  const width = canvas.clientWidth
  const height = canvas.clientHeight
  if (width < 20 || height < 20 || !points.length) return
  const ratio = window.devicePixelRatio || 1
  canvas.width = Math.round(width * ratio)
  canvas.height = Math.round(height * ratio)
  const ctx = canvas.getContext("2d")
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0)
  ctx.clearRect(0, 0, width, height)

  const pad = { left: 52, right: 12, top: 16, bottom: 32 }
  const plotW = width - pad.left - pad.right
  const plotH = height - pad.top - pad.bottom
  const y = bounds(points.map((point) => point.y))
  const duration = points[points.length - 1].t
  const xOf = (t) => pad.left + (duration === 0 ? 0 : (t / duration) * plotW)
  const yOf = (value) => pad.top + ((y.max - value) / (y.max - y.min)) * plotH

  ctx.font = "13px ui-sans-serif, system-ui, sans-serif"
  ctx.strokeStyle = "#e7e0d4"
  ctx.fillStyle = "#57534e"
  ctx.lineWidth = 1
  for (let i = 0; i <= 4; i++) {
    const value = y.max - ((y.max - y.min) * i) / 4
    const py = yOf(value)
    ctx.beginPath()
    ctx.moveTo(pad.left, py)
    ctx.lineTo(width - pad.right, py)
    ctx.stroke()
    ctx.fillText(formatTick(value), 4, py + 4)
  }

  ctx.fillText("0 s", pad.left, height - 10)
  const endLabel = `${duration.toFixed(2)} s`
  ctx.fillText(endLabel, width - pad.right - ctx.measureText(endLabel).width, height - 10)

  ctx.beginPath()
  points.forEach((point, index) => {
    const px = xOf(point.t)
    const py = yOf(point.y)
    if (index === 0) ctx.moveTo(px, py)
    else ctx.lineTo(px, py)
  })
  ctx.strokeStyle = color
  ctx.lineWidth = 2
  ctx.stroke()

  if (marker == null || duration === 0) return
  const mx = Math.min(pad.left + plotW, Math.max(pad.left, xOf(marker)))
  ctx.beginPath()
  ctx.moveTo(mx, pad.top)
  ctx.lineTo(mx, pad.top + plotH)
  ctx.strokeStyle = "#1c1917"
  ctx.lineWidth = 1.5
  ctx.stroke()
}
