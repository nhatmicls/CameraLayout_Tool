/**
 * Conservative canvas-size limits shared by every export path (see
 * `docs/tech-stack.md` "Known limits"): Safari/iOS caps a canvas around
 * 16.7M total pixels and ~16,384px on a side. Chrome/Firefox allow more,
 * but failing above these limits fails *silently* on Safari (a blank
 * canvas, no exception) - so the app targets the lowest common denominator
 * rather than trying to detect the browser.
 */
export const SAFARI_SAFE_MAX_CANVAS_PIXELS = 16_777_216
export const SAFARI_SAFE_MAX_CANVAS_SIDE_PX = 16_384

/**
 * Probes whether a canvas of the given size can actually be allocated and
 * drawn to, by creating it, filling one corner pixel, and reading that
 * pixel back. Some browsers silently cap canvas allocation (no exception,
 * just a canvas that never draws anything), so "did `createElement`
 * throw" alone is not a reliable signal. Always releases the probe canvas
 * before returning.
 */
export function canAllocateCanvas(widthPx: number, heightPx: number): boolean {
  let canvas: HTMLCanvasElement | null = null
  try {
    canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(widthPx))
    canvas.height = Math.max(1, Math.round(heightPx))

    const ctx = canvas.getContext('2d')
    if (!ctx) return false

    const probeX = canvas.width - 1
    const probeY = canvas.height - 1
    ctx.fillStyle = '#fff'
    ctx.fillRect(probeX, probeY, 1, 1)
    const pixel = ctx.getImageData(probeX, probeY, 1, 1).data
    return pixel[3] > 0 // alpha channel: non-zero means the fill was actually drawn and read back
  } catch {
    return false
  } finally {
    if (canvas) {
      canvas.width = 0
      canvas.height = 0
    }
  }
}
