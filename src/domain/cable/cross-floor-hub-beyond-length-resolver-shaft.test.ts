import { describe, expect, it } from 'vitest'
import type { Cable, Hub } from './cable-layout-types'
import { resolveCableBeyondLengths, resolveHubBeyondLength, sumFloorHeightsBetween } from './cross-floor-hub-beyond-length-resolver'
import {
  HUB_H1,
  SHAFT_MARKER_F1,
  SHAFT_MARKER_F2,
  shaftCable,
  shaftFourFloorProject,
} from './shaft-worked-example.test-fixtures'

/** Shaft-specific cases of `resolveHubBeyondLength`/`resolveCableBeyondLengths` - see the hand-computed numbers in `shaft-worked-example.test-fixtures.ts`'s own doc comment. */
describe('resolveHubBeyondLength - shaft markers', () => {
  it('F2 -> a route on F1: only F1\'s own height is crossed', () => {
    const project = shaftFourFloorProject()
    const beyond = resolveHubBeyondLength(project, { floorId: 'sf1', hubId: 'sm2' }, shaftCable('c1', 'sm2', 'sf0'))
    expect(beyond.source).toBe('route')
    if (beyond.source !== 'route') throw new Error('unreachable')
    expect(beyond.crossingVerticalM).toBe(3) // F1's own floorHeightM
    expect(beyond.run.nominal).toBeCloseTo(11.5, 5) // 3 (vertical) + 7 (horizontal on F1) + 1.5 (H1's typed drop)
  })

  it('F4 -> F1 sums h3 + h2 + h1 (= 2.5+3.5+3 = 9); F4 -> F3 sums only h3 (= 2.5)', () => {
    const project = shaftFourFloorProject()
    expect(sumFloorHeightsBetween(project.floors, 3, 0)).toBe(9)
    expect(sumFloorHeightsBetween(project.floors, 3, 2)).toBe(2.5)
    const toF1 = resolveHubBeyondLength(project, { floorId: 'sf3', hubId: 'sm4' }, shaftCable('c1', 'sm4', 'sf0'))
    const toF3 = resolveHubBeyondLength(project, { floorId: 'sf3', hubId: 'sm4' }, shaftCable('c2', 'sm4', 'sf2'))
    expect(toF1.source === 'route' && toF1.crossingVerticalM).toBe(9)
    expect(toF3.source === 'route' && toF3.crossingVerticalM).toBe(2.5)
  })

  it('a route on the cable\'s own floor -> 0 vertical, the cable just follows its route from the opening', () => {
    const project = shaftFourFloorProject()
    const beyond = resolveHubBeyondLength(project, { floorId: 'sf0', hubId: 'sm1' }, shaftCable('c1', 'sm1', 'sf0'))
    expect(beyond.source === 'route' && beyond.crossingVerticalM).toBe(0)
    // horizontal (the leg on F1, 700px @ 100px/m = 7m) + H1's typed 1.5m beyond it.
    expect(beyond.source === 'route' && beyond.run.nominal).toBeCloseTo(8.5, 5)
  })

  it('changing one floorHeightM changes only the cables whose crossing spans that floor', () => {
    const base = shaftFourFloorProject()
    const changed = shaftFourFloorProject([{ floorHeightM: 100 }]) // F1's own height, irrelevant below
    const toF1Base = resolveHubBeyondLength(base, { floorId: 'sf1', hubId: 'sm2' }, shaftCable('c1', 'sm2', 'sf0'))
    const toF1Changed = resolveHubBeyondLength(changed, { floorId: 'sf1', hubId: 'sm2' }, shaftCable('c1', 'sm2', 'sf0'))
    // F2 -> F1: crosses F1's own height (100 vs the base's 3) - DOES change.
    expect(toF1Base.source === 'route' && toF1Base.crossingVerticalM).toBe(3)
    expect(toF1Changed.source === 'route' && toF1Changed.crossingVerticalM).toBe(100)
    const toF3Base = resolveHubBeyondLength(base, { floorId: 'sf3', hubId: 'sm4' }, shaftCable('c2', 'sm4', 'sf2'))
    const toF3Changed = resolveHubBeyondLength(changed, { floorId: 'sf3', hubId: 'sm4' }, shaftCable('c2', 'sm4', 'sf2'))
    // F4 -> F3 crosses only F3's own height - UNTOUCHED by F1's height change.
    expect(toF3Base.source === 'route' && toF3Base.crossingVerticalM).toBe(toF3Changed.source === 'route' && toF3Changed.crossingVerticalM)
    expect(toF3Base.source === 'route' && toF3Base.crossingVerticalM).toBe(2.5)
  })

  it('not routed -> typed: JUST the opening\'s own extraLengthM, no routeHeightM term at all', () => {
    const project = shaftFourFloorProject([{ hubs: [{ ...SHAFT_MARKER_F1, extraLengthM: 4 }, HUB_H1] }])
    const beyond = resolveHubBeyondLength(project, { floorId: 'sf0', hubId: 'sm1' }, shaftCable('c1', 'sm1'))
    // "0 m at the opening + extraLengthM", never `|routeHeightM - 0| + extraLengthM` (= 7).
    // `shaftNotRouted: true` is the flag `estimateCableLength` reads to use `run` as-is.
    expect(beyond).toEqual({ source: 'typed', run: { nominal: 4, min: 4, max: 4 }, shaftNotRouted: true })
  })

  it('a route whose end hub is gone does not resolve: the cable reads as not routed, never a made-up number', () => {
    const project = shaftFourFloorProject([{ hubs: [SHAFT_MARKER_F1] }]) // F1 has no h1 any more
    const beyond = resolveHubBeyondLength(project, { floorId: 'sf1', hubId: 'sm2' }, shaftCable('c1', 'sm2', 'sf0'))
    expect(beyond).toEqual({ source: 'typed', run: { nominal: 0, min: 0, max: 0 }, shaftNotRouted: true })
  })

  it('the exit floor has no scale -> unavailable "linked-floor-scale-not-set", other floors unaffected', () => {
    const project = shaftFourFloorProject([{ scale: null }])
    const toF1 = resolveHubBeyondLength(project, { floorId: 'sf1', hubId: 'sm2' }, shaftCable('c1', 'sm2', 'sf0'))
    expect(toF1).toEqual({ source: 'unavailable', reason: 'linked-floor-scale-not-set', floorName: 'F1' })
    const toF3 = resolveHubBeyondLength(project, { floorId: 'sf3', hubId: 'sm4' }, shaftCable('c2', 'sm4', 'sf2'))
    expect(toF3.source).toBe('route') // F3 still has its scale
  })

  it('names where the route ends: "via" and the end label read the END on the exit floor, never the shaft', () => {
    const beyond = resolveHubBeyondLength(shaftFourFloorProject(), { floorId: 'sf1', hubId: 'sm2' }, shaftCable('c1', 'sm2', 'sf0'))
    expect(beyond).toMatchObject({ source: 'route', viaLabel: 'F1 H1', endsOnDevice: false })
  })

  it('a route that ends on a DEVICE: floor crossing + route + the rise to that device, flagged endsOnDevice', () => {
    // A camera on F1 at (100,400), mounted at 2.5 m: route (100,100)->(100,400) = 300 px = 3 m,
    // rise |routeHeight 3 - 2.5| = 0.5 m, crossing F2 -> F1 = 3 m. run = 3 + 3 + 0.5 = 6.5 m.
    const camera = { id: 'cam-end', modelId: 'm', x: 100, y: 400, rotationDeg: 0, rangeM: 5, mountHeightM: 2.5, tiltDeg: 10 }
    const project = shaftFourFloorProject([{ cameras: [camera] }])
    const cable: Cable = { ...shaftCable('c1', 'sm2'), beyondShaft: { floorId: 'sf0', points: [], endDevice: { kind: 'camera', id: 'cam-end' } } }
    const beyond = resolveHubBeyondLength(project, { floorId: 'sf1', hubId: 'sm2' }, cable)
    expect(beyond).toMatchObject({ source: 'route', crossingVerticalM: 3, viaLabel: 'F1 C1', endsOnDevice: true })
    expect(beyond.source === 'route' && beyond.run.nominal).toBeCloseTo(6.5, 9)
  })
})

