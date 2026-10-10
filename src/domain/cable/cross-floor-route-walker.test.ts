import { describe, expect, it } from 'vitest'
import type { Floor } from '../floor/floor-types'
import type { Cable, Hub } from './cable-layout-types'
import { CROSS_FLOOR_CABLE, DROP_1, PLAIN_HUB_2, threeFloorChainProject, twoFloorLinkedProject } from './cross-floor-worked-example.test-fixtures'
import { walkCrossFloorRoute, walkCrossFloorRouteFromHub } from './cross-floor-route-walker'
import { HUB_H1, SHAFT_MARKER_F1, SHAFT_MARKER_F2, shaftCable, shaftFourFloorProject } from './shaft-worked-example.test-fixtures'

function emptyFloor(id: string, name: string, overrides: Partial<Floor> = {}): Floor {
  return { id, name, floorHeightM: 3, image: null, scale: null, cameras: [], walls: [], sensors: [], hubs: [], cables: [], fireAlarmDevices: [], ...overrides }
}

const cam = (id: string, x = 0, y = 0) => ({ id, modelId: 'm', x, y, rotationDeg: 0, rangeM: 5 })

describe('walkCrossFloorRoute - a cable ending on a device', () => {
  const floor = emptyFloor('f0', 'F1', { cameras: [cam('cam-1'), cam('cam-2', 10, 10)] })
  const cable: Cable = { id: 'k', device: { kind: 'camera', id: 'cam-1' }, endDevice: { kind: 'camera', id: 'cam-2' }, typeId: 't', points: [] }

  it('0 hops, device end', () => {
    const route = walkCrossFloorRoute([floor], 0, cable)
    expect(route.hops).toEqual([])
    expect(route.end).toMatchObject({ kind: 'device', floorIndex: 0 })
    expect(route.end.kind === 'device' && route.end.device.label).toBe('C2')
  })

  it('a gone end device -> missing', () => {
    const gone: Cable = { ...cable, endDevice: { kind: 'camera', id: 'nope' } }
    expect(walkCrossFloorRoute([floor], 0, gone).end).toEqual({ kind: 'missing' })
  })
})

describe('walkCrossFloorRoute - a cable ending on a hub, no further route', () => {
  it('a plain hub: 0 hops, hub end', () => {
    const plainHub: Hub = { id: 'h1', x: 0, y: 0, mountHeightM: 1.5 }
    const floor = emptyFloor('f0', 'F1', { hubs: [plainHub], cameras: [cam('cam-1')] })
    const cable: Cable = { id: 'k', device: { kind: 'camera', id: 'cam-1' }, hubId: 'h1', typeId: 't', points: [] }
    const route = walkCrossFloorRoute([floor], 0, cable)
    expect(route).toEqual({ hops: [], end: { kind: 'hub', floorIndex: 0, hub: plainHub } })
  })

  it('an unlinked riser: 0 hops, hub end (riser kind)', () => {
    const riser: Hub = { id: 'riser-x', kind: 'riser', x: 0, y: 0, mountHeightM: 3 }
    const floor = emptyFloor('f0', 'F1', { hubs: [riser], cameras: [cam('cam-1')] })
    const cable: Cable = { id: 'k', device: { kind: 'camera', id: 'cam-1' }, hubId: 'riser-x', typeId: 't', points: [] }
    const route = walkCrossFloorRoute([floor], 0, cable)
    expect(route).toEqual({ hops: [], end: { kind: 'hub', floorIndex: 0, hub: riser } })
  })

  it('a linked riser whose partner has no trunk yet: still 0 hops, hub end', () => {
    const project = twoFloorLinkedProject({
      floor1: { hubs: [{ id: 'drop-1', kind: 'drop', x: 700, y: 500, mountHeightM: 0, link: { floorId: 'floor-0', hubId: 'riser-1' } }] },
    })
    const route = walkCrossFloorRoute(project.floors, 0, CROSS_FLOOR_CABLE)
    expect(route.hops).toEqual([])
    expect(route.end.kind).toBe('hub')
    expect(route.end.kind === 'hub' && route.end.hub.kind).toBe('riser')
  })
})

