import { describe, expect, it } from 'vitest'
import { buildFloor } from '../project-file/project-file-test-fixtures'
import { resolveImageLoadTarget } from './floor-image-load-target-resolver'

describe('resolveImageLoadTarget', () => {
  it('is "ok" when the target floor is still active and present and no project load happened', () => {
    const floors = [buildFloor({ id: 'f1' }), buildFloor({ id: 'f2' })]
    expect(resolveImageLoadTarget(floors, 'f1', 'f1', 1, 1)).toBe('ok')
  })

  it('is "floor-changed" when the user switched to a different floor while the image was loading (C2)', () => {
    const floors = [buildFloor({ id: 'f1' }), buildFloor({ id: 'f2' })]
    expect(resolveImageLoadTarget(floors, 'f2', 'f1', 1, 1)).toBe('floor-changed')
  })

  it('is "floor-changed" when the target floor was deleted while the image was loading, even if it is still "active" by id', () => {
    // Defensive: `activeFloorId` is clamped to an existing floor by every mutation, so this id
    // combination should not arise in practice, but the resolver must not claim "ok" for a
    // floor that no longer exists either way.
    const floors = [buildFloor({ id: 'f2' })] // f1 is gone
    expect(resolveImageLoadTarget(floors, 'f1', 'f1', 1, 1)).toBe('floor-changed')
  })

  it('is "floor-changed" when a whole project was opened/reset while the image was loading, even if the new active floor shares the same id (bug fix)', () => {
    // Two legacy (pre-v7) files both wrap their one floor as the same fixed `LEGACY_FLOOR_ID` -
    // the id comparison alone cannot tell this case apart from "nothing happened".
    const floors = [buildFloor({ id: 'f1' })]
    expect(resolveImageLoadTarget(floors, 'f1', 'f1', 2, 1)).toBe('floor-changed')
  })
})
