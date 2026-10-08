import { describe, expect, it } from 'vitest'
import { buildFloor } from '../project-file/project-file-test-fixtures'
import { createEmptyFloor, MAX_FLOORS, type Floor } from './floor-types'
import {
  addFloorToList,
  defaultFloorName,
  findChangedFloorIds,
  moveFloorInList,
  nearestFloorIndexAfterRemoval,
  removeFloorFromList,
  renameFloorInList,
} from './floor-list-editing'

const floorA = () => buildFloor({ id: 'a', name: 'Floor A' })
const floorB = () => buildFloor({ id: 'b', name: 'Floor B' })
const floorC = () => buildFloor({ id: 'c', name: 'Floor C' })

describe('defaultFloorName', () => {
  it('is "Floor 1" for an empty list', () => {
    expect(defaultFloorName([])).toBe('Floor 1')
  })

  it('is the lowest unused "Floor N" - NOT just count + 1 (Low item fix)', () => {
    // Neither existing floor is actually named "Floor 1" or "Floor 2" (they're "Floor A"/"Floor
    // B") - the OLD `floors.length + 1` behaviour would have returned "Floor 3" here, which is
    // fine in THIS case but wrong in the next one.
    expect(defaultFloorName([floorA(), floorB()])).toBe('Floor 1')
  })

  it('never produces a name that collides with an existing one, even out of numeric order', () => {
    const floors = [buildFloor({ id: 'x', name: 'Floor 1' }), buildFloor({ id: 'y', name: 'Floor 3' })]
    expect(defaultFloorName(floors)).toBe('Floor 2') // "Floor 1" and "Floor 3" taken; "Floor 2" is free
  })

  it('counts up past every consecutively-used name', () => {
    const floors = [buildFloor({ id: 'x', name: 'Floor 1' }), buildFloor({ id: 'y', name: 'Floor 2' })]
    expect(defaultFloorName(floors)).toBe('Floor 3')
  })
})

describe('addFloorToList', () => {
  it('appends the new floor', () => {
    const floors = [floorA()]
    const newFloor = createEmptyFloor('new', 'Floor 2')
    expect(addFloorToList(floors, newFloor)).toEqual([floorA(), newFloor])
  })

  it('is a no-op (same array) at MAX_FLOORS', () => {
    const floors: Floor[] = Array.from({ length: MAX_FLOORS }, (_, i) => createEmptyFloor(`f${i}`, `Floor ${i}`))
    const result = addFloorToList(floors, createEmptyFloor('extra', 'Extra'))
    expect(result).toBe(floors)
  })
})

describe('renameFloorInList', () => {
  it('renames the matching floor, trimmed', () => {
    const floors = [floorA(), floorB()]
    const result = renameFloorInList(floors, 'a', '  New Name  ')
    expect(result[0].name).toBe('New Name')
    expect(result[1]).toBe(floors[1]) // untouched floor keeps identity
  })

  it('is a no-op (same array) for an unknown id', () => {
    const floors = [floorA()]
    expect(renameFloorInList(floors, 'unknown', 'X')).toBe(floors)
  })

  it('is a no-op for an empty/whitespace-only name', () => {
    const floors = [floorA()]
    expect(renameFloorInList(floors, 'a', '   ')).toBe(floors)
  })

  it('is a no-op when the trimmed name equals the current name', () => {
    const floors = [floorA()]
    expect(renameFloorInList(floors, 'a', 'Floor A')).toBe(floors)
  })
})

describe('moveFloorInList', () => {
  it('moves the floor to the target index', () => {
    const floors = [floorA(), floorB(), floorC()]
    const result = moveFloorInList(floors, 'c', 0)
    expect(result.map((f) => f.id)).toEqual(['c', 'a', 'b'])
  })

  it('clamps an out-of-range index', () => {
    const floors = [floorA(), floorB(), floorC()]
    expect(moveFloorInList(floors, 'a', 99).map((f) => f.id)).toEqual(['b', 'c', 'a'])
    expect(moveFloorInList(floors, 'c', -5).map((f) => f.id)).toEqual(['c', 'a', 'b'])
  })

  it('is a no-op (same array) for an unknown id', () => {
    const floors = [floorA(), floorB()]
    expect(moveFloorInList(floors, 'unknown', 0)).toBe(floors)
  })

  it('is a no-op when already at that index', () => {
    const floors = [floorA(), floorB()]
    expect(moveFloorInList(floors, 'a', 0)).toBe(floors)
  })
})

describe('removeFloorFromList', () => {
  it('removes the matching floor', () => {
    const floors = [floorA(), floorB()]
    expect(removeFloorFromList(floors, 'a').map((f) => f.id)).toEqual(['b'])
  })

  it('is a no-op (same array) on the last floor', () => {
    const floors = [floorA()]
    expect(removeFloorFromList(floors, 'a')).toBe(floors)
  })

  it('is a no-op (same array) for an unknown id', () => {
    const floors = [floorA(), floorB()]
    expect(removeFloorFromList(floors, 'unknown')).toBe(floors)
  })
})

describe('nearestFloorIndexAfterRemoval', () => {
  it('returns the same index (the floor that slides into the removed slot) when not at the end', () => {
    expect(nearestFloorIndexAfterRemoval(1, 2)).toBe(1) // removed index 1 of 3 -> 2 remain, index 1 still valid
  })

  it('clamps to the new last index when the removed floor was last', () => {
    expect(nearestFloorIndexAfterRemoval(2, 2)).toBe(1) // removed the last of 3 -> 2 remain, last index is 1
  })

  it('clamps to 0 when only one floor remains', () => {
    expect(nearestFloorIndexAfterRemoval(0, 1)).toBe(0)
  })

  it('clamps a negative (not-found) index up to 0', () => {
    expect(nearestFloorIndexAfterRemoval(-1, 3)).toBe(0)
  })
})

describe('findChangedFloorIds (item 6: the two-floor-changed undo/redo case)', () => {
  it('lists every changed id, in floor order, for exactly two content changes', () => {
    const before = [floorA(), floorB(), floorC()]
    const after = [{ ...before[0], name: 'X' }, before[1], { ...before[2], name: 'Y' }]
    expect(findChangedFloorIds(before, after)).toEqual(['a', 'c'])
  })

  it('one changed floor is still a valid (length-1) result', () => {
    const before = [floorA(), floorB()]
    const after = [{ ...before[0], name: 'X' }, before[1]]
    expect(findChangedFloorIds(before, after)).toEqual(['a'])
  })

  it('is null on length mismatch or a pure reorder; [] when nothing changed', () => {
    const before = [floorA(), floorB()]
    expect(findChangedFloorIds(before, [floorA()])).toBeNull()
    expect(findChangedFloorIds(before, [before[1], before[0]])).toBeNull() // reorder
    expect(findChangedFloorIds(before, before)).toEqual([])
  })
})
