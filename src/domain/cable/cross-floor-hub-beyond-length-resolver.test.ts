import { describe, expect, it } from 'vitest'
import {
  resolveCableBeyondLengths,
  resolveHubBeyondLength,
  sumFloorHeightsBetween,
} from './cross-floor-hub-beyond-length-resolver'
import { CROSS_FLOOR_CABLE, threeFloorChainProject, twoFloorLinkedProject } from './cross-floor-worked-example.test-fixtures'

describe('sumFloorHeightsBetween', () => {
  it('is 0 when equal, the single floor height when adjacent, order-independent', () => {
    const { floors } = twoFloorLinkedProject()
    expect(sumFloorHeightsBetween(floors, 0, 0)).toBe(0)
    expect(sumFloorHeightsBetween(floors, 0, 1)).toBe(3) // floor 0's own floorHeightM
    expect(sumFloorHeightsBetween(floors, 1, 0)).toBe(3)
  })
})

describe('resolveHubBeyondLength - typed mode', () => {
  it('a plain hub is always typed', () => {
    const project = twoFloorLinkedProject()
    const beyond = resolveHubBeyondLength(project, { floorId: 'floor-1', hubId: 'plain-hub-2' })
    expect(beyond).toEqual({ source: 'typed', run: { nominal: 1.5, min: 1.5, max: 1.5 } })
  })

  it('an unlinked riser/drop is typed, using its own typed fields', () => {
    const project = twoFloorLinkedProject({ floor1: { hubs: [{ id: 'drop-x', kind: 'drop', x: 0, y: 0, mountHeightM: 2, extraLengthM: 7 }] } })
    const beyond = resolveHubBeyondLength(project, { floorId: 'floor-1', hubId: 'drop-x' })
    // routeHeightM 3, hubEffectiveHeightM(drop, 2) = -2 => |3 - (-2)| = 5, + extraLengthM 7 = 12
    expect(beyond).toEqual({ source: 'typed', run: { nominal: 12, min: 12, max: 12 } })
  })

  it('a linked point whose partner has no trunk yet is still typed', () => {
    const project = twoFloorLinkedProject({ floor1: { hubs: [{ id: 'drop-1', kind: 'drop', x: 700, y: 500, mountHeightM: 0, link: { floorId: 'floor-0', hubId: 'riser-1' } }] } })
    const beyond = resolveHubBeyondLength(project, { floorId: 'floor-0', hubId: 'riser-1' })
    expect(beyond.source).toBe('typed')
  })
})

describe('resolveHubBeyondLength - computed (route) mode: the two-floor worked example', () => {
  const project = twoFloorLinkedProject()
  const beyond = resolveHubBeyondLength(project, { floorId: 'floor-0', hubId: 'riser-1' }, CROSS_FLOOR_CABLE)

  it('crossing vertical = the riser floor\'s own floorHeightM (3), ignoring both hubs\' mountHeightM', () => {
    expect(beyond.source).toBe('route')
    if (beyond.source !== 'route') return
    expect(beyond.crossingVerticalM).toBe(3)
    expect(beyond.viaLabel).toBe('Floor 2 D1')
  })

  it('run = crossing (3) + floor-2 route (10 m, min 9.852217, max 10.152284) + plain-hub-2 typed (1.5)', () => {
    if (beyond.source !== 'route') throw new Error('expected route')
    expect(beyond.run.nominal).toBeCloseTo(14.5, 6)
    expect(beyond.run.min!).toBeCloseTo(14.352217, 6)
    expect(beyond.run.max!).toBeCloseTo(14.652284, 6)
  })

  it('changing floor 1 (riser\'s floor) floorHeightM changes the crossing vertical only', () => {
    const taller = twoFloorLinkedProject({ floor0: { floorHeightM: 5 } })
    const changed = resolveHubBeyondLength(taller, { floorId: 'floor-0', hubId: 'riser-1' }, CROSS_FLOOR_CABLE)
    if (changed.source !== 'route') throw new Error('expected route')
    expect(changed.crossingVerticalM).toBe(5)
    expect(changed.run.nominal).toBeCloseTo(16.5, 6) // +2 over the 14.5 baseline
  })

  it('changing the far floor\'s own floorHeightM (floor 2, not in the crossing) changes nothing', () => {
    const untouched = twoFloorLinkedProject({ floor1: { floorHeightM: 99 } })
    const same = resolveHubBeyondLength(untouched, { floorId: 'floor-0', hubId: 'riser-1' }, CROSS_FLOOR_CABLE)
    expect(same).toEqual(beyond)
  })
})

