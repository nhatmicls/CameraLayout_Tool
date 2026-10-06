import { z } from 'zod'
import type { Wall } from './project-types'
import { hasAnyProperWallCrossing } from './wall-crossing-detection'
import { MIN_WALL_LENGTH_PX, wallSegmentLengthPx } from './wall-segment-geometry'

/** Split out of `project-file-schema.ts` (phase 2 contingency) to keep that file under 200 lines. */
export const MAX_WALLS = 1000

export const WALLS_CROSS_WARNING =
  'Some walls cross each other. Coverage is still calculated, but walls are expected to meet at endpoints.'

const WALL_COORD_LIMIT_PX = 1_000_000
const wallCoord = z.number().finite().gte(-WALL_COORD_LIMIT_PX).lte(WALL_COORD_LIMIT_PX)

export const wallSchema = z.strictObject({
  id: z.string().min(1).max(100),
  kind: z.enum(['opaque', 'glass']),
  x1: wallCoord,
  y1: wallCoord,
  x2: wallCoord,
  y2: wallCoord,
})

/** Drops walls a hand-edited file can carry but the app never creates (too short, repeated id), and flags crossings once. */
export function normaliseLoadedWalls(walls: readonly Wall[], warnings: string[]): Wall[] {
  const seenIds = new Set<string>()
  const kept = walls.filter((wall) => {
    if (wallSegmentLengthPx(wall) < MIN_WALL_LENGTH_PX) {
      warnings.push(`Wall "${wall.id}" is shorter than ${MIN_WALL_LENGTH_PX} px; dropped.`)
      return false
    }
    if (seenIds.has(wall.id)) {
      warnings.push(`Wall id "${wall.id}" is used more than once; the repeat was dropped.`)
      return false
    }
    seenIds.add(wall.id)
    return true
  })
  if (hasAnyProperWallCrossing(kept)) warnings.push(WALLS_CROSS_WARNING)
  return kept
}
