import { describe, expect, it } from 'vitest'
import { buildFloor } from '../project-file/project-file-test-fixtures'
import {
  FLOOR_IMAGE_BUDGET_REFUSE_CHARS,
  FLOOR_IMAGE_BUDGET_WARN_CHARS,
  imageBudgetVerdict,
  totalFloorImageChars,
} from './floor-image-budget'

function floorWithImageChars(id: string, chars: number) {
  return buildFloor({ id, image: { dataUrl: 'x'.repeat(chars), widthPx: 10, heightPx: 10, fileName: 'a.png' } })
}

function floorWithNoImage(id: string) {
  return buildFloor({ id, image: null, scale: null })
}

describe('totalFloorImageChars', () => {
  it('sums every floor image data-URL length, skipping image-less floors', () => {
    const floors = [floorWithImageChars('f1', 100), floorWithNoImage('f2'), floorWithImageChars('f3', 50)]
    expect(totalFloorImageChars(floors)).toBe(150)
  })

  it('is 0 for a project with no images at all', () => {
    expect(totalFloorImageChars([floorWithNoImage('f1')])).toBe(0)
  })
})

describe('imageBudgetVerdict', () => {
  it('is "ok" well under both thresholds', () => {
    const floors = [floorWithImageChars('f1', 1000)]
    expect(imageBudgetVerdict(floors, 'f1', 2000)).toBe('ok')
  })

  it('is "ok" exactly at the warn threshold (strictly greater-than triggers warn)', () => {
    const floors = [floorWithNoImage('f1')]
    expect(imageBudgetVerdict(floors, 'f1', FLOOR_IMAGE_BUDGET_WARN_CHARS)).toBe('ok')
  })

  it('is "warn" just above the warn threshold', () => {
    const floors = [floorWithNoImage('f1')]
    expect(imageBudgetVerdict(floors, 'f1', FLOOR_IMAGE_BUDGET_WARN_CHARS + 1)).toBe('warn')
  })

  it('is "warn" exactly at the refuse threshold (strictly greater-than triggers refuse)', () => {
    const floors = [floorWithNoImage('f1')]
    expect(imageBudgetVerdict(floors, 'f1', FLOOR_IMAGE_BUDGET_REFUSE_CHARS)).toBe('warn')
  })

  it('is "refuse" just above the refuse threshold', () => {
    const floors = [floorWithNoImage('f1')]
    expect(imageBudgetVerdict(floors, 'f1', FLOOR_IMAGE_BUDGET_REFUSE_CHARS + 1)).toBe('refuse')
  })

  it('REPLACING the active floor image does not double-count its own current image', () => {
    // Floor f1 already holds a 45 MB image; replacing it with another 45 MB image must stay
    // "ok" (90 MB summed would wrongly refuse) because the old one is discarded, not kept.
    const fortyFiveMb = 45 * 1024 * 1024
    const floors = [floorWithImageChars('f1', fortyFiveMb)]
    expect(imageBudgetVerdict(floors, 'f1', fortyFiveMb)).toBe('ok')
  })

  it('ADDING a new floor image on top of other floors counts both', () => {
    const fortyMb = 40 * 1024 * 1024
    const floors = [floorWithImageChars('f1', fortyMb), floorWithNoImage('f2')]
    // f2 (image-less) gets a 40 MB image while f1 already holds 40 MB -> 80 MB total -> refuse.
    expect(imageBudgetVerdict(floors, 'f2', fortyMb)).toBe('refuse')
  })

  it('an unknown activeFloorId matches no floor to replace, so the new length is not counted at all', () => {
    // Defensive-only path: in practice `activeFloorId` always names a real floor. With no match,
    // the sum is just the existing floors' own images - still a safe (never over-permissive) answer.
    const floors = [floorWithImageChars('f1', FLOOR_IMAGE_BUDGET_WARN_CHARS)]
    expect(imageBudgetVerdict(floors, 'does-not-exist', 10)).toBe('ok')
  })
})
