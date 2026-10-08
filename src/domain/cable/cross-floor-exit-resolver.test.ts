import { describe, expect, it } from 'vitest'
import { resolveCrossFloorExit } from './cross-floor-exit-resolver'
import { CROSS_FLOOR_CABLE, twoFloorLinkedProject } from './cross-floor-worked-example.test-fixtures'

describe('resolveCrossFloorExit', () => {
  it('returns the partner hub + its floor when linked and the partner has a trunk', () => {
    const { floors } = twoFloorLinkedProject()
    const exit = resolveCrossFloorExit(floors, { floorId: 'floor-0', hubId: 'riser-1' }, CROSS_FLOOR_CABLE)
    expect(exit).not.toBeNull()
    expect(exit!.floorIndex).toBe(1)
    expect(exit!.hub.id).toBe('drop-1')
  })

  it('is null when unlinked', () => {
    const { floors } = twoFloorLinkedProject({ floor0: { hubs: [{ id: 'plain', x: 0, y: 0, mountHeightM: 1.5 }] } })
    expect(resolveCrossFloorExit(floors, { floorId: 'floor-0', hubId: 'plain' }, CROSS_FLOOR_CABLE)).toBeNull()
  })

  it('is null when linked but the partner has no trunk yet (typed mode)', () => {
    const { floors } = twoFloorLinkedProject({ floor1: { hubs: [{ id: 'drop-1', kind: 'drop', x: 700, y: 500, mountHeightM: 0, link: { floorId: 'floor-0', hubId: 'riser-1' } }] } })
    expect(resolveCrossFloorExit(floors, { floorId: 'floor-0', hubId: 'riser-1' }, CROSS_FLOOR_CABLE)).toBeNull()
  })

  it('is null for an unknown ref', () => {
    const { floors } = twoFloorLinkedProject()
    expect(resolveCrossFloorExit(floors, { floorId: 'floor-0', hubId: 'gone' }, CROSS_FLOOR_CABLE)).toBeNull()
    expect(resolveCrossFloorExit(floors, { floorId: 'gone', hubId: 'riser-1' }, CROSS_FLOOR_CABLE)).toBeNull()
  })

  it('works without a cable (the hub panel query has none in view)', () => {
    const { floors } = twoFloorLinkedProject()
    expect(resolveCrossFloorExit(floors, { floorId: 'floor-0', hubId: 'riser-1' })?.hub.id).toBe('drop-1')
  })
})
