/**
 * Pure guard against the image-load race (C2): loading a floor-plan image
 * file is async (`FileReader` + `Image.decode()`), long enough that the
 * user can switch floors - or delete the one they were on - before it
 * finishes. `setImage` always patches whichever floor is ACTIVE at the
 * moment it is called, so applying a decode that started for a different
 * floor would silently land on, and wipe, the WRONG floor. Call this with
 * the floor id captured right before the async read started
 * (`targetFloorId`) and the live state read right after it finished.
 *
 * Bug fix: a plain id comparison also reads "ok" when a WHOLE PROJECT was
 * opened while the decode was still in flight, if the newly loaded project's
 * active floor happens to share an id with the one the load started on (two
 * legacy, pre-v7 files both wrap their one floor as the same fixed
 * `LEGACY_FLOOR_ID`) - the stale image would then land on the just-opened
 * project's floor. `loadSeq` (bumped on every `replaceProject`/`resetProject`
 * call, regardless of whether the id happens to repeat) is pinned the same
 * way as `targetFloorId` and checked here too.
 */
import type { Floor } from './floor-types'

export type ImageLoadTargetVerdict = 'ok' | 'floor-changed'

/**
 * `'ok'` only when the floor that was active when the load started is
 * STILL both active and present, AND no project load (`replaceProject`/
 * `resetProject`) happened in between. Anything else (the user switched
 * floors, deleted the one they were on, or opened/reset the whole project
 * while the image was loading) is `'floor-changed'` - the caller must not
 * apply the decoded image.
 */
export function resolveImageLoadTarget(
  floors: Floor[],
  activeFloorId: string,
  targetFloorId: string,
  loadSeq: number,
  targetLoadSeq: number,
): ImageLoadTargetVerdict {
  if (loadSeq !== targetLoadSeq) return 'floor-changed'
  if (activeFloorId !== targetFloorId) return 'floor-changed'
  if (!floors.some((floor) => floor.id === targetFloorId)) return 'floor-changed'
  return 'ok'
}
