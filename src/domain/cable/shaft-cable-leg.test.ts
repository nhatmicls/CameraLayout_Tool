import { describe, expect, it } from 'vitest'
import type { Floor } from '../floor/floor-types'
import type { Cable } from './cable-layout-types'
import {
  findShaftLegsOnFloor,
  isOnlyShaftLegChangeOnFloor,
  listShaftCables,
  pruneInvalidShaftLegs,
  resolveShaftLeg,
} from './shaft-cable-leg'
import { HUB_H1, LEG_TO_F1, SHAFT_ID, SHAFT_MARKER_F1, SHAFT_MARKER_F2, shaftCable, shaftFourFloorProject } from './shaft-worked-example.test-fixtures'

const camera = (id: string, x = 1, y = 1) => ({ id, modelId: 'm', x, y, rotationDeg: 0, rangeM: 10 })

/** F2 holds cameras cam-c1 / cam-c2 and the given cables; every other floor is the plain worked example. */
function projectWithF2Cables(cables: Cable[], floor0: Partial<Floor> = {}) {
  return shaftFourFloorProject([floor0, { cameras: [camera('cam-c1'), camera('cam-c2')], cables }])
}

describe('resolveShaftLeg', () => {
  it('resolves a leg on another floor: from THAT floor\'s opening, through its points, to its end hub', () => {
    const cable = shaftCable('c1', 'sm2', 'sf0')
    const leg = resolveShaftLeg(projectWithF2Cables([cable]).floors, 1, cable)
    expect(leg).toMatchObject({ sourceFloorIndex: 1, exitFloorIndex: 0, marker: { id: 'sm1' }, end: { kind: 'hub', label: 'H1' } })
    expect(leg!.pathPx).toEqual([{ x: 100, y: 100 }, { x: 100, y: 500 }, { x: 400, y: 500 }])
  })

  it('resolves a leg that ends on a device of the exit floor', () => {
    const cable: Cable = { ...shaftCable('c1', 'sm2'), beyondShaft: { floorId: 'sf0', points: [], endDevice: { kind: 'camera', id: 'cam-x' } } }
    const leg = resolveShaftLeg(projectWithF2Cables([cable], { cameras: [camera('cam-x', 300, 100)] }).floors, 1, cable)
    expect(leg).toMatchObject({ end: { kind: 'device', label: 'C1', x: 300, y: 100 } })
  })

  it('is null without a leg, and for a cable that does not end on a shaft opening', () => {
    const { floors } = projectWithF2Cables([])
    expect(resolveShaftLeg(floors, 1, shaftCable('c1', 'sm2'))).toBeNull()
    const onPlainHub: Cable = { ...shaftCable('c1', 'h1', 'sf0') }
    expect(resolveShaftLeg(floors, 0, onPlainHub)).toBeNull()
  })

  it.each<[string, Cable['beyondShaft']]>([
    ['the exit floor does not exist', { ...LEG_TO_F1, floorId: 'gone' }],
    ['the end hub does not exist', { ...LEG_TO_F1, hubId: 'gone' }],
    ['the end is a shaft opening', { ...LEG_TO_F1, hubId: 'sm1' }],
    ['it names both a hub and a device', { ...LEG_TO_F1, endDevice: { kind: 'camera', id: 'cam-c1' } }],
    ['it names neither a hub nor a device', { floorId: 'sf0', points: [] }],
    ['the end device does not exist', { floorId: 'sf0', points: [], endDevice: { kind: 'camera', id: 'gone' } }],
  ])('is null when %s', (_reason, beyondShaft) => {
    const cable: Cable = { ...shaftCable('c1', 'sm2'), beyondShaft }
    expect(resolveShaftLeg(projectWithF2Cables([cable]).floors, 1, cable)).toBeNull()
  })

  it('is null when the exit floor has no opening of the cable\'s shaft', () => {
    const cable = shaftCable('c1', 'sm2', 'sf0')
    expect(resolveShaftLeg(projectWithF2Cables([cable], { hubs: [HUB_H1] }).floors, 1, cable)).toBeNull()
  })

  it('a leg on the cable\'s OWN floor may end on another device, never on the cable\'s own start', () => {
    const toOther: Cable = { ...shaftCable('c1', 'sm2'), beyondShaft: { floorId: 'sf1', points: [], endDevice: { kind: 'camera', id: 'cam-c2' } } }
    const toItself: Cable = { ...shaftCable('c1', 'sm2'), beyondShaft: { floorId: 'sf1', points: [], endDevice: { kind: 'camera', id: 'cam-c1' } } }
    const { floors } = projectWithF2Cables([toOther, toItself])
    expect(resolveShaftLeg(floors, 1, toOther)).toMatchObject({ exitFloorIndex: 1, marker: { id: 'sm2' } })
    expect(resolveShaftLeg(floors, 1, toItself)).toBeNull()
  })
})

