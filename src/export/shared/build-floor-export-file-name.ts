import { sanitizeExportFileName, sanitizeFileNameFragment } from './sanitize-export-file-name'

/**
 * The PNG export's download file name (plan decision g). A one-floor
 * project keeps today's name unchanged (`<image stem>-camera-layout.png`) -
 * required byte-for-byte by this plan's regression rule. A multi-floor
 * project's name leads with the floor part (`F2-<floor name>-<image file
 * name>`) so `sanitizeExportFileName`'s trailing-extension strip still hits
 * the IMAGE's own extension, not a floor name that happens to end in a
 * number (e.g. "Level 2.5").
 *
 * Low review fix: the floor part and the image part are sanitised
 * SEPARATELY - the floor part with `sanitizeFileNameFragment` (character
 * cleanup only, no extension guessing) and the image part with the full
 * `sanitizeExportFileName` (which correctly strips the IMAGE's own real
 * extension). Running the combined string through `sanitizeExportFileName`
 * in one pass (the original approach) finds the LAST dot in the whole
 * string and treats everything after it as a removable "extension" - when
 * the image file name has no extension of its own, that dot is the one
 * inside a floor name like "Level 2.5", so everything after it (the real
 * image name) was silently deleted. The floor part can never sanitise to
 * empty (it always starts with the literal "F{n}"), so no fallback is
 * needed for it.
 */
export function buildFloorExportFileName(floorIndex: number, floorCount: number, floorName: string, imageFileName: string): string {
  if (floorCount <= 1) return `${sanitizeExportFileName(imageFileName)}-camera-layout.png`
  const floorPart = sanitizeFileNameFragment(`F${floorIndex + 1}-${floorName}`)
  const imagePart = sanitizeExportFileName(imageFileName)
  const stem = sanitizeFileNameFragment(`${floorPart}-${imagePart}`)
  return `${stem}-camera-layout.png`
}
