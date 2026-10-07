import { describe, expect, it } from 'vitest'
import { buildFloor } from '../project-file/project-file-test-fixtures'
import { createEmptyFloor, MAX_FLOORS, type Floor } from './floor-types'
import {
  addFloorToList,
  defaultFloorName,
  findSingleChangedFloorId,
  moveFloorInList,
  removeFloorFromList,
  renameFloorInList,
} from './floor-list-editing'

const floorA = () => buildFloor({ id: 'a', name: 'Floor A' })
const floorB = () => buildFloor({ id: 'b', name: 'Floor B' })
const floorC = () => buildFloor({ id: 'c', name: 'Floor C' })

describe('defaultFloorName', () => {
  it('is "Floor N" for the next 1-based position', () => {
    expect(defaultFloorName([])).toBe('Floor 1')
    expect(defaultFloorName([floorA(), floorB()])).toBe('Floor 3')
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

describe('findSingleChangedFloorId', () => {
  it('finds the one floor whose object reference changed', () => {
    const before = [floorA(), floorB()]
    const editedA = { ...before[0], name: 'Edited A' }
    const after = [editedA, before[1]]
    expect(findSingleChangedFloorId(before, after)).toBe('a')
  })

  it('returns null when the lengths differ (floor added/removed)', () => {
    const before = [floorA()]
    const after = [floorA(), floorB()]
    expect(findSingleChangedFloorId(before, after)).toBeNull()
  })

  it('returns null on a pure reorder (same objects, different order)', () => {
    const before = [floorA(), floorB()]
    const after = [before[1], before[0]]
    expect(findSingleChangedFloorId(before, after)).toBeNull()
  })

  it('returns null when more than one floor changed', () => {
    const before = [floorA(), floorB()]
    const after = [{ ...before[0], name: 'X' }, { ...before[1], name: 'Y' }]
    expect(findSingleChangedFloorId(before, after)).toBeNull()
  })

  it('returns null when nothing changed', () => {
    const before = [floorA(), floorB()]
    expect(findSingleChangedFloorId(before, before)).toBeNull()
  })
})
