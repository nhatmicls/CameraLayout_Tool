import { describe, expect, it } from 'vitest'
import { MAX_HUBS, type Hub, type Shaft } from './cable-layout-types'
import { createShaftMarkers, removeShaft } from './shaft-marker-lifecycle'
import { SHAFT_ID, shaftCable, shaftFourFloorProject } from './shaft-worked-example.test-fixtures'

describe('createShaftMarkers', () => {
  it('places one marker, clamped, on every floor in range that has an image', () => {
    const { floors } = shaftFourFloorProject()
    const newShaftId = 'new-shaft'
    let seq = 0
    const { floors: next, skippedFloorNames } = createShaftMarkers(floors, newShaftId, 0, 1, { x: -50, y: 99999 }, () => `new-marker-${++seq}`)
    expect(skippedFloorNames).toEqual([])
    expect(next[0].hubs.some((h) => h.id === 'new-marker-1' && h.kind === 'shaft' && h.shaftId === newShaftId)).toBe(true)
    expect(next[1].hubs.some((h) => h.id === 'new-marker-2')).toBe(true)
    expect(next[2].hubs.some((h) => h.shaftId === newShaftId)).toBe(false) // outside the range
    // Clamped into the (2000x2000) image bounds, not left at the raw (-50, 99999).
    const marker = next[0].hubs.find((h) => h.id === 'new-marker-1')!
    expect(marker.x).toBeGreaterThanOrEqual(0)
    expect(marker.y).toBeLessThanOrEqual(2000)
  })

  it('is order-independent: fromFloorIndex/toFloorIndex may be given high-to-low', () => {
    const { floors } = shaftFourFloorProject()
    const { floors: next } = createShaftMarkers(floors, 'x', 3, 1, { x: 0, y: 0 }, () => 'm')
    expect(next[1].hubs.some((h) => h.shaftId === 'x')).toBe(true)
    expect(next[2].hubs.some((h) => h.shaftId === 'x')).toBe(true)
    expect(next[3].hubs.some((h) => h.shaftId === 'x')).toBe(true)
    expect(next[0].hubs.some((h) => h.shaftId === 'x')).toBe(false)
  })

  it('skips a floor with no image, naming it - never silently drops it', () => {
    const { floors } = shaftFourFloorProject([{ image: null, scale: null }])
    const { floors: next, skippedFloorNames } = createShaftMarkers(floors, 'x', 0, 1, { x: 0, y: 0 }, () => 'm')
    expect(skippedFloorNames).toEqual(['F1 (no plan image)'])
    expect(next[0]).toBe(floors[0]) // untouched
    expect(next[1].hubs.some((h) => h.shaftId === 'x')).toBe(true) // the other floor in range still gets one
  })

  it('skips a floor already at MAX_HUBS, naming it', () => {
    const fullOfHubs: Hub[] = Array.from({ length: MAX_HUBS }, (_, i) => ({ id: `h${i}`, x: 1, y: 1, mountHeightM: 1.5 }))
    const { floors } = shaftFourFloorProject([{ hubs: fullOfHubs }])
    const { skippedFloorNames } = createShaftMarkers(floors, 'x', 0, 0, { x: 0, y: 0 }, () => 'm')
    expect(skippedFloorNames).toEqual([`F1 (at the ${MAX_HUBS}-hub limit)`])
  })

  it('M2: skips (never duplicates) a floor that already has a marker of this SAME shaft', () => {
    const { floors } = shaftFourFloorProject() // sf0 already has a marker of SHAFT_ID
    const { floors: next, skippedFloorNames } = createShaftMarkers(floors, SHAFT_ID, 0, 0, { x: 5, y: 5 }, () => 'new-marker')
    expect(skippedFloorNames).toEqual(['F1 (already has an opening for this shaft)'])
    expect(next[0]).toBe(floors[0]) // untouched - no duplicate added
    expect(next[0].hubs.filter((h) => h.kind === 'shaft' && h.shaftId === SHAFT_ID)).toHaveLength(1)
  })

  it('a DIFFERENT shaft can still get a marker on a floor that already holds another shaft\'s marker', () => {
    const { floors } = shaftFourFloorProject()
    const { floors: next, skippedFloorNames } = createShaftMarkers(floors, 'other-shaft', 0, 0, { x: 5, y: 5 }, () => 'new-marker')
    expect(skippedFloorNames).toEqual([])
    expect(next[0].hubs.some((h) => h.shaftId === 'other-shaft')).toBe(true)
  })
})

describe('removeShaft', () => {
  const shafts: Shaft[] = [{ id: SHAFT_ID, name: 'Main shaft' }]

  it('removes every marker, their cables, and the shafts[] entry - one pass', () => {
    const { floors } = shaftFourFloorProject([{}, { cables: [shaftCable('c1', 'sm2')] }, {}, { cables: [shaftCable('c2', 'sm4')] }])
    const result = removeShaft(floors, shafts, SHAFT_ID)
    for (const floor of result.floors) {
      expect(floor.hubs.some((h) => h.shaftId === SHAFT_ID)).toBe(false)
      expect(floor.cables).toEqual([])
    }
    expect(result.shafts).toEqual([])
  })

  it('clears another hub\'s trunk that targeted one of the removed markers (the chain-target case)', () => {
    const { floors } = shaftFourFloorProject()
    const riser: Hub = { id: 'riser-x', kind: 'riser', x: 1, y: 1, mountHeightM: 3, trunk: { hubId: 'sm1', points: [] }, link: { floorId: 'sf0', hubId: 'sm1' } }
    const withChainingRiser = floors.map((f, i) => (i === 1 ? { ...f, hubs: [...f.hubs, riser] } : f))
    const result = removeShaft(withChainingRiser, shafts, SHAFT_ID)
    expect(result.floors[1].hubs.find((h) => h.id === 'riser-x')?.trunk).toBeUndefined()
  })

  it('is a no-op shape (new objects, but equivalent) when the shaft has no markers already', () => {
    const { floors } = shaftFourFloorProject()
    const noMarkerFloors = floors.map((f) => ({ ...f, hubs: f.hubs.filter((h) => h.kind !== 'shaft') }))
    const result = removeShaft(noMarkerFloors, shafts, SHAFT_ID)
    expect(result.shafts).toEqual([])
  })
})
