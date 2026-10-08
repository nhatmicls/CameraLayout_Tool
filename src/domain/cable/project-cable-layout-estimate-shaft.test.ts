import { describe, expect, it } from 'vitest'
import { computeProjectCableEstimate } from './project-cable-layout-estimate'
import { SHAFT_MARKER_F1, SHAFT_MARKER_F3, shaftCable, shaftFourFloorProject } from './shaft-worked-example.test-fixtures'

describe('computeProjectCableEstimate - shaft warnings', () => {
  it('one "shaft-no-exit" warning when a shaft has markers but no exit anywhere - never per cable, never per floor', () => {
    const cam1 = { id: 'cam-c1', modelId: 'm', x: 1, y: 1, rotationDeg: 0, rangeM: 10 }
    const cam2 = { id: 'cam-c2', modelId: 'm', x: 1, y: 1, rotationDeg: 0, rangeM: 10 }
    const project = shaftFourFloorProject([
      { hubs: [{ ...SHAFT_MARKER_F1, trunk: undefined }] },
      { cables: [shaftCable('c1', 'sm2'), shaftCable('c2', 'sm2')], cameras: [cam1, cam2] }, // two cables, still one warning
      { hubs: [{ ...SHAFT_MARKER_F3, trunk: undefined }] },
    ])
    const result = computeProjectCableEstimate(project)
    const shaftNoExit = result.warnings.filter((w) => w.code === 'shaft-no-exit')
    expect(shaftNoExit).toHaveLength(1)
    expect(shaftNoExit[0].message).toMatch(/Main shaft/)
    // Both cables still get a run via the typed fallback - never silently excluded.
    expect(result.byFloorId.get('sf1')!.cables).toHaveLength(2)
  })

  it('no "shaft-no-exit" warning once the shaft has an exit', () => {
    const project = shaftFourFloorProject()
    expect(computeProjectCableEstimate(project).warnings.some((w) => w.code === 'shaft-no-exit')).toBe(false)
  })

  it('an unassigned cable on a several-exit shaft is excluded + warned with "shaft-exit-not-chosen", and counted', () => {
    const project = shaftFourFloorProject([{}, { cables: [shaftCable('unassigned', 'sm2')] }])
    const result = computeProjectCableEstimate(project)
    const floorEstimate = result.byFloorId.get('sf1')!
    expect(floorEstimate.cables).toHaveLength(0)
    expect(floorEstimate.unestimatedCableCount).toBe(1)
    const warning = floorEstimate.warnings.find((w) => w.code === 'shaft-exit-not-chosen')
    expect(warning?.cableId).toBe('unassigned')
    expect(warning?.message).toMatch(/no exit chosen/)
  })
})
