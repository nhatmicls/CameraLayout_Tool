import { cableEndRefKey } from './cable-endpoint-index'
import { MAX_CABLE_POINTS, type CableEndRef, type CablePoint } from './cable-layout-types'
import type { CableSnapTarget } from './cable-snap-target-lookup'

/**
 * State machine of the "Draw cable" tool, free of Konva: a chain starts on a
 * device or a hub, collects free vertices, and commits on its other end.
 * Started on a device, it may end on a hub or on any OTHER device; started
 * on a hub, it ends on a device (a cable always has a device start, and
 * there are no hub-to-hub cables). A click near a target the chain cannot
 * end on is just a vertex - the caller only looks for
 * `acceptedSnapKind(chain)` targets and never offers the start itself.
 */

export interface CableDrawingChain {
  start: CableSnapTarget
  /** Vertices in click order (start -> cursor). */
  points: CablePoint[]
}

export type CableDrawingStep =
  | { kind: 'ignored'; chain: CableDrawingChain | null; reason: 'start-needs-target' | 'too-many-points' | 'repeat-point' }
  | { kind: 'continue'; chain: CableDrawingChain }
  | { kind: 'commit'; cable: { device: CableEndRef; hubId?: string; endDevice?: CableEndRef; points: CablePoint[] } }

/** A click closer than this to the previous point adds nothing (a double-click's second click). Exported for `hub-trunk-drawing-chain.ts` (same rule, same value - DRY). */
export const MIN_VERTEX_SPACING_PX = 1

/** Which snap targets the next click may land on: anything to start; after a device start, any hub or other device; after a hub start, a device. */
export function acceptedSnapKind(chain: CableDrawingChain | null): 'any' | 'device' {
  return chain?.start.kind === 'hub' ? 'device' : 'any'
}

/** The start device of an open chain - the one target it may never end on. */
export function excludedSnapDevice(chain: CableDrawingChain | null): CableEndRef | undefined {
  return chain?.start.kind === 'device' ? chain.start.ref : undefined
}

export function advanceCableDrawingChain(
  chain: CableDrawingChain | null,
  click: { x: number; y: number; snapTarget: CableSnapTarget | null },
): CableDrawingStep {
  const { snapTarget } = click
  if (!chain) {
    if (!snapTarget) return { kind: 'ignored', chain: null, reason: 'start-needs-target' }
    return { kind: 'continue', chain: { start: snapTarget, points: [] } }
  }

  if (snapTarget) {
    // Stored order is always start device -> end, whichever end the user started on.
    if (chain.start.kind === 'device' && snapTarget.kind === 'hub') {
      return { kind: 'commit', cable: { device: chain.start.ref, hubId: snapTarget.hubId, points: chain.points } }
    }
    if (chain.start.kind === 'hub' && snapTarget.kind === 'device') {
      return { kind: 'commit', cable: { device: snapTarget.ref, hubId: chain.start.hubId, points: [...chain.points].reverse() } }
    }
    if (chain.start.kind === 'device' && snapTarget.kind === 'device' && cableEndRefKey(snapTarget.ref) !== cableEndRefKey(chain.start.ref)) {
      return { kind: 'commit', cable: { device: chain.start.ref, endDevice: snapTarget.ref, points: chain.points } }
    }
  }

  if (chain.points.length >= MAX_CABLE_POINTS) return { kind: 'ignored', chain, reason: 'too-many-points' }
  const previous = chain.points[chain.points.length - 1] ?? chain.start
  if (Math.hypot(click.x - previous.x, click.y - previous.y) < MIN_VERTEX_SPACING_PX) {
    return { kind: 'ignored', chain, reason: 'repeat-point' }
  }
  return { kind: 'continue', chain: { start: chain.start, points: [...chain.points, { x: click.x, y: click.y }] } }
}

/** Backspace: drops the last vertex. A chain with no vertices is returned as is. */
export function removeLastCableDrawingPoint(chain: CableDrawingChain): CableDrawingChain {
  if (chain.points.length === 0) return chain
  return { start: chain.start, points: chain.points.slice(0, -1) }
}
