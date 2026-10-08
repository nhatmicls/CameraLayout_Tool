/**
 * Pure guard for the sum of every floor's embedded plan image. Measured in
 * base64 data-URL CHARACTERS, not bytes on disk - these characters are what
 * lands in the serialised project file's JSON text, which the schema and
 * the save-guard both cap at 80 MB (`MAX_PROJECT_TEXT_LENGTH_BYTES` in
 * `project-file-floor-schema.ts`). Adding a new image is refused above
 * `FLOOR_IMAGE_BUDGET_REFUSE_CHARS` and warned about above
 * `FLOOR_IMAGE_BUDGET_WARN_CHARS`, leaving headroom under the 80 MB file cap
 * for the rest of the project's JSON (cameras, walls, sensors, cables...).
 * No React/Konva/`src/catalog` imports (enforced by `no-react-konva-imports.test.ts`).
 */
import type { Floor } from './floor-types'

export const FLOOR_IMAGE_BUDGET_REFUSE_CHARS = 78 * 1024 * 1024
export const FLOOR_IMAGE_BUDGET_WARN_CHARS = 50 * 1024 * 1024

export type ImageBudgetVerdict = 'ok' | 'warn' | 'refuse'

/**
 * Verdict for loading `newDataUrlLength` characters onto the floor
 * `activeFloorId`: that floor's OWN current image is replaced in the sum,
 * not added on top of it - a replacement must not double-count the image it
 * is about to discard. An unknown `activeFloorId` is treated as "add on
 * top" (every floor's existing image counts, nothing is replaced).
 */
export function imageBudgetVerdict(floors: Floor[], activeFloorId: string, newDataUrlLength: number): ImageBudgetVerdict {
  const total = floors.reduce(
    (sum, floor) => sum + (floor.id === activeFloorId ? newDataUrlLength : (floor.image?.dataUrl.length ?? 0)),
    0,
  )
  if (total > FLOOR_IMAGE_BUDGET_REFUSE_CHARS) return 'refuse'
  if (total > FLOOR_IMAGE_BUDGET_WARN_CHARS) return 'warn'
  return 'ok'
}