describe('pruneInvalidShaftLegs', () => {
  it('returns the same array when there is no leg at all, and when every leg resolves', () => {
    const none = projectWithF2Cables([shaftCable('c1', 'sm2')]).floors
    expect(pruneInvalidShaftLegs(none)).toBe(none)
    const valid = projectWithF2Cables([shaftCable('c1', 'sm2', 'sf0')]).floors
    expect(pruneInvalidShaftLegs(valid)).toBe(valid)
  })

  it('clears only the leg that no longer resolves - the cable stays, back to "not routed" - with one warning', () => {
    // F1 lost its hub h1: the leg to F1 is dead, the leg to F3 is untouched.
    const { floors } = projectWithF2Cables([shaftCable('c1', 'sm2', 'sf0'), shaftCable('c2', 'sm2', 'sf2')], { hubs: [SHAFT_MARKER_F1] })
    const warnings: string[] = []
    const pruned = pruneInvalidShaftLegs(floors, warnings)
    expect(pruned[1].cables.map((cable) => cable.beyondShaft?.floorId)).toEqual([undefined, 'sf2'])
    expect('beyondShaft' in pruned[1].cables[0]).toBe(false) // the key is removed, not set to undefined
    expect(pruned[0]).toBe(floors[0]) // untouched floors keep their identity
    expect(warnings).toEqual(['Cable "c1"\'s route beyond its shaft is no longer valid; cleared.'])
  })
})

describe('findShaftLegsOnFloor / listShaftCables', () => {
  const routedToF1 = shaftCable('c1', 'sm2', 'sf0')
  const notRouted = shaftCable('c2', 'sm2')
  const fromF4 = shaftCable('c3', 'sm4', 'sf0')
  const project = shaftFourFloorProject([{}, { cameras: [camera('cam-c1'), camera('cam-c2')], cables: [routedToF1, notRouted] }, {}, { cameras: [camera('cam-c3')], cables: [fromF4] }])

  it('lists the legs that run on a floor, whichever floor their cable belongs to', () => {
    expect(findShaftLegsOnFloor(project.floors, 'sf0').map((leg) => [leg.cable.id, leg.sourceFloorIndex])).toEqual([
      ['c1', 1],
      ['c3', 3],
    ])
    expect(findShaftLegsOnFloor(project.floors, 'sf1')).toEqual([])
  })

  it('lists every cable entering the shaft, named by its start device on its own floor, routed or not', () => {
    const entries = listShaftCables(project.floors, SHAFT_ID)
    expect(entries.map((entry) => [entry.floorIndex, entry.deviceLabel, entry.leg?.end.label ?? null])).toEqual([
      [1, 'C1', 'H1'],
      [1, 'C2', null],
      [3, 'C1', 'H1'],
    ])
    expect(listShaftCables(project.floors, 'unknown-shaft')).toEqual([])
  })

  it('ignores a cable on the same floor that ends on a different hub', () => {
    const other: Cable = { id: 'plain', device: { kind: 'camera', id: 'cam-c1' }, hubId: 'h1', typeId: 'cat6-utp', points: [] }
    const { floors } = shaftFourFloorProject([{ cameras: [camera('cam-c1')], cables: [other] }, { hubs: [SHAFT_MARKER_F2] }])
    expect(listShaftCables(floors, SHAFT_ID)).toEqual([])
  })
})

describe('isOnlyShaftLegChangeOnFloor', () => {
  const routed = shaftCable('c1', 'sm2', 'sf0')
  const notRouted = shaftCable('c1', 'sm2')
  const floorWith = (cables: Cable[]) => shaftFourFloorProject([{}, { cables }]).floors[1]
  const base = floorWith([notRouted])

  it('is true when only a route on that exit floor appeared, vanished or was redrawn', () => {
    expect(isOnlyShaftLegChangeOnFloor(base, { ...base, cables: [routed] }, 'sf0')).toBe(true)
    expect(isOnlyShaftLegChangeOnFloor({ ...base, cables: [routed] }, base, 'sf0')).toBe(true)
    const redrawn: Cable = { ...routed, beyondShaft: { ...routed.beyondShaft!, points: [] } }
    expect(isOnlyShaftLegChangeOnFloor({ ...base, cables: [routed] }, { ...base, cables: [redrawn] }, 'sf0')).toBe(true)
  })

  it('is false for a route on another floor, for no change, and when anything else on the floor changed too', () => {
    expect(isOnlyShaftLegChangeOnFloor(base, { ...base, cables: [routed] }, 'sf2')).toBe(false)
    expect(isOnlyShaftLegChangeOnFloor(base, base, 'sf0')).toBe(false)
    expect(isOnlyShaftLegChangeOnFloor(base, { ...base, cables: [{ ...routed, typeId: 'other' }] }, 'sf0')).toBe(false)
    expect(isOnlyShaftLegChangeOnFloor(base, { ...base, cables: [routed], hubs: [...base.hubs] }, 'sf0')).toBe(false)
    expect(isOnlyShaftLegChangeOnFloor(base, { ...base, cables: [routed, shaftCable('c2', 'sm2')] }, 'sf0')).toBe(false)
  })
})
