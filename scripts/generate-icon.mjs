import fs from 'node:fs'
import path from 'node:path'
import zlib from 'node:zlib'

function crc32(buf) {
  let crc = 0xffffffff
  for (let i = 0; i < buf.length; i++) {
    crc ^= buf[i]
    for (let j = 0; j < 8; j++) {
      const mask = -(crc & 1)
      crc = (crc >>> 1) ^ (0xedb88320 & mask)
    }
  }
  return (crc ^ 0xffffffff) >>> 0
}

function pngChunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii')
  const lenBuf = Buffer.alloc(4)
  lenBuf.writeUInt32BE(data.length, 0)
  const crcBuf = Buffer.alloc(4)
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0)
  return Buffer.concat([lenBuf, typeBuf, data, crcBuf])
}

function writePng({ width, height, rgba }) {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8
  ihdr[9] = 6
  ihdr[10] = 0
  ihdr[11] = 0
  ihdr[12] = 0

  const stride = width * 4
  const raw = Buffer.alloc((stride + 1) * height)
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, y * stride + stride)
  }

  const idat = zlib.deflateSync(raw, { level: 9 })
  const chunks = [pngChunk('IHDR', ihdr), pngChunk('IDAT', idat), pngChunk('IEND', Buffer.alloc(0))]
  return Buffer.concat([signature, ...chunks])
}

function fillRect(buf, width, x, y, w, h, r, g, b, a) {
  const height = Math.floor(buf.length / (width * 4))
  const x0 = Math.max(0, x)
  const y0 = Math.max(0, y)
  const x1 = Math.min(width, x + w)
  const y1 = Math.min(height, y + h)
  for (let yy = y0; yy < y1; yy++) {
    for (let xx = x0; xx < x1; xx++) {
      const i = (yy * width + xx) * 4
      buf[i] = r
      buf[i + 1] = g
      buf[i + 2] = b
      buf[i + 3] = a
    }
  }
}

function blendPixel(buf, width, x, y, r, g, b, a) {
  if (x < 0 || y < 0 || x >= width) return
  const height = Math.floor(buf.length / (width * 4))
  if (y >= height) return
  const i = (y * width + x) * 4
  const dstA = buf[i + 3] / 255
  const srcA = a / 255
  const outA = srcA + dstA * (1 - srcA)
  if (outA <= 0) return
  const outR = (r * srcA + buf[i] * dstA * (1 - srcA)) / outA
  const outG = (g * srcA + buf[i + 1] * dstA * (1 - srcA)) / outA
  const outB = (b * srcA + buf[i + 2] * dstA * (1 - srcA)) / outA
  buf[i] = Math.round(outR)
  buf[i + 1] = Math.round(outG)
  buf[i + 2] = Math.round(outB)
  buf[i + 3] = Math.round(outA * 255)
}

function fillCircle(buf, width, cx, cy, radius, r, g, b, a) {
  const rr = radius * radius
  const x0 = Math.floor(cx - radius)
  const x1 = Math.ceil(cx + radius)
  const y0 = Math.floor(cy - radius)
  const y1 = Math.ceil(cy + radius)
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const dx = x - cx
      const dy = y - cy
      const d2 = dx * dx + dy * dy
      if (d2 <= rr) {
        blendPixel(buf, width, x, y, r, g, b, a)
      }
    }
  }
}

function drawCart(buf, width, height) {
  const s = Math.floor(Math.min(width, height) / 256)
  const ox = Math.floor(width * 0.5)
  const oy = Math.floor(height * 0.52)
  const stroke = Math.max(2, 6 * s)
  const white = [255, 255, 255, 255]

  fillRect(buf, width, ox - 64 * s, oy - 28 * s, 110 * s, stroke, ...white)
  fillRect(buf, width, ox - 52 * s, oy - 24 * s, stroke, 58 * s, ...white)
  fillRect(buf, width, ox - 52 * s, oy + 30 * s, 98 * s, stroke, ...white)

  for (let i = 0; i < 6; i++) {
    fillRect(buf, width, ox - 52 * s + i * 18 * s, oy - 24 * s, stroke, 54 * s, ...white)
  }

  fillRect(buf, width, ox - 88 * s, oy - 52 * s, stroke, 86 * s, ...white)
  for (let k = 0; k < stroke; k++) {
    const x0 = ox - 88 * s + k
    const y0 = oy - 52 * s
    const x1 = ox - 52 * s
    const y1 = oy - 24 * s
    const dx = x1 - x0
    const dy = y1 - y0
    const steps = Math.max(Math.abs(dx), Math.abs(dy))
    for (let t = 0; t <= steps; t++) {
      const x = Math.round(x0 + (dx * t) / steps)
      const y = Math.round(y0 + (dy * t) / steps)
      blendPixel(buf, width, x, y, 255, 255, 255, 255)
    }
  }

  fillCircle(buf, width, ox - 26 * s, oy + 54 * s, 14 * s, 255, 255, 255, 255)
  fillCircle(buf, width, ox + 42 * s, oy + 54 * s, 14 * s, 255, 255, 255, 255)
}

function generateIconPng(size) {
  const width = size
  const height = size
  const rgba = Buffer.alloc(width * height * 4)

  fillRect(rgba, width, 0, 0, width, height, 16, 48, 140, 255)
  fillCircle(rgba, width, Math.floor(width * 0.5), Math.floor(height * 0.5), Math.floor(width * 0.46), 33, 98, 255, 255)
  drawCart(rgba, width, height)
  return writePng({ width, height, rgba })
}

function writeIcoFromPng(pngBuf) {
  const header = Buffer.alloc(6)
  header.writeUInt16LE(0, 0)
  header.writeUInt16LE(1, 2)
  header.writeUInt16LE(1, 4)

  const entry = Buffer.alloc(16)
  entry[0] = 0
  entry[1] = 0
  entry[2] = 0
  entry[3] = 0
  entry.writeUInt16LE(1, 4)
  entry.writeUInt16LE(32, 6)
  entry.writeUInt32LE(pngBuf.length, 8)
  entry.writeUInt32LE(6 + 16, 12)

  return Buffer.concat([header, entry, pngBuf])
}

const root = process.cwd()
const srcPng = path.join(root, 'scripts', 'icon-source.png')
const outPng = path.join(root, 'public', 'app-icon.png')
const outIco = path.join(root, 'build', 'icon.ico')

fs.mkdirSync(path.dirname(outPng), { recursive: true })
fs.mkdirSync(path.dirname(outIco), { recursive: true })

const png = fs.existsSync(srcPng) ? fs.readFileSync(srcPng) : generateIconPng(256)
const ico = writeIcoFromPng(png)

fs.writeFileSync(outPng, png)
fs.writeFileSync(outIco, ico)
