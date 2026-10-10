import { describe, expect, it } from 'vitest'
import { buildFloorExportFileName } from './build-floor-export-file-name'

describe('buildFloorExportFileName', () => {
  it('is unchanged for a one-floor project, regardless of index', () => {
    expect(buildFloorExportFileName(0, 1, 'Floor 1', 'warehouse-plan.png')).toBe('warehouse-plan-device-layout.png')
  })

  it('leads with the floor part once the project has more than one floor', () => {
    expect(buildFloorExportFileName(1, 3, 'Level 2', 'warehouse-plan.png')).toBe('F2-Level-2-warehouse-plan-device-layout.png')
  })

  it('keeps a floor name ending like a file extension from eating the image name (image HAS its own extension)', () => {
    expect(buildFloorExportFileName(0, 2, 'Level 2.5', 'plan.jpg')).toBe('F1-Level-2-5-plan-device-layout.png')
  })

  it('Low review fix: a floor name with an internal dot never eats the image name when the image file has NO extension of its own', () => {
    // Before the fix, sanitizeExportFileName ran on the WHOLE combined string and found the dot
    // in "Level 2.5" as if it were a trailing extension, deleting "-plan" along with ".5".
    expect(buildFloorExportFileName(0, 2, 'Level 2.5', 'plan')).toBe('F1-Level-2-5-plan-device-layout.png')
  })

  it('falls back to the shared "floor-plan" stem when the image name has nothing printable (one floor)', () => {
    expect(buildFloorExportFileName(0, 1, 'Level 1', '🖼️.png')).toBe('floor-plan-device-layout.png')
  })

  it('a pure-emoji image name on a multi-floor project falls back to "floor-plan" for the image part only - the floor part survives', () => {
    expect(buildFloorExportFileName(0, 2, 'Level 1', '🖼️.png')).toBe('F1-Level-1-floor-plan-device-layout.png')
  })
})
