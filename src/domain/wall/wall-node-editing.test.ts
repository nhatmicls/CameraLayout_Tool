import { describe, expect, it } from 'vitest'
import { listWallNodes, moveWallNode } from './wall-node-editing'

const wall = (id: string, x1: number, y1: number, x2: number, y2: number) => ({ id, kind: 'opaque', x1, y1, x2, y2 })

const TOP = wall('top', 0, 0, 100, 0)
const RIGHT = wall('right', 100, 0, 100, 100)
const FAR = wall('far', 300, 300, 400, 300)

describe('listWallNodes', () => {
  it('returns each distinct wall end once, a shared corner included', () => {
    expect(listWallNodes([TOP, RIGHT, FAR])).toEqual([
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 100 },
      { x: 300, y: 300 },
      { x: 400, y: 300 },
    ])
  })

  it('returns nothing for no walls', () => {
    expect(listWallNodes([])).toEqual([])
  })
})

describe('moveWallNode', () => {
  it('moves a free end and leaves the other end where it was', () => {
    const next = moveWallNode([TOP], { x: 0, y: 0 }, { x: -20, y: 30 })
    expect(next).toEqual([wall('top', -20, 30, 100, 0)])
  })

  it('moves every wall end on a shared corner, so the corner stays joined', () => {
    const next = moveWallNode([TOP, RIGHT, FAR], { x: 100, y: 0 }, { x: 120, y: -10 })
    expect(next).toEqual([wall('top', 0, 0, 120, -10), wall('right', 120, -10, 100, 100), FAR])
  })

  it('keeps the object identity of walls that do not touch the node, and other fields of those that do', () => {
    const next = moveWallNode([TOP, RIGHT, FAR], { x: 100, y: 0 }, { x: 120, y: -10 })
    expect(next![2]).toBe(FAR)
    expect(next![0]).not.toBe(TOP)
    expect(next![0]).toMatchObject({ id: 'top', kind: 'opaque' })
  })

  it('does not mutate its input', () => {
    const walls = [TOP, RIGHT]
    moveWallNode(walls, { x: 100, y: 0 }, { x: 150, y: 50 })
    expect(walls).toEqual([wall('top', 0, 0, 100, 0), wall('right', 100, 0, 100, 100)])
  })

  it('returns null when no wall ends on the node (a point on a wall body is not a node)', () => {
    expect(moveWallNode([TOP], { x: 50, y: 0 }, { x: 50, y: 40 })).toBeNull()
  })

  it('returns null when the node does not actually move', () => {
    expect(moveWallNode([TOP], { x: 0, y: 0 }, { x: 0, y: 0 })).toBeNull()
  })

  it('returns null rather than collapse a wall onto its own other end', () => {
    expect(moveWallNode([TOP, RIGHT], { x: 100, y: 0 }, { x: 0, y: 0 })).toBeNull()
    expect(moveWallNode([TOP], { x: 100, y: 0 }, { x: 0.5, y: 0 })).toBeNull()
  })

  it('merges two nodes when one is dropped exactly on another', () => {
    const next = moveWallNode([TOP, FAR], { x: 300, y: 300 }, { x: 100, y: 0 })
    expect(listWallNodes(next!)).toEqual([
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 400, y: 300 },
    ])
  })
})