describe('walkCrossFloorRoute - riser / drop pair chains', () => {
  it('riser -> drop with a trunk -> plain hub: exactly 1 pair hop', () => {
    const project = twoFloorLinkedProject()
    const route = walkCrossFloorRoute(project.floors, 0, CROSS_FLOOR_CABLE)
    expect(route.hops).toEqual([
      { kind: 'pair', fromFloorIndex: 0, exitFloorIndex: 1, exitHub: DROP_1, targetHub: PLAIN_HUB_2, pathPx: [{ x: 700, y: 500 }, { x: 700, y: 800 }, { x: 900, y: 800 }] },
    ])
    expect(route.end).toEqual({ kind: 'hub', floorIndex: 1, hub: PLAIN_HUB_2 })
  })

  it('a chain over three floors: 2 pair hops', () => {
    const project = threeFloorChainProject()
    const route = walkCrossFloorRoute(project.floors, 0, CROSS_FLOOR_CABLE)
    expect(route.hops.map((hop) => hop.kind)).toEqual(['pair', 'pair'])
    expect(route.end).toMatchObject({ kind: 'hub', floorIndex: 2 })
  })

  it('a legal zig-zag between the same two floors via different pairs is not a false cycle', () => {
    // A (riser, f0) <-> B (drop, f1); B.trunk -> X (drop, f1) <-> Y (riser, f0); Y.trunk -> Z
    // (riser, f0) <-> W (drop, f1); W.trunk -> plain P (f1). Three pair hops crossing only two
    // floors - more hops than floors, but every (floor, hub) pair is visited once.
    const floor0 = emptyFloor('f0', 'F1', {
      hubs: [
        { id: 'A', kind: 'riser', x: 0, y: 0, mountHeightM: 3, link: { floorId: 'f1', hubId: 'B' } },
        { id: 'Y', kind: 'riser', x: 0, y: 0, mountHeightM: 3, link: { floorId: 'f1', hubId: 'X' }, trunk: { hubId: 'Z', points: [] } },
        { id: 'Z', kind: 'riser', x: 0, y: 0, mountHeightM: 3, link: { floorId: 'f1', hubId: 'W' } },
      ],
      cameras: [cam('cam-1')],
    })
    const floor1 = emptyFloor('f1', 'F2', {
      hubs: [
        { id: 'B', kind: 'drop', x: 0, y: 0, mountHeightM: 0, link: { floorId: 'f0', hubId: 'A' }, trunk: { hubId: 'X', points: [] } },
        { id: 'X', kind: 'drop', x: 0, y: 0, mountHeightM: 0, link: { floorId: 'f0', hubId: 'Y' } },
        { id: 'W', kind: 'drop', x: 0, y: 0, mountHeightM: 0, link: { floorId: 'f0', hubId: 'Z' }, trunk: { hubId: 'P', points: [] } },
        { id: 'P', x: 0, y: 0, mountHeightM: 1.5 },
      ],
    })
    const cable: Cable = { id: 'k', device: { kind: 'camera', id: 'cam-1' }, hubId: 'A', typeId: 't', points: [] }
    const route = walkCrossFloorRoute([floor0, floor1], 0, cable)
    expect(route.hops.map((hop) => hop.kind)).toEqual(['pair', 'pair', 'pair'])
    expect(route.end).toEqual({ kind: 'hub', floorIndex: 1, hub: floor1.hubs[3] })
  })
})

describe('walkCrossFloorRoute - a cable through a shaft', () => {
  it('no leg yet: 0 hops, hub end (the shaft marker itself)', () => {
    const project = shaftFourFloorProject([{}, { cameras: [cam('cam-c1')] }])
    const cable = shaftCable('c1', 'sm2')
    const route = walkCrossFloorRoute(project.floors, 1, cable)
    expect(route).toEqual({ hops: [], end: { kind: 'hub', floorIndex: 1, hub: SHAFT_MARKER_F2 } })
  })

  it('a leg to a plain hub: 1 shaft-leg hop, hub end', () => {
    const project = shaftFourFloorProject([{}, { cameras: [cam('cam-c1')] }])
    const cable = shaftCable('c1', 'sm2', 'sf0')
    const route = walkCrossFloorRoute(project.floors, 1, cable)
    expect(route.hops).toHaveLength(1)
    expect(route.hops[0]).toMatchObject({ kind: 'shaft-leg', fromFloorIndex: 1, exitFloorIndex: 0 })
    expect(route.end).toEqual({ kind: 'hub', floorIndex: 0, hub: HUB_H1 })
  })

  it('a leg to a device: 1 shaft-leg hop, device end on the exit floor', () => {
    const endCam = cam('cam-end', 1, 1)
    const project = shaftFourFloorProject([{ cameras: [endCam] }, { cameras: [cam('cam-c1')] }])
    const cable: Cable = { ...shaftCable('c1', 'sm2'), beyondShaft: { floorId: 'sf0', points: [], endDevice: { kind: 'camera', id: 'cam-end' } } }
    const route = walkCrossFloorRoute(project.floors, 1, cable)
    expect(route.hops).toHaveLength(1)
    expect(route.hops[0].kind).toBe('shaft-leg')
    expect(route.end).toMatchObject({ kind: 'device', floorIndex: 0 })
    expect(route.end.kind === 'device' && route.end.device.label).toBe('C1')
  })

  it('a leg to a riser that continues: shaft-leg hop + pair hop', () => {
    const riserOnF1: Hub = { id: 'riser-x', kind: 'riser', x: 400, y: 500, mountHeightM: 3, link: { floorId: 'sf1', hubId: 'drop-x' } }
    const dropOnF2: Hub = { id: 'drop-x', kind: 'drop', x: 0, y: 0, mountHeightM: 0, link: { floorId: 'sf0', hubId: 'riser-x' }, trunk: { hubId: 'plain-y', points: [] } }
    const plainY: Hub = { id: 'plain-y', x: 100, y: 0, mountHeightM: 1.5 }
    const toRiser: Cable = { ...shaftCable('c1', 'sm2'), beyondShaft: { floorId: 'sf0', points: [{ x: 100, y: 500 }], hubId: 'riser-x' } }
    const project = shaftFourFloorProject([{ hubs: [SHAFT_MARKER_F1, riserOnF1] }, { hubs: [SHAFT_MARKER_F2, dropOnF2, plainY], cables: [toRiser] }])
    const route = walkCrossFloorRoute(project.floors, 1, toRiser)
    expect(route.hops.map((hop) => hop.kind)).toEqual(['shaft-leg', 'pair'])
    expect(route.end).toEqual({ kind: 'hub', floorIndex: 1, hub: plainY })
  })

  it('the exit floor is not adjacent: still exactly one shaft-leg hop', () => {
    const cable: Cable = { ...shaftCable('c1', 'sm4'), beyondShaft: { floorId: 'sf0', points: [], hubId: 'h1' } }
    const project = shaftFourFloorProject([{}, {}, {}, { cables: [cable] }])
    const route = walkCrossFloorRoute(project.floors, 3, cable)
    expect(route.hops).toEqual([{ kind: 'shaft-leg', fromFloorIndex: 3, exitFloorIndex: 0, leg: expect.objectContaining({ exitFloorIndex: 0 }) }])
    expect(route.end).toEqual({ kind: 'hub', floorIndex: 0, hub: HUB_H1 })
  })
})

