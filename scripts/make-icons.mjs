// Gera os ícones do AgileBox como PNG, sem dependências: um quadrado azul arredondado com três
// colunas brancas (o quadro kanban). Uso: node scripts/make-icons.mjs
import { Buffer } from 'node:buffer'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { deflateSync } from 'node:zlib'
import console from 'node:console'

const outDir = resolve(dirname(fileURLToPath(import.meta.url)), '../apps/desktop/resources')

function crc32(buffer) {
  let crc = ~0
  for (const byte of buffer) {
    crc ^= byte
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1))
  }
  return ~crc >>> 0
}

function chunk(type, data) {
  const body = Buffer.concat([Buffer.from(type), data])
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length)
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body))
  return Buffer.concat([length, body, crc])
}

function insideRoundedRect(x, y, left, top, right, bottom, radius) {
  if (x < left || x > right || y < top || y > bottom) return false
  const cx = Math.min(Math.max(x, left + radius), right - radius)
  const cy = Math.min(Math.max(y, top + radius), bottom - radius)
  return (x - cx) ** 2 + (y - cy) ** 2 <= radius ** 2
}

function renderIcon(size) {
  const raw = Buffer.alloc((size * 4 + 1) * size)
  const samples = 3 // suavização por sobreamostragem
  for (let y = 0; y < size; y += 1) {
    raw[y * (size * 4 + 1)] = 0
    for (let x = 0; x < size; x += 1) {
      let blue = 0
      let white = 0
      for (let sy = 0; sy < samples; sy += 1) {
        for (let sx = 0; sx < samples; sx += 1) {
          const u = (x + (sx + 0.5) / samples) / size
          const v = (y + (sy + 0.5) / samples) / size
          if (!insideRoundedRect(u, v, 0.04, 0.04, 0.96, 0.96, 0.22)) continue
          blue += 1
          const columns = [
            [0.2, 0.18, 0.4, 0.8],
            [0.4, 0.18, 0.6, 0.62],
            [0.6, 0.18, 0.8, 0.72],
          ]
          if (
            columns.some(([l, t, r, b]) => insideRoundedRect(u, v, l + 0.02, t, r - 0.02, b, 0.04))
          )
            white += 1
        }
      }
      const total = samples * samples
      const coverage = blue / total
      const whiteShare = blue === 0 ? 0 : white / blue
      const offset = y * (size * 4 + 1) + 1 + x * 4
      raw[offset] = Math.round(11 + (255 - 11) * whiteShare)
      raw[offset + 1] = Math.round(102 + (255 - 102) * whiteShare)
      raw[offset + 2] = Math.round(228 + (255 - 228) * whiteShare)
      raw[offset + 3] = Math.round(255 * coverage)
    }
  }
  const header = Buffer.alloc(13)
  header.writeUInt32BE(size, 0)
  header.writeUInt32BE(size, 4)
  header[8] = 8 // 8 bits por canal
  header[9] = 6 // RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

mkdirSync(outDir, { recursive: true })
for (const [name, size] of [
  ['tray.png', 32],
  ['icon.png', 256],
]) {
  writeFileSync(resolve(outDir, name), renderIcon(size))
  console.log(`gerado ${name} (${size}×${size})`)
}
