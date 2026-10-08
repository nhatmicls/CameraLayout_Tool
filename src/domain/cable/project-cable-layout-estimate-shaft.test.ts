import { describe, expect, it } from 'vitest'
import { DEFAULT_CABLE_SETTINGS } from './cable-layout-types'
import { computeProjectCableEstimate } from './project-cable-layout-estimate'
import { SHAFT_MARKER_F1, SHAFT_MARKER_F2, SHAFT_MARKER_F3, shaftCable, shaftFourFloorProject } from './shaft-worked-example.test-fixtures'

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

describe('computeProjectCableEstimate - shaft marker with NO exit: 0 m at the marker + its own extraLengthM, no routeHeightM term (decision D2)', () => {
  const cam1 = { id: 'cam-c1', modelId: 'm', x: SHAFT_MARKER_F2.x, y: SHAFT_MARKER_F2.y, rotationDeg: 0, rangeM: 10 } // AT the marker: horizM = 0

  /** Every term but the shaft's own `extraLengthM` zeroed out, so the whole project-level run is exactly that one number - the hand-computed assertion the review asked for. */
  function noExitProject(extraLengthM: number) {
    const project = shaftFourFloorProject([
      { hubs: [{ ...SHAFT_MARKER_F1, trunk: undefined }] }, // no exit on F1 either
      { cameras: [cam1], cables: [shaftCable('c1', 'sm2')], hubs: [{ ...SHAFT_MARKER_F2, extraLengthM }] },
      { hubs: [{ ...SHAFT_MARKER_F3, trunk: undefined }] }, // no exit on F3 either - whole shaft has NONE
    ])
    return { ...project, cableSettings: { ...DEFAULT_CABLE_SETTINGS, wastePercent: 0, deviceEndSlackM: 0, hubEndSlackM: 0 } }
  }

  it('extraLengthM 0 -> the hub-end contribution is 0 m, full run 0 m', () => {
    const result = computeProjectCableEstimate(noExitProject(0))
    const estimate = result.byFloorId.get('sf1')!.cables[0]
    expect(estimate.hubDropM).toBe(0) // no routeHeightM term at all - NOT |routeHeightM(3) - mountHeightM(0)| = 3
    expect(estimate.hubExtraM).toBe(0)
    expect(estimate.run.nominal).toBe(0) // horizM 0 + deviceRiseM 0 + slackM 0 + beyond 0
  })

  it('extraLengthM 7 -> the hub-end contribution is exactly 7 m, full run 7 m', () => {
    const result = computeProjectCableEstimate(noExitProject(7))
    const estimate = result.byFloorId.get('sf1')!.cables[0]
    expect(estimate.hubDropM).toBe(0)
    expect(estimate.hubExtraM).toBe(7)
    expect(estimate.run.nominal).toBe(7) // horizM 0 + deviceRiseM 0 + slackM 0 + beyond 7
  })
})

describe('computeProjectCableEstimate - BOM-level cable labels on a shaft (test gap: executed fixture)', () => {
  const cam1 = { id: 'cam-c1', modelId: 'm', x: 1, y: 1, rotationDeg: 0, rangeM: 10 }

  it('C1-T1 on the floor reads "F2_C1-T1" in the project totals - no exit suffix with a SINGLE exit', () => {
    // Drop F3's trunk (SHAFT_MARKER_F3) so the shaft has exactly one exit, on F1.
    const project = shaftFourFloorProject([
      {},
      { cameras: [cam1], cables: [shaftCable('c1', 'sm2')] }, // F2: implicit exit (only one exists)
      { hubs: [{ ...SHAFT_MARKER_F3, trunk: undefined }] },
    ])
    const result = computeProjectCableEstimate(project)
    const total = result.totals.find((t) => t.type.id === 'cat6-utp')!
    expect(total.labels).toContain('F2_C1-T1')
    expect(total.labels.some((label) => label.includes('>'))).toBe(false)
  })

  it('C1-T1>F3 in the project totals once the shaft has SEVERAL exits and this cable chose F3', () => {
    // Default fixture already has two exits (F1 and F3); F2's cable explicitly picks F3 (floor id "sf2").
    const project = shaftFourFloorProject([{}, { cameras: [cam1], cables: [shaftCable('c1', 'sm2', 'sf2')] }])
    const result = computeProjectCableEstimate(project)
    const total = result.totals.find((t) => t.type.id === 'cat6-utp')!
    expect(total.labels).toContain('F2_C1-T1>F3')
  })
})
