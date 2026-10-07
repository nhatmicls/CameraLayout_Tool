import { deflateSync } from 'node:zlib'

/**
 * Minimal valid PNG builder (no external deps): a solid-colour, uncompressed-
 * filter RGB image. Hand-typed base64 PNGs are easy to get subtly wrong;
 * building real bytes with Node's own `zlib` guarantees a real browser can
 * decode them. Shared by every e2e spec that needs a throwaway floor-plan
 * image (single-floor and multi-floor smoke tests alike).
 */
function crc32(buf: Buffer): number {
  let crc = 0xffffffff
  for (const byte of buf) {
    crc ^= byte
    for (let bit = 0; bit < 8; bit++) {
      crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1
    }
  }
  return (crc ^ 0xffffffff) >>> 0
}

function pngChunk(type: string, data: Buffer): Buffer {
  const typeBuf = Buffer.from(type, 'ascii')
  const lengthBuf = Buffer.alloc(4)
  lengthBuf.writeUInt32BE(data.length, 0)
  const crcInput = Buffer.concat([typeBuf, data])
  const crcBuf = Buffer.alloc(4)
  crcBuf.writeUInt32BE(crc32(crcInput), 0)
  return Buffer.concat([lengthBuf, typeBuf, data, crcBuf])
}

/** Builds a `width x height` solid-colour PNG as real bytes. Highly compressible (one colour), so even a large pixel count stays a small file - useful for stress-testing decode/redraw cost without a large file-size budget hit. */
export function buildSolidColorPng(width: number, height: number, rgb: [number, number, number]): Buffer {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  const ihdrData = Buffer.alloc(13)
  ihdrData.writeUInt32BE(width, 0)
  ihdrData.writeUInt32BE(height, 4)
  ihdrData[8] = 8 // bit depth
  ihdrData[9] = 2 // colour type: RGB
  ihdrData[10] = 0 // compression
  ihdrData[11] = 0 // filter
  ihdrData[12] = 0 // interlace
  const ihdr = pngChunk('IHDR', ihdrData)

  const [r, g, b] = rgb
  const rows: Buffer[] = []
  for (let y = 0; y < height; y++) {
    const row = Buffer.alloc(1 + width * 3)
    row[0] = 0 // per-row filter: none
    for (let x = 0; x < width; x++) {
      row[1 + x * 3] = r
      row[1 + x * 3 + 1] = g
      row[1 + x * 3 + 2] = b
    }
    rows.push(row)
  }
  const idat = pngChunk('IDAT', deflateSync(Buffer.concat(rows)))
  const iend = pngChunk('IEND', Buffer.alloc(0))
  return Buffer.concat([signature, ihdr, idat, iend])
}
