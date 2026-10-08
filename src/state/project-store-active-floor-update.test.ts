import { describe, expect, it } from 'vitest'
import { buildFloor } from '../domain/project-file/project-file-test-fixtures'
import { patchActiveFloor, patchFloorById } from './project-store-active-floor-update'

describe('patchActiveFloor', () => {
  it('patches the floor matching activeFloorId', () => {
    const floorA = buildFloor({ id: 'a', name: 'A' })
    const floorB = buildFloor({ id: 'b', name: 'B' })
    const result = patchActiveFloor({ floors: [floorA, floorB], activeFloorId: 'b', shafts: [] }, { scale: null })
    expect(result.floors[0]).toBe(floorA) // untouched floor keeps identity
    expect(result.floors[1]).not.toBe(floorB)
    expect(result.floors[1].id).toBe('b')
  })

  // Regression (coordinator review W3): a dangling `activeFloorId` (points at nothing in
  // `floors`) must resolve the SAME floor `selectActiveFloor` would (`floors[0]`), not silently
  // patch nothing while still returning a new array - that used to look like a real edit (new
  // `floors` reference -> a recorded undo step) while actually dropping the caller's patch.
  it('falls back to floors[0] when activeFloorId matches no floor, same as selectActiveFloor', () => {
    const floorA = buildFloor({ id: 'a', name: 'A' })
    const floorB = buildFloor({ id: 'b', name: 'B' })
    const result = patchActiveFloor({ floors: [floorA, floorB], activeFloorId: 'does-not-exist', shafts: [] }, { scale: null, cameras: [{ id: 'c1', modelId: 'm', x: 1, y: 1, rotationDeg: 0, rangeM: 5 }] })
    expect(result.floors[0]).not.toBe(floorA)
    expect(result.floors[0].cameras).toHaveLength(1)
    expect(result.floors[1]).toBe(floorB) // the other floor is untouched
  })
})

describe('patchFloorById', () => {
  it('patches the floor with the given id and leaves the rest untouched', () => {
    const floorA = buildFloor({ id: 'a', name: 'A' })
    const floorB = buildFloor({ id: 'b', name: 'B' })
    const result = patchFloorById({ floors: [floorA, floorB], shafts: [] }, 'b', { scale: null })
    expect(result.floors[0]).toBe(floorA)
    expect(result.floors[1]).not.toBe(floorB)
  })

  it('returns the SAME floors array when the id is unknown', () => {
    const floors = [buildFloor({ id: 'a' })]
    const result = patchFloorById({ floors, shafts: [] }, 'unknown', { scale: null })
    expect(result.floors).toBe(floors)
  })
})
