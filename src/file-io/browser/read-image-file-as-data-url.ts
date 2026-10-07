/**
 * Reads a user-selected floor-plan image file into a data URL + decoded
 * `HTMLImageElement`, with the guards the plan requires: file type, file
 * size, and total pixel count. Every failure path throws a plain `Error`
 * with a user-displayable message - callers show it in the notification
 * banner, nothing here touches the DOM beyond `FileReader`/`Image`.
 */
import { formatMegabytes } from '../../domain/shared/format-megabytes'

export interface DecodedPlanImage {
  dataUrl: string
  widthPx: number
  heightPx: number
  fileName: string
  /** Decoded element, reused by the canvas layer and PNG export (phase 7) so the image is only decoded once. */
  element: HTMLImageElement
}

export interface ReadImageFileResult {
  image: DecodedPlanImage
  /** Non-fatal: set when the image is large enough that Safari will downscale it on export. */
  warning: string | null
}

const ACCEPTED_MIME_TYPES = new Set(['image/png', 'image/jpeg'])
const MAX_FILE_SIZE_BYTES = 40 * 1024 * 1024 // 40 MB
const MAX_TOTAL_PIXELS = 100_000_000 // reject above this
const SAFARI_SAFE_PIXELS = 16_700_000 // warn above this (Safari canvas cap, see docs/tech-stack.md)

function formatMegapixels(pixels: number): string {
  return (pixels / 1_000_000).toFixed(1)
}

/** Wraps `FileReader.readAsDataURL` in a promise. */
function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === 'string') resolve(reader.result)
      else reject(new Error('Failed to read the file.'))
    }
    reader.onerror = () => reject(new Error('Failed to read the file. It may be locked or unreadable.'))
    reader.readAsDataURL(file)
  })
}

/** Decodes a data URL into an `HTMLImageElement`, rejecting with a user-facing message on any decode failure. */
function decodeImageElement(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const element = new Image()
    element.onload = () => {
      // decode() surfaces corrupt-image failures that `onload` alone can miss.
      element
        .decode()
        .then(() => resolve(element))
        .catch(() => reject(new Error('Image failed to decode. The file may be corrupt.')))
    }
    element.onerror = () => reject(new Error('Image failed to decode. The file may be corrupt or not a valid image.'))
    element.src = dataUrl
  })
}

/**
 * Validates, reads, and decodes a floor-plan image file. Rejects non-PNG/JPEG
 * types, files over 40 MB, and images over 100 Mpx. Returns a non-fatal
 * `warning` for images over ~16.7 Mpx (Safari export downscale notice).
 */
export async function readImageFileAsDataUrl(file: File): Promise<ReadImageFileResult> {
  if (!ACCEPTED_MIME_TYPES.has(file.type)) {
    throw new Error(`Unsupported file type "${file.type || 'unknown'}". Only PNG and JPEG images are accepted.`)
  }
  if (file.size > MAX_FILE_SIZE_BYTES) {
    throw new Error(`File is ${formatMegabytes(file.size)} MB; the maximum is ${formatMegabytes(MAX_FILE_SIZE_BYTES)} MB.`)
  }

  const dataUrl = await readAsDataUrl(file)
  const element = await decodeImageElement(dataUrl)

  const widthPx = element.naturalWidth
  const heightPx = element.naturalHeight
  const totalPixels = widthPx * heightPx

  if (totalPixels > MAX_TOTAL_PIXELS) {
    throw new Error(
      `Image is ${widthPx}x${heightPx} (${formatMegapixels(totalPixels)} Mpx); the maximum is ${formatMegapixels(MAX_TOTAL_PIXELS)} Mpx.`,
    )
  }

  const warning =
    totalPixels > SAFARI_SAFE_PIXELS
      ? `Image is ${formatMegapixels(totalPixels)} Mpx; export will be downscaled on Safari (limit ~${formatMegapixels(SAFARI_SAFE_PIXELS)} Mpx).`
      : null

  return {
    image: { dataUrl, widthPx, heightPx, fileName: file.name, element },
    warning,
  }
}
