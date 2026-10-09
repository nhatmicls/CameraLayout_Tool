import { MIN_VERTEX_SPACING_PX } from './cable-drawing-chain'
import { MAX_CABLE_POINTS, type CableEndRef, type CablePoint } from './cable-layout-types'

/**
 * State machine of the "Draw route to hub" tool (`ToolMode 'trunk'`), free
 * of Konva. Unlike a cable's chain (`cable-drawing-chain.ts`), the start
 * point is fixed and already known - the owner hub, read from
 * `selectedHubId` at mode entry - so a chain always exists while the tool
 * is active; there is no "no chain yet" state to advance out of. A click on
 * ANY other hub of this floor commits; a click on the start hub itself, or
 * on anything that is not a hub (a device marker, empty plan), only adds a
 * vertex (a device is never a valid trunk target).
 *
 * The same tool draws a cable's own route beyond a shaft (start = the shaft
 * opening). That route may also end on a device: the caller then reports
 * the snapped device as `click.device`, which commits as `commit-device`.
 */

export interface HubTrunkDrawingChain {
  startHubId: string
  /** Vertices in click order (start -> cursor). */
  points: CablePoint[]
}

export type HubTrunkDrawingStep =
  | { kind: 'ignored'; chain: HubTrunkDrawingChain; reason: 'start-hub' | 'too-many-points' | 'repeat-point' }
  | { kind: 'continue'; chain: HubTrunkDrawingChain }
  | { kind: 'commit'; hubId: string; points: CablePoint[] }
  | { kind: 'commit-device'; device: CableEndRef; points: CablePoint[] }

/**
 * `click.hubId` is the id of the hub the click snapped to (geometric
 * snapping, done by the caller), or null when the click landed on nothing
 * hub-shaped - including a device marker, which a trunk never targets.
 * `click.device` is only ever set by the shaft-leg caller.
 */
export function advanceHubTrunkDrawingChain(
  chain: HubTrunkDrawingChain,
  click: { x: number; y: number; hubId: string | null; device?: CableEndRef },
): HubTrunkDrawingStep {
  if (click.hubId) {
    if (click.hubId === chain.startHubId) return { kind: 'ignored', chain, reason: 'start-hub' }
    return { kind: 'commit', hubId: click.hubId, points: chain.points }
  }
  if (click.device) return { kind: 'commit-device', device: click.device, points: chain.points }

  if (chain.points.length >= MAX_CABLE_POINTS) return { kind: 'ignored', chain, reason: 'too-many-points' }
  const previous = chain.points[chain.points.length - 1]
  const previousPoint = previous ?? null
  if (previousPoint && Math.hypot(click.x - previousPoint.x, click.y - previousPoint.y) < MIN_VERTEX_SPACING_PX) {
    return { kind: 'ignored', chain, reason: 'repeat-point' }
  }
  return { kind: 'continue', chain: { startHubId: chain.startHubId, points: [...chain.points, { x: click.x, y: click.y }] } }
}

/** Backspace: drops the last vertex. A chain with no vertices is returned as is. */
export function removeLastHubTrunkDrawingPoint(chain: HubTrunkDrawingChain): HubTrunkDrawingChain {
  if (chain.points.length === 0) return chain
  return { startHubId: chain.startHubId, points: chain.points.slice(0, -1) }
}
