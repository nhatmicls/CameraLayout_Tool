/**
 * Pure "did anything actually get drawn" check for an exported canvas.
 * Canvas size limits fail silently in some browsers (a canvas above the
 * internal cap renders fully blank instead of throwing) - the only reliable
 * guard is to sample a handful of points spread across the rendered result
 * and check they are not all identical. A real export (plan photo + at
 * least the white strip background + dark table text) always has pixel
 * variance; a failed one does not, regardless of whether the failure mode
 * is "all white" or "all transparent black".
 */
export type RgbaSample = readonly [r: number, g: number, b: number, a: number]

export function isPixelDataBlank(samples: readonly RgbaSample[]): boolean {
  if (samples.length === 0) return true

  const [r0, g0, b0, a0] = samples[0]
  return samples.every(([r, g, b, a]) => r === r0 && g === g0 && b === b0 && a === a0)
}