describe('walkCrossFloorRoute - defensive / crafted edges', () => {
  it('a cycle (a trunk chain that loops back on itself) is detected, not an infinite loop', () => {
    const project = twoFloorLinkedProject({
      floor0: {
        hubs: [
          { id: 'riser-1', kind: 'riser', x: 700, y: 500, mountHeightM: 3, link: { floorId: 'floor-1', hubId: 'drop-1' } },
          { id: 'drop-2', kind: 'drop', x: 0, y: 0, mountHeightM: 0, link: { floorId: 'floor-1', hubId: 'riser-2' }, trunk: { hubId: 'riser-1', points: [] } },
        ],
      },
      floor1: {
        hubs: [
          { id: 'drop-1', kind: 'drop', x: 700, y: 500, mountHeightM: 0, link: { floorId: 'floor-0', hubId: 'riser-1' }, trunk: { hubId: 'riser-2', points: [] } },
          { id: 'riser-2', kind: 'riser', x: 700, y: 500, mountHeightM: 3, link: { floorId: 'floor-0', hubId: 'drop-2' } },
        ],
      },
    })
    const route = walkCrossFloorRoute(project.floors, 0, CROSS_FLOOR_CABLE)
    expect(route.end.kind).toBe('cycle')
  })

  it('a pair exit whose trunk target does not resolve -> broken', () => {
    const project = twoFloorLinkedProject({
      floor1: { hubs: [{ id: 'drop-1', kind: 'drop', x: 700, y: 500, mountHeightM: 0, link: { floorId: 'floor-0', hubId: 'riser-1' }, trunk: { hubId: 'gone', points: [] } }] },
    })
    const route = walkCrossFloorRoute(project.floors, 0, CROSS_FLOOR_CABLE)
    expect(route.end).toEqual({ kind: 'broken', floorIndex: 1 })
  })

  it('the cable\'s own hub no longer exists -> missing', () => {
    const project = twoFloorLinkedProject()
    const dangling: Cable = { ...CROSS_FLOOR_CABLE, hubId: 'gone' }
    expect(walkCrossFloorRoute(project.floors, 0, dangling).end).toEqual({ kind: 'missing' })
  })

  it('an unknown source floor index -> missing', () => {
    const project = twoFloorLinkedProject()
    expect(walkCrossFloorRoute(project.floors, 9, CROSS_FLOOR_CABLE).end).toEqual({ kind: 'missing' })
  })
})

describe('walkCrossFloorRouteFromHub', () => {
  it('a shaft opening always reads as not-routed (no cable in view)', () => {
    const project = shaftFourFloorProject()
    const route = walkCrossFloorRouteFromHub(project.floors, 1, SHAFT_MARKER_F2)
    expect(route).toEqual({ hops: [], end: { kind: 'hub', floorIndex: 1, hub: SHAFT_MARKER_F2 } })
  })

  it('still walks a riser / drop pair chain', () => {
    const project = twoFloorLinkedProject()
    const route = walkCrossFloorRouteFromHub(project.floors, 0, project.floors[0].hubs[0])
    expect(route.hops).toHaveLength(1)
    expect(route.end).toEqual({ kind: 'hub', floorIndex: 1, hub: PLAIN_HUB_2 })
  })
})
