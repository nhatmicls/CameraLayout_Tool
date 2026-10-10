import { describe, expect, it } from 'vitest'
import { DEFAULT_CABLE_SETTINGS } from './cable-layout-types'
import { computeProjectCableEstimate } from './project-cable-layout-estimate'
import { SHAFT_MARKER_F2, shaftCable, shaftFourFloorProject } from './shaft-worked-example.test-fixtures'

describe('computeProjectCableEstimate - a cable not routed beyond its shaft', () => {
  const cam1 = { id: 'cam-c1', modelId: 'm', x: 1, y: 1, rotationDeg: 0, rangeM: 10 }
  const cam2 = { id: 'cam-c2', modelId: 'm', x: 1, y: 1, rotationDeg: 0, rangeM: 10 }

  it('is still estimated (up to the shaft), never excluded, and gets ONE named "shaft-cable-not-routed" notice each', () => {
    const project = shaftFourFloorProject([{}, { cables: [shaftCable('c1', 'sm2'), shaftCable('c2', 'sm2', 'sf0')], cameras: [cam1, cam2] }])
    const result = computeProjectCableEstimate(project)
    const floorEstimate = result.byFloorId.get('sf1')!
    expect(floorEstimate.cables).toHaveLength(2)
    expect(floorEstimate.unestimatedCableCount).toBe(0)
    const notices = result.warnings.filter((w) => w.code === 'shaft-cable-not-routed')
    expect(notices.map((w) => w.cableId)).toEqual(['c1']) // c2 is routed - no notice
    expect(notices[0].message).toMatch(/^F2_C1_\?: not routed beyond its shaft yet/)
  })

  it('a route on a floor with no scale excludes the cable, named (by its real end-to-end label) and counted - never guessed', () => {
    const project = shaftFourFloorProject([{ scale: null }, { cables: [shaftCable('c1', 'sm2', 'sf0')], cameras: [cam1] }])
    const floorEstimate = computeProjectCableEstimate(project).byFloorId.get('sf1')!
    expect(floorEstimate.cables).toHaveLength(0)
    expect(floorEstimate.unestimatedCableCount).toBe(1)
    const warning = floorEstimate.warnings.find((w) => w.code === 'linked-floor-scale-not-set')
    expect(warning?.cableId).toBe('c1')
    // The label builder walks the topology regardless of scale, so the warning names the REAL end
    // the route reaches (F1's plain hub H1) even though that floor's missing scale is why the
    // metres themselves are unavailable - never a bare "?" here.
    expect(warning?.message).toMatch(/^F2_C1_F1_H1: /)
  })
})

describe('computeProjectCableEstimate - not routed: 0 m at the opening + its own extraLengthM, no routeHeightM term', () => {
  const cam1 = { id: 'cam-c1', modelId: 'm', x: SHAFT_MARKER_F2.x, y: SHAFT_MARKER_F2.y, rotationDeg: 0, rangeM: 10 } // AT the marker: horizM = 0

  /** Every term but the shaft's own `extraLengthM` zeroed out, so the whole project-level run is exactly that one number - the hand-computed assertion the review asked for. */
  function noExitProject(extraLengthM: number) {
    const project = shaftFourFloorProject([{}, { cameras: [cam1], cables: [shaftCable('c1', 'sm2')], hubs: [{ ...SHAFT_MARKER_F2, extraLengthM }] }])
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

describe('computeProjectCableEstimate - cable labels through a shaft', () => {
  const cam1 = { id: 'cam-c1', modelId: 'm', x: 1, y: 1, rotationDeg: 0, rangeM: 10 }

  it('not routed reads "F2_C1_?" in the project totals and on its own floor (same string) - the shaft never appears', () => {
    const result = computeProjectCableEstimate(shaftFourFloorProject([{}, { cameras: [cam1], cables: [shaftCable('c1', 'sm2')] }]))
    expect(result.totals.find((t) => t.type.id === 'cat6-utp')!.labels).toEqual(['F2_C1_?'])
    expect(result.byFloorId.get('sf1')!.cables[0].label).toBe('F2_C1_?')
  })

  it('routed reads the hub it finally reaches: "F2_C1_F3_H1" (the only plain hub on F3 is that floor\'s H1)', () => {
    const result = computeProjectCableEstimate(shaftFourFloorProject([{}, { cameras: [cam1], cables: [shaftCable('c1', 'sm2', 'sf2')] }]))
    expect(result.totals.find((t) => t.type.id === 'cat6-utp')!.labels).toEqual(['F2_C1_F3_H1'])
  })

  it('a route ending on a fire-alarm panel reads its designator when the catalog lookup is given: "F2_C1_F3_P1"', () => {
    const panel = { id: 'fa-1', modelId: 'panel', x: 100, y: 200 }
    const cable = { ...shaftCable('c1', 'sm2'), beyondShaft: { floorId: 'sf2', points: [], endDevice: { kind: 'fire-alarm' as const, id: 'fa-1' } } }
    const project = shaftFourFloorProject([{}, { cameras: [cam1], cables: [cable] }, { fireAlarmDevices: [panel] }])
    const result = computeProjectCableEstimate(project, { panel: { kind: 'control-panel' } })
    expect(result.byFloorId.get('sf1')!.cables[0].label).toBe('F2_C1_F3_P1')
  })
})
