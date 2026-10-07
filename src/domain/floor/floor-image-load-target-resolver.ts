/**
 * Pure guard against the image-load race (C2): loading a floor-plan image
 * file is async (`FileReader` + `Image.decode()`), long enough that the
 * user can switch floors - or delete the one they were on - before it
 * finishes. `setImage` always patches whichever floor is ACTIVE at the
 * moment it is called, so applying a decode that started for a different
 * floor would silently land on, and wipe, the WRONG floor. Call this with
 * the floor id captured right before the async read started
 * (`targetFloorId`) and the live state read right after it finished.
 */
import type { Floor } from './floor-types'

export type ImageLoadTargetVerdict = 'ok' | 'floor-changed'

/**
 * `'ok'` only when the floor that was active when the load started is
 * STILL both active and present. Anything else (the user switched floors,
 * or `targetFloorId` was deleted while the image was loading) is
 * `'floor-changed'` - the caller must not apply the decoded image.
 */
export function resolveImageLoadTarget(floors: Floor[], activeFloorId: string, targetFloorId: string): ImageLoadTargetVerdict {
  if (activeFloorId !== targetFloorId) return 'floor-changed'
  if (!floors.some((floor) => floor.id === targetFloorId)) return 'floor-changed'
  return 'ok'
}
