import { describe, expect, it } from 'vitest'
import { hubLabels } from './cable-endpoint-index'
import type { Hub, Shaft } from './cable-layout-types'
import { findShaftMarkers, pruneShafts } from './shaft-integrity'
import { SHAFT_ID, SHAFT_MARKER_F1, shaftCable, shaftFourFloorProject } from './shaft-worked-example.test-fixtures'

describe('findShaftMarkers', () => {
  it('finds all four markers in floor order', () => {
    const { floors } = shaftFourFloorProject()
    const markers = findShaftMarkers(floors, SHAFT_ID)
    expect(markers.map((m) => m.hub.id)).toEqual(['sm1', 'sm2', 'sm3', 'sm4'])
    expect(markers.map((m) => m.floorIndex)).toEqual([0, 1, 2, 3])
  })

  it('labels every marker "T1" (project order) on every floor it opens onto', () => {
    const { floors, shafts } = shaftFourFloorProject()
    const shaftIds = shafts.map((s) => s.id)
    for (const floor of floors) {
      const labels = hubLabels(floor.hubs, shaftIds)
      const markerIndex = floor.hubs.findIndex((h) => h.kind === 'shaft')
      expect(labels[markerIndex]).toBe('T1')
    }
  })

  it('a second shaft gets "T2"; H/R/D numbering is unaffected by a shaft marker sharing the floor', () => {
    const plainHub: Hub = { id: 'plain', x: 1, y: 1, mountHeightM: 1.5 }
    const riser: Hub = { id: 'riser', kind: 'riser', x: 2, y: 2, mountHeightM: 3 }
    const secondShaftMarker: Hub = { id: 'other-shaft-marker', kind: 'shaft', shaftId: 'shaft-2', x: 3, y: 3, mountHeightM: 0 }
    const hubs = [plainHub, riser, SHAFT_MARKER_F1, secondShaftMarker]
    const shaftIds = [SHAFT_ID, 'shaft-2']
    expect(hubLabels(hubs, shaftIds)).toEqual(['H1', 'R1', 'T1', 'T2'])
  })

  it('returns empty for a shaft with no markers', () => {
    const { floors } = shaftFourFloorProject()
    expect(findShaftMarkers(floors, 'unknown-shaft')).toEqual([])
  })
})

describe('pruneShafts', () => {
  const shafts: Shaft[] = [{ id: SHAFT_ID, name: 'Main shaft' }]

  it('is a no-op (same references) on a clean project', () => {
    const { floors } = shaftFourFloorProject()
    const result = pruneShafts(floors, shafts)
    expect(result.floors).toBe(floors)
    expect(result.shafts).toBe(shafts)
  })

  it('drops a marker referencing an unknown shaft, with a warning, before any cable-ref check', () => {
    const { floors } = shaftFourFloorProject()
    const rogue: Hub = { id: 'rogue', kind: 'shaft', shaftId: 'ghost-shaft', x: 1, y: 1, mountHeightM: 0 }
    const withRogue = floors.map((f, i) => (i === 1 ? { ...f, hubs: [...f.hubs, rogue], cables: [shaftCable('rogue-cable', 'rogue')] } : f))
    const warnings: string[] = []
    const result = pruneShafts(withRogue, shafts, warnings)
    expect(result.floors[1].hubs.some((h) => h.id === 'rogue')).toBe(false)
    expect(result.floors[1].cables).toEqual([]) // its cable goes with it
    expect(warnings).toEqual(['F2: a shaft marker references an unknown shaft; dropped.'])
  })

  it('drops a duplicate marker of the same shaft on one floor, keeping the first', () => {
    const { floors } = shaftFourFloorProject()
    const dup: Hub = { id: 'dup-marker', kind: 'shaft', shaftId: SHAFT_ID, x: 9, y: 9, mountHeightM: 0 }
    const withDup = floors.map((f, i) => (i === 1 ? { ...f, hubs: [...f.hubs, dup] } : f))
    const warnings: string[] = []
    const result = pruneShafts(withDup, shafts, warnings)
    expect(result.floors[1].hubs.map((h) => h.id)).toEqual(['sm2']) // kept the first, dup dropped
    expect(warnings).toEqual(['F2: a duplicate marker for the same shaft was dropped.'])
  })

  it('drops a shafts[] entry with no marker anywhere, with a warning', () => {
    const { floors } = shaftFourFloorProject()
    const noMarkerFloors = floors.map((f) => ({ ...f, hubs: f.hubs.filter((h) => h.kind !== 'shaft') }))
    const warnings: string[] = []
    const result = pruneShafts(noMarkerFloors, shafts, warnings)
    expect(result.shafts).toEqual([])
    expect(warnings).toEqual(['Shaft "Main shaft" has no markers; dropped.'])
  })
})
