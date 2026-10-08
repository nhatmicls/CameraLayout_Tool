import { describe, expect, it } from 'vitest'
import { buildFloor } from '../project-file/project-file-test-fixtures'
import type { Cable, Hub } from './cable-layout-types'
import { resolveCrossFloorExit } from './cross-floor-exit-resolver'
import { CROSS_FLOOR_CABLE, twoFloorLinkedProject } from './cross-floor-worked-example.test-fixtures'

describe('resolveCrossFloorExit', () => {
  it('returns the partner hub + its floor when linked and the partner has a trunk', () => {
    const { floors } = twoFloorLinkedProject()
    const exit = resolveCrossFloorExit(floors, { floorId: 'floor-0', hubId: 'riser-1' }, CROSS_FLOOR_CABLE)
    expect(exit.kind).toBe('exit')
    if (exit.kind !== 'exit') throw new Error('unreachable')
    expect(exit.floorIndex).toBe(1)
    expect(exit.hub.id).toBe('drop-1')
  })

  it('is "none" when unlinked', () => {
    const { floors } = twoFloorLinkedProject({ floor0: { hubs: [{ id: 'plain', x: 0, y: 0, mountHeightM: 1.5 }] } })
    expect(resolveCrossFloorExit(floors, { floorId: 'floor-0', hubId: 'plain' }, CROSS_FLOOR_CABLE)).toEqual({ kind: 'none' })
  })

  it('is "none" when linked but the partner has no trunk yet (typed mode)', () => {
    const { floors } = twoFloorLinkedProject({ floor1: { hubs: [{ id: 'drop-1', kind: 'drop', x: 700, y: 500, mountHeightM: 0, link: { floorId: 'floor-0', hubId: 'riser-1' } }] } })
    expect(resolveCrossFloorExit(floors, { floorId: 'floor-0', hubId: 'riser-1' }, CROSS_FLOOR_CABLE)).toEqual({ kind: 'none' })
  })

  it('is "none" for an unknown ref', () => {
    const { floors } = twoFloorLinkedProject()
    expect(resolveCrossFloorExit(floors, { floorId: 'floor-0', hubId: 'gone' }, CROSS_FLOOR_CABLE)).toEqual({ kind: 'none' })
    expect(resolveCrossFloorExit(floors, { floorId: 'gone', hubId: 'riser-1' }, CROSS_FLOOR_CABLE)).toEqual({ kind: 'none' })
  })

  it('works without a cable (the hub panel query has none in view)', () => {
    const { floors } = twoFloorLinkedProject()
    const exit = resolveCrossFloorExit(floors, { floorId: 'floor-0', hubId: 'riser-1' })
    expect(exit.kind === 'exit' && exit.hub.id).toBe('drop-1')
  })

  describe('shaft markers', () => {
    const shaftFloors = (hubsByFloor: Hub[][]) => hubsByFloor.map((hubs, i) => buildFloor({ id: `f${i}`, name: `Floor ${i + 1}`, hubs }))

    const M0: Hub = { id: 'm0', kind: 'shaft', shaftId: 's1', x: 0, y: 0, mountHeightM: 0 }
    const M1_NO_TRUNK: Hub = { id: 'm1', kind: 'shaft', shaftId: 's1', x: 0, y: 0, mountHeightM: 0 }
    const H1: Hub = { id: 'h1', x: 50, y: 50, mountHeightM: 1.5 }
    const M1_EXIT: Hub = { ...M1_NO_TRUNK, trunk: { hubId: 'h1', points: [] } }
    const H2: Hub = { id: 'h2', x: 50, y: 50, mountHeightM: 1.5 }
    const M2_EXIT: Hub = { id: 'm2', kind: 'shaft', shaftId: 's1', x: 0, y: 0, mountHeightM: 0, trunk: { hubId: 'h2', points: [] } }
    const NO_CHOICE: Cable = { id: 'c1', device: { kind: 'camera', id: 'cam' }, hubId: 'm0', typeId: 't', points: [] }

    it('is "none" when the shaft has no exit anywhere', () => {
      const floors = shaftFloors([[M0], [M1_NO_TRUNK]])
      expect(resolveCrossFloorExit(floors, { floorId: 'f0', hubId: 'm0' })).toEqual({ kind: 'none' })
    })

    it('is the implicit exit with exactly one', () => {
      const floors = shaftFloors([[M0], [H1, M1_EXIT]])
      const exit = resolveCrossFloorExit(floors, { floorId: 'f0', hubId: 'm0' })
      expect(exit.kind === 'exit' && exit.hub.id).toBe('m1')
    })

    it('is "not-chosen" with several exits and no/stale choice', () => {
      const floors = shaftFloors([[M0], [H1, M1_EXIT], [H2, M2_EXIT]])
      expect(resolveCrossFloorExit(floors, { floorId: 'f0', hubId: 'm0' }, NO_CHOICE)).toEqual({ kind: 'not-chosen' })
      const staleChoice: Cable = { ...NO_CHOICE, exitFloorId: 'does-not-exist' }
      expect(resolveCrossFloorExit(floors, { floorId: 'f0', hubId: 'm0' }, staleChoice)).toEqual({ kind: 'not-chosen' })
    })

    it('resolves to the chosen exit among several', () => {
      const floors = shaftFloors([[M0], [H1, M1_EXIT], [H2, M2_EXIT]])
      const chosen: Cable = { ...NO_CHOICE, exitFloorId: 'f2' }
      const exit = resolveCrossFloorExit(floors, { floorId: 'f0', hubId: 'm0' }, chosen)
      expect(exit.kind === 'exit' && exit.hub.id).toBe('m2')
      expect(exit.kind === 'exit' && exit.floorIndex).toBe(2)
    })
  })
})
