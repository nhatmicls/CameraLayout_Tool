import { describe, expect, it } from 'vitest'
import type { Hub } from './cable-layout-types'
import { resolveCableBeyondLengths, resolveHubBeyondLength, sumFloorHeightsBetween } from './cross-floor-hub-beyond-length-resolver'
import {
  HUB_H1,
  SHAFT_MARKER_F1,
  SHAFT_MARKER_F2,
  SHAFT_MARKER_F3,
  shaftCable,
  shaftFourFloorProject,
} from './shaft-worked-example.test-fixtures'

/** Shaft-specific cases of `resolveHubBeyondLength`/`resolveCableBeyondLengths` - see the hand-computed numbers in `shaft-worked-example.test-fixtures.ts`'s own doc comment. */
describe('resolveHubBeyondLength - shaft markers', () => {
  it('a gap floor (F2, no marker/exit of its own) between entry and its F1 exit still contributes only F1-F2\'s own height', () => {
    const project = shaftFourFloorProject()
    const beyond = resolveHubBeyondLength(project, { floorId: 'sf1', hubId: 'sm2' }, shaftCable('c1', 'sm2', 'sf0'))
    expect(beyond.source).toBe('route')
    if (beyond.source !== 'route') throw new Error('unreachable')
    expect(beyond.crossingVerticalM).toBe(3) // F1's own floorHeightM
    expect(beyond.run.nominal).toBeCloseTo(11.5, 5) // 3 (vertical) + 7 (horizontal on F1) + 1.5 (H1's typed drop)
  })

  it('F4 -> F1 exit sums h3 + h2 + h1 (= 2.5+3.5+3 = 9); F4 -> F3 exit sums only h3 (= 2.5)', () => {
    const project = shaftFourFloorProject()
    expect(sumFloorHeightsBetween(project.floors, 3, 0)).toBe(9)
    expect(sumFloorHeightsBetween(project.floors, 3, 2)).toBe(2.5)
    const toF1 = resolveHubBeyondLength(project, { floorId: 'sf3', hubId: 'sm4' }, shaftCable('c1', 'sm4', 'sf0'))
    const toF3 = resolveHubBeyondLength(project, { floorId: 'sf3', hubId: 'sm4' }, shaftCable('c2', 'sm4', 'sf2'))
    expect(toF1.source === 'route' && toF1.crossingVerticalM).toBe(9)
    expect(toF3.source === 'route' && toF3.crossingVerticalM).toBe(2.5)
  })

  it('entry floor == exit floor -> 0 vertical, cable just follows the trunk on its own floor', () => {
    const project = shaftFourFloorProject()
    // Several exits exist (F1 and F3), so the entry-is-the-exit case still needs an explicit choice.
    const beyond = resolveHubBeyondLength(project, { floorId: 'sf0', hubId: 'sm1' }, shaftCable('c1', 'sm1', 'sf0'))
    expect(beyond.source === 'route' && beyond.crossingVerticalM).toBe(0)
    // horizontal (F1's own trunk, 700px @ 100px/m = 7m) + H1's typed 1.5m beyond it.
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

  it('no exit anywhere -> typed fallback is JUST the marker\'s own extraLengthM, no routeHeightM term at all (D2)', () => {
    const project = shaftFourFloorProject([
      { hubs: [{ ...SHAFT_MARKER_F1, trunk: undefined, extraLengthM: 4 }, HUB_H1] },
      {},
      { hubs: [{ ...SHAFT_MARKER_F3, trunk: undefined }] },
    ])
    const beyond = resolveHubBeyondLength(project, { floorId: 'sf0', hubId: 'sm1' }, shaftCable('c1', 'sm1'))
    // D2: "0 m at the marker + extraLengthM", never `|routeHeightM - 0| + extraLengthM`.
    // `shaftNoExit: true` is the flag `estimateCableLength` (`cable-length-estimate-calculator.ts`)
    // reads to use `run` as-is instead of recomputing from a riser/drop/plain hub's own fields -
    // ship-blocker fix: the calculator used to ignore this `run` and silently add a spurious
    // `routeHeightM` term, i.e. 7 (= |3-0| + 4) instead of the correct 4.
    expect(beyond).toEqual({ source: 'typed', run: { nominal: 4, min: 4, max: 4 }, shaftNoExit: true })
  })

  it('several exits, no/stale choice -> unavailable "shaft-exit-not-chosen", never a silent 0', () => {
    const project = shaftFourFloorProject([{}, { cables: [shaftCable('c1', 'sm2')] }])
    const beyond = resolveHubBeyondLength(project, { floorId: 'sf1', hubId: 'sm2' }, shaftCable('c1', 'sm2'))
    expect(beyond).toEqual({ source: 'unavailable', reason: 'shaft-exit-not-chosen' })
  })

  it('the exit floor has no scale -> unavailable "linked-floor-scale-not-set", other floors unaffected', () => {
    const project = shaftFourFloorProject([{ scale: null }])
    const toF1 = resolveHubBeyondLength(project, { floorId: 'sf1', hubId: 'sm2' }, shaftCable('c1', 'sm2', 'sf0'))
    expect(toF1).toEqual({ source: 'unavailable', reason: 'linked-floor-scale-not-set', floorName: 'F1' })
    const toF3 = resolveHubBeyondLength(project, { floorId: 'sf3', hubId: 'sm4' }, shaftCable('c2', 'sm4', 'sf2'))
    expect(toF3.source).toBe('route') // F3 still has its scale
  })

  it('H3: a defensively-impossible dangling trunk target resolves "unavailable", never a typed number', () => {
    // Hand-crafted (bypasses the loader/store pruning that should always keep this resolvable):
    // the F1 exit's own trunk points at a hub id that no longer exists on F1.
    const project = shaftFourFloorProject([{ hubs: [{ ...SHAFT_MARKER_F1, trunk: { hubId: 'does-not-exist', points: [] } }] }])
    const beyond = resolveHubBeyondLength(project, { floorId: 'sf1', hubId: 'sm2' }, shaftCable('c1', 'sm2', 'sf0'))
    expect(beyond.source).toBe('unavailable')
  })

  it('M5: the "via" label on a shaft exit reads "T{n}" from the PROJECT shaft order, not a per-floor count', () => {
    // A second shaft ("shaft-2") also opens a marker on F1, placed BEFORE sm1 in F1's own hubs
    // array - a per-floor count would misname sm1 "T2" even though it is listed FIRST in `shafts[]`.
    const otherShaftMarker: Hub = { id: 'other-shaft-marker', kind: 'shaft', shaftId: 'shaft-2', x: 5, y: 5, mountHeightM: 0 }
    const project = shaftFourFloorProject([{ hubs: [otherShaftMarker, SHAFT_MARKER_F1, HUB_H1] }])
    project.shafts.push({ id: 'shaft-2', name: 'Other shaft' })
    const beyond = resolveHubBeyondLength(project, { floorId: 'sf1', hubId: 'sm2' }, shaftCable('c1', 'sm2', 'sf0'))
    expect(beyond.source === 'route' && beyond.viaLabel).toBe('F1 T1')
  })
})

describe('resolveCableBeyondLengths - shaft markers can send different cables of the SAME hub to different exits', () => {
  it('two cables on sm2, one choosing F1 and one choosing F3, resolve independently (cache key includes exitFloorId)', () => {
    const project = shaftFourFloorProject([{}, { cables: [shaftCable('toF1', 'sm2', 'sf0'), shaftCable('toF3', 'sm2', 'sf2')] }])
    const byFloor = resolveCableBeyondLengths(project)
    const f1Beyond = byFloor.get('sf1')!.get('toF1')!
    const f3Beyond = byFloor.get('sf1')!.get('toF3')!
    expect(f1Beyond.source === 'route' && f1Beyond.crossingVerticalM).toBe(3)
    expect(f3Beyond.source === 'route' && f3Beyond.crossingVerticalM).toBe(3.5)
  })
})

describe('chaining: a shaft exit whose trunk target is itself a linked riser/drop (continues into the pair model)', () => {
  // F1's exit (sm1) now routes to a RISER instead of a plain hub; that riser is linked to a drop on
  // F2, which has its own trunk to a plain hub on F2 - a shaft -> pair chain.
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
  const sm1ToRiser: Hub = { ...SHAFT_MARKER_F1, trunk: { hubId: 'riser-x', points: [{ x: 100, y: 500 }] } }

  it('chains through: crossing vertical adds the shaft hop AND the pair hop', () => {
    const project = shaftFourFloorProject([
      { hubs: [sm1ToRiser, riserOnF1] },
      { hubs: [SHAFT_MARKER_F2, dropOnF2, plainY], cables: [shaftCable('c1', 'sm2', 'sf0')] },
      {},
    ])
    const beyond = resolveHubBeyondLength(project, { floorId: 'sf1', hubId: 'sm2' }, shaftCable('c1', 'sm2', 'sf0'))
    expect(beyond.source).toBe('route')
    if (beyond.source !== 'route') throw new Error('unreachable')
    expect(beyond.crossingVerticalM).toBe(3) // the shaft's own F2->F1 hop only - the pair's hop is inside `run`, not this field
    // run = 3 (shaft hop) + horizontal(sm1->riser-x) + [riser-x's own beyond: 3 (pair hop) + horizontal(drop-x->plain-y) + plain-y typed 1.5]
    expect(beyond.run.nominal).toBeGreaterThan(beyond.crossingVerticalM) // sanity: more than just the first hop
  })

  it('a cycle (shaft exit -> riser -> drop -> back to the shaft marker) resolves unavailable, never an infinite loop', () => {
    const cyclicSm1: Hub = { ...SHAFT_MARKER_F1, trunk: { hubId: 'riser-x', points: [] } }
    const cyclicDrop: Hub = { ...dropOnF2, trunk: { hubId: 'sm2', points: [] } } // points back into the shaft
    const project = shaftFourFloorProject([
      { hubs: [cyclicSm1, riserOnF1] },
      { hubs: [SHAFT_MARKER_F2, cyclicDrop], cables: [shaftCable('c1', 'sm2', 'sf0')] },
      {},
    ])
    const beyond = resolveHubBeyondLength(project, { floorId: 'sf1', hubId: 'sm2' }, shaftCable('c1', 'sm2', 'sf0'))
    expect(beyond).toMatchObject({ source: 'unavailable', reason: 'link-cycle' })
  })
})
