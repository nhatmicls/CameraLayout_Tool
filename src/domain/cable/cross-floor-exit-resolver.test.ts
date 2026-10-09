import { describe, expect, it } from 'vitest'
import { buildFloor } from '../project-file/project-file-test-fixtures'
import { resolveCrossFloorExit } from './cross-floor-exit-resolver'
import { twoFloorLinkedProject } from './cross-floor-worked-example.test-fixtures'

describe('resolveCrossFloorExit', () => {
  it('returns the partner hub + its floor when linked and the partner has a trunk', () => {
    const { floors } = twoFloorLinkedProject()
    const exit = resolveCrossFloorExit(floors, { floorId: 'floor-0', hubId: 'riser-1' })
    expect(exit.kind).toBe('exit')
    if (exit.kind !== 'exit') throw new Error('unreachable')
    expect(exit.floorIndex).toBe(1)
    expect(exit.hub.id).toBe('drop-1')
  })

  it('is "none" when unlinked', () => {
    const { floors } = twoFloorLinkedProject({ floor0: { hubs: [{ id: 'plain', x: 0, y: 0, mountHeightM: 1.5 }] } })
    expect(resolveCrossFloorExit(floors, { floorId: 'floor-0', hubId: 'plain' })).toEqual({ kind: 'none' })
  })

  it('is "none" when linked but the partner has no trunk yet (typed mode)', () => {
    const { floors } = twoFloorLinkedProject({ floor1: { hubs: [{ id: 'drop-1', kind: 'drop', x: 700, y: 500, mountHeightM: 0, link: { floorId: 'floor-0', hubId: 'riser-1' } }] } })
    expect(resolveCrossFloorExit(floors, { floorId: 'floor-0', hubId: 'riser-1' })).toEqual({ kind: 'none' })
  })

  it('is "none" for an unknown ref', () => {
    const { floors } = twoFloorLinkedProject()
    expect(resolveCrossFloorExit(floors, { floorId: 'floor-0', hubId: 'gone' })).toEqual({ kind: 'none' })
    expect(resolveCrossFloorExit(floors, { floorId: 'gone', hubId: 'riser-1' })).toEqual({ kind: 'none' })
  })

})

describe('resolveCrossFloorExit - shaft openings', () => {
  it('is always "none": a cable through a shaft owns its route beyond it, there is no shared exit', () => {
    const floors = [
      buildFloor({ id: 'f0', name: 'Floor 1', hubs: [{ id: 'm0', kind: 'shaft', shaftId: 's1', x: 0, y: 0, mountHeightM: 0 }] }),
      buildFloor({ id: 'f1', name: 'Floor 2', hubs: [{ id: 'm1', kind: 'shaft', shaftId: 's1', x: 0, y: 0, mountHeightM: 0 }, { id: 'h1', x: 5, y: 5, mountHeightM: 1.5 }] }),
    ]
    expect(resolveCrossFloorExit(floors, { floorId: 'f0', hubId: 'm0' })).toEqual({ kind: 'none' })
  })
})