describe('resolveHubBeyondLength - unavailable', () => {
  it('the linked floor has no scale: unavailable, names that floor', () => {
    const project = twoFloorLinkedProject({ floor1: { scale: null } })
    const beyond = resolveHubBeyondLength(project, { floorId: 'floor-0', hubId: 'riser-1' }, CROSS_FLOOR_CABLE)
    expect(beyond).toEqual({ source: 'unavailable', reason: 'linked-floor-scale-not-set', floorName: 'Floor 2' })
  })

  it('a cycle (a trunk chain that loops back on itself) is detected, not an infinite loop', () => {
    // riser-1 (floor 0) -> [via its link partner] drop-1 (floor 1) -> trunk -> riser-2 (floor 1)
    // -> [via its link partner] drop-2 (floor 0) -> trunk -> riser-1 again. The resolver follows
    // trunk targets regardless of the usual riser-below/drop-above direction rule (a crafted or
    // corrupted file need not respect it), so this loop must still terminate safely.
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
    const beyond = resolveHubBeyondLength(project, { floorId: 'floor-0', hubId: 'riser-1' }, CROSS_FLOOR_CABLE)
    expect(beyond).toMatchObject({ source: 'unavailable', reason: 'link-cycle' })
  })
})

describe('resolveHubBeyondLength - drop-side route mode (item 8 test gap: cable on the UPPER floor, riser carries the trunk)', () => {
  it('vertical = the LOWER floor\'s (riser\'s) floorHeightM - symmetric with the riser-side worked example', () => {
    const project = twoFloorLinkedProject({
      floor0: {
        hubs: [
          {
            id: 'riser-1',
            kind: 'riser',
            x: 700,
            y: 500,
            mountHeightM: 3,
            link: { floorId: 'floor-1', hubId: 'drop-1' },
            trunk: { hubId: 'plain-on-0', points: [{ x: 700, y: 800 }] },
          },
          { id: 'plain-on-0', x: 1400, y: 800, mountHeightM: 1.5 },
        ],
      },
      floor1: {
        hubs: [{ id: 'drop-1', kind: 'drop', x: 700, y: 500, mountHeightM: 0, link: { floorId: 'floor-0', hubId: 'riser-1' } }],
      },
    })
    // The cable ends on the DROP (floor 1, the UPPER floor) - its partner (the riser, floor 0,
    // the LOWER floor) carries the trunk, continuing on floor 0: (700,500)->(700,800)->(1400,800)
    // = 1000 px => 10 m at floor 0's 100 px/m.
    const beyond = resolveHubBeyondLength(project, { floorId: 'floor-1', hubId: 'drop-1' })
    if (beyond.source !== 'route') throw new Error('expected route')
    expect(beyond.crossingVerticalM).toBe(3) // floor 0's (the riser's, the LOWER floor's) own height
    expect(beyond.viaLabel).toBe('Floor 1 R1')
    // crossing 3 + horizontal 10 (min 9.852217, max 10.152284) + plain-on-0 typed |3 - 1.5| = 1.5 => 14.5
    expect(beyond.run.nominal).toBeCloseTo(14.5, 6)
    expect(beyond.run.min!).toBeCloseTo(14.352217, 6)
    expect(beyond.run.max!).toBeCloseTo(14.652284, 6)
  })
})

