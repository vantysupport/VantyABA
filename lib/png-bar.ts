// Tiny synchronous PNG renderer for the Word reports' progress bars: a rounded track, a rounded
// fill and a dashed goal marker, anti-aliased. No text (labels stay as Word text), no native deps.

import { deflateSync } from 'zlib'

const CRC_TABLE = (() => {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c >>> 0
  }
  return t
})()

function crc32(buf: Buffer): number {
  let c = 0xffffffff
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function chunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length)
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td))
  return Buffer.concat([len, td, crc])
}

function encodePng(w: number, h: number, rgba: Uint8Array): Buffer {
  const raw = Buffer.alloc((w * 4 + 1) * h)
  for (let y = 0; y < h; y++) {
    raw[y * (w * 4 + 1)] = 0 // filter: none
    Buffer.from(rgba.buffer, rgba.byteOffset + y * w * 4, w * 4).copy(raw, y * (w * 4 + 1) + 1)
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4)
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0)),
  ])
}

const hex = (c: string) => [parseInt(c.slice(0, 2), 16), parseInt(c.slice(2, 4), 16), parseInt(c.slice(4, 6), 16)]

// Signed distance to a rounded rectangle spanning x∈[x0,x1], full height, radius r.
function roundedCoverage(px: number, py: number, x0: number, x1: number, h: number, r: number): number {
  if (x1 - x0 <= 0) return 0
  const rr = Math.min(r, (x1 - x0) / 2)
  const cx = Math.min(Math.max(px, x0 + rr), x1 - rr)
  const cy = Math.min(Math.max(py, rr), h - rr)
  const d = Math.hypot(px - cx, py - cy) - rr
  return Math.min(1, Math.max(0, 0.5 - d))
}

/** Horizontal progress bar as PNG. `pct` and `metaPct` in 0–100; colors as 'RRGGBB'. Rendered at 2× for sharpness. */
export function barraPng(pct: number, color: string, opts: { metaPct?: number; track?: string; width?: number; height?: number } = {}): { data: Buffer; width: number; height: number } {
  const W = (opts.width ?? 300) * 2
  const H = (opts.height ?? 14) * 2
  const r = H / 2
  const track = hex(opts.track ?? 'E8EEF6')
  const fill = hex(color)
  const meta = hex('F59E0B')
  const fillEnd = (Math.min(100, Math.max(0, pct)) / 100) * W
  const metaX = opts.metaPct != null ? Math.round((opts.metaPct / 100) * W) : -1
  const px = new Uint8Array(W * H * 4)

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const sx = x + 0.5, sy = y + 0.5
      const tA = roundedCoverage(sx, sy, 0, W, H, r)
      const fA = roundedCoverage(sx, sy, 0, fillEnd, H, r)
      let [R, G, B] = track
      if (fA > 0) { R = R + (fill[0] - R) * fA; G = G + (fill[1] - G) * fA; B = B + (fill[2] - B) * fA }
      let A = tA
      // Goal marker: 2px-wide dashed vertical line, drawn over the bar
      if (metaX >= 0 && Math.abs(x - metaX) <= 1 && Math.floor(y / 4) % 2 === 0) { [R, G, B] = meta; A = 1 }
      const i = (y * W + x) * 4
      px[i] = R; px[i + 1] = G; px[i + 2] = B; px[i + 3] = Math.round(A * 255)
    }
  }
  return { data: encodePng(W, H, px), width: W / 2, height: H / 2 }
}