describe('resolveCableBeyondLengths - cables entering the SAME opening each follow their own route', () => {
  it('two cables on sm2, one routed on F1 and one on F3, resolve independently (never cached per hub)', () => {
    const project = shaftFourFloorProject([{}, { cables: [shaftCable('toF1', 'sm2', 'sf0'), shaftCable('toF3', 'sm2', 'sf2')] }])
    const byFloor = resolveCableBeyondLengths(project)
    const f1Beyond = byFloor.get('sf1')!.get('toF1')!
    const f3Beyond = byFloor.get('sf1')!.get('toF3')!
    expect(f1Beyond.source === 'route' && f1Beyond.crossingVerticalM).toBe(3)
    expect(f3Beyond.source === 'route' && f3Beyond.crossingVerticalM).toBe(3.5)
  })
})

describe('chaining: a route beyond a shaft that ends on a linked riser / drop (continues into the pair model)', () => {
  // The cable's route on F1 ends on a RISER instead of a plain hub; that riser is linked to a drop
  // on F2, which has its own trunk to a plain hub on F2 - a shaft -> pair chain.
  const riserOnF1: Hub = { id: 'riser-x', kind: 'riser', x: 400, y: 500, mountHeightM: 3, link: { floorId: 'sf1', hubId: 'drop-x' } }
  const dropOnF2: Hub = {
    id: 'drop-x',
    kind: 'drop',
    x: 0,
    y: 0,
    mountHeightM: 0,
    link: { floorId: 'sf0', hubId: 'riser-x' },
    trunk: { hubId: 'plain-y', points: [] },
  }
  const plainY: Hub = { id: 'plain-y', x: 100, y: 0, mountHeightM: 1.5 }
  const toRiser: Cable = { ...shaftCable('c1', 'sm2'), beyondShaft: { floorId: 'sf0', points: [{ x: 100, y: 500 }], hubId: 'riser-x' } }

  it('chains through: the shaft hop, the route, then the pair hop and its trunk', () => {
    const project = shaftFourFloorProject([{ hubs: [SHAFT_MARKER_F1, riserOnF1] }, { hubs: [SHAFT_MARKER_F2, dropOnF2, plainY], cables: [toRiser] }])
    const beyond = resolveHubBeyondLength(project, { floorId: 'sf1', hubId: 'sm2' }, toRiser)
    expect(beyond.source).toBe('route')
    if (beyond.source !== 'route') throw new Error('unreachable')
    expect(beyond.crossingVerticalM).toBe(3) // the shaft's own F2->F1 hop only - the pair's hop is inside `run`
    // 3 (shaft hop) + 7 (route to riser-x) + [3 (pair hop) + 1 (drop-x -> plain-y, 100 px) + 1.5 (plain-y typed)] = 15.5
    expect(beyond.run.nominal).toBeCloseTo(15.5, 9)
  })

  it('a crafted pair trunk pointing back at a shaft opening ends there (typed) - never an infinite loop', () => {
    const backToShaft: Hub = { ...dropOnF2, trunk: { hubId: 'sm2', points: [] } }
    const project = shaftFourFloorProject([{ hubs: [SHAFT_MARKER_F1, riserOnF1] }, { hubs: [SHAFT_MARKER_F2, backToShaft], cables: [toRiser] }])
    const beyond = resolveHubBeyondLength(project, { floorId: 'sf1', hubId: 'sm2' }, toRiser)
    expect(beyond).toMatchObject({ source: 'unavailable', reason: 'link-cycle' })
  })
})