describe('resolveHubBeyondLength - legal zig-zag across only two floors (regression: false link-cycle)', () => {
  // A (riser, floor 0) <-> B (drop, floor 1); B.trunk -> X (drop, floor 1) <-> Y (riser, floor 0);
  // Y.trunk -> Z (riser, floor 0) <-> W (drop, floor 1); W.trunk -> plain hub P (floor 1). Four
  // distinct hub pairs cross the SAME two floors back and forth - a legal chain with more hops
  // than there are floors. The old `depth > floors.length` backstop (2 floors, but 3 crossings)
  // falsely flagged this as a cycle; the visited set (a genuine revisit, never hit here) is the
  // only real test now.
  function zigZagFloors() {
    const scale = { planPxPerMeter: 100, refLine: { x1: 0, y1: 0, x2: 400, y2: 0 }, refLengthM: 4 }
    const emptyFields = { cameras: [], walls: [], sensors: [], cables: [], fireAlarmDevices: [] }
    const floor0 = {
      id: 'floor-0',
      name: 'Floor 1',
      floorHeightM: 2,
      image: null,
      scale,
      ...emptyFields,
      hubs: [
        { id: 'A', kind: 'riser' as const, x: 500, y: 999, mountHeightM: 3, link: { floorId: 'floor-1', hubId: 'B' } },
        {
          id: 'Y',
          kind: 'riser' as const,
          x: 0,
          y: 0,
          mountHeightM: 3,
          link: { floorId: 'floor-1', hubId: 'X' },
          trunk: { hubId: 'Z', points: [] },
        },
        { id: 'Z', kind: 'riser' as const, x: 1000, y: 0, mountHeightM: 3, link: { floorId: 'floor-1', hubId: 'W' } },
      ],
    }
    const floor1 = {
      id: 'floor-1',
      name: 'Floor 2',
      floorHeightM: 99, // never read - every crossing in this chain uses floor 0's height (the riser side)
      image: null,
      scale,
      ...emptyFields,
      hubs: [
        { id: 'B', kind: 'drop' as const, x: 0, y: 0, mountHeightM: 0, link: { floorId: 'floor-0', hubId: 'A' }, trunk: { hubId: 'X', points: [] } },
        { id: 'X', kind: 'drop' as const, x: 1000, y: 0, mountHeightM: 0, link: { floorId: 'floor-0', hubId: 'Y' } },
        { id: 'W', kind: 'drop' as const, x: 0, y: 500, mountHeightM: 0, link: { floorId: 'floor-0', hubId: 'Z' }, trunk: { hubId: 'P', points: [] } },
        { id: 'P', x: 1000, y: 500, mountHeightM: 1.5 },
      ],
    }
    return [floor0, floor1]
  }

  it('resolves (no false cycle), hand-computed total', () => {
    const project = { ...twoFloorLinkedProject(), floors: zigZagFloors() }
    const beyond = resolveHubBeyondLength(project, { floorId: 'floor-0', hubId: 'A' })
    // 3 crossings x floor 0's 2 m height = 6; 3 trunk legs of 1000 px @ 100 px/m = 10 m each = 30;
    // + plain hub P typed |routeHeightM 3 - mountHeightM 1.5| = 1.5. Total = 6 + 30 + 1.5 = 37.5.
    expect(beyond.source).toBe('route')
    if (beyond.source !== 'route') return
    expect(beyond.run.nominal).toBeCloseTo(37.5, 6)
    expect(beyond.run.min!).toBeCloseTo(37.056650, 5)
    expect(beyond.run.max!).toBeCloseTo(37.956853, 5)
  })
})

describe('resolveHubBeyondLength - chain over three floors', () => {
  it('sums each hop\'s own floor height, and nests each hop\'s own scale/uncertainty', () => {
    const project = threeFloorChainProject()
    const beyond = resolveHubBeyondLength(project, { floorId: 'floor-0', hubId: 'riser-1' }, CROSS_FLOOR_CABLE)
    if (beyond.source !== 'route') throw new Error('expected route')
    expect(beyond.crossingVerticalM).toBe(3) // hop 1's own vertical (floor 0)
    expect(beyond.run.nominal).toBeCloseTo(26.5, 6) // 3 + 10 + 13.5 (hop 2's own total)
    expect(beyond.run.min!).toBeCloseTo(26.204433, 6)
    expect(beyond.run.max!).toBeCloseTo(26.804569, 6)
  })
})

describe('resolveCableBeyondLengths', () => {
  it('resolves every floor\'s cables, caching one result per hub', () => {
    const project = twoFloorLinkedProject()
    const byFloor = resolveCableBeyondLengths(project)
    expect(byFloor.get('floor-0')?.get('cross-cable-1')?.source).toBe('route')
    expect(byFloor.get('floor-1')?.size).toBe(0) // floor 1 has no cables of its own in this fixture
  })

  it('skips a cable whose hub no longer exists (same as today\'s dangling-cable handling)', () => {
    const project = twoFloorLinkedProject()
    expect(project.floors[0].cables).toHaveLength(1) // sanity: fixture has exactly one cable
    const withDanglingCable = {
      ...project,
      floors: [{ ...project.floors[0], cables: [{ ...project.floors[0].cables[0], hubId: 'gone' }] }, project.floors[1]],
    }
    expect(resolveCableBeyondLengths(withDanglingCable).get('floor-0')?.size).toBe(0)
  })
})
