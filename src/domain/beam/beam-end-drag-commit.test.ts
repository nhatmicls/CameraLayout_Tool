import { describe, expect, it } from 'vitest'
import { resolveBeamEndDragCommit } from './beam-end-drag-commit'

const SENSOR = { x: 10, y: 10, x2: 100, y2: 10 }
const IMAGE = { imageWidthPx: 200, imageHeightPx: 150 }

describe('resolveBeamEndDragCommit', () => {
  it('commits the dragged point unchanged when inside the image and long enough', () => {
    const result = resolveBeamEndDragCommit({ end: 'rx', draggedPos: { x: 120, y: 20 }, sensor: SENSOR, ...IMAGE })
    expect(result).toEqual({ nodePos: { x: 120, y: 20 }, commitPatch: { x2: 120, y2: 20 } })
  })

  it('clamps a transmitter drag beyond the image edge (M2)', () => {
    const result = resolveBeamEndDragCommit({ end: 'tx', draggedPos: { x: -50, y: 300 }, sensor: SENSOR, ...IMAGE })
    expect(result).toEqual({ nodePos: { x: 0, y: 150 }, commitPatch: { x: 0, y: 150 } })
  })

  it('clamps a receiver drag beyond the image edge (M2)', () => {
    const result = resolveBeamEndDragCommit({ end: 'rx', draggedPos: { x: 999, y: -40 }, sensor: SENSOR, ...IMAGE })
    expect(result).toEqual({ nodePos: { x: 200, y: 0 }, commitPatch: { x2: 200, y2: 0 } })
  })

  it('refuses a receiver drag that would leave the beam shorter than 1px, snapping back to the pre-drag point', () => {
    const result = resolveBeamEndDragCommit({ end: 'rx', draggedPos: { x: 10.3, y: 10 }, sensor: SENSOR, ...IMAGE })
    expect(result).toEqual({ nodePos: { x: 100, y: 10 }, commitPatch: null })
  })

  it('refuses a transmitter drag onto the receiver, snapping back to the pre-drag point', () => {
    const result = resolveBeamEndDragCommit({ end: 'tx', draggedPos: { x: 100, y: 10 }, sensor: SENSOR, ...IMAGE })
    expect(result).toEqual({ nodePos: { x: 10, y: 10 }, commitPatch: null })
  })

  it('refuses when clamping itself would collapse the dragged end onto the other one', () => {
    // x2 sits 0.5px from the left edge; dragging tx far past the left edge clamps it to
    // (0, 10), which is then under 1px from x2 (0.5, 10) - refused, not just clamped.
    const nearLeftEdge = { x: 50, y: 10, x2: 0.5, y2: 10 }
    const result = resolveBeamEndDragCommit({ end: 'tx', draggedPos: { x: -500, y: 10 }, sensor: nearLeftEdge, ...IMAGE })
    expect(result).toEqual({ nodePos: { x: 50, y: 10 }, commitPatch: null })
  })
})
