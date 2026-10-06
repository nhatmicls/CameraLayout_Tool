import type { RgbaSample } from './is-pixel-data-blank'

/** Canvas helpers of the PNG export, moved out of `export-plan-png.ts` (pure move) to keep that file under 200 lines. */

export function canvasToPngBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob)
      else reject(new Error('Canvas failed to encode a PNG blob.'))
    }, 'image/png')
  })
}

/** Samples a 3x3 grid spread across the canvas (not just corners, which the white strip background would dominate) for the post-render blank check. */
export function sampleCanvasPixels(ctx: CanvasRenderingContext2D, widthPx: number, heightPx: number): RgbaSample[] {
  const fractions = [0.1, 0.5, 0.9]
  const samples: RgbaSample[] = []
  for (const fx of fractions) {
    for (const fy of fractions) {
      const x = Math.min(widthPx - 1, Math.max(0, Math.round(fx * widthPx)))
      const y = Math.min(heightPx - 1, Math.max(0, Math.round(fy * heightPx)))
      const [r, g, b, a] = ctx.getImageData(x, y, 1, 1).data
      samples.push([r, g, b, a])
    }
  }
  return samples
}
