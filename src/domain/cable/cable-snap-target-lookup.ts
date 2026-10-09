import type { CableEndpointIndex } from './cable-endpoint-index'
import type { CableEndRef } from './cable-layout-types'

/** Something a cable can start or end on: a device end (camera, sensor, beam tx / rx, fire-alarm device) or a hub. */
export type CableSnapTarget =
  | { kind: 'device'; ref: CableEndRef; x: number; y: number; label: string }
  | { kind: 'hub'; hubId: string; x: number; y: number; label: string }

/**
 * Nearest device end and / or hub within `tolerancePx` of (x, y), or null.
 * Equal distances resolve to the first in `devices` order, then `hubs`
 * (strict `<` after the first hit, as in `wall-endpoint-snap-lookup.ts`).
 *
 * Tolerance is IMAGE px. Callers convert from screen px; this module never
 * sees the viewport.
 */
export function findNearestCableSnapTarget(
  x: number,
  y: number,
  index: CableEndpointIndex,
  tolerancePx: number,
  accept: 'any' | 'device' | 'hub',
): CableSnapTarget | null {
  if (!Number.isFinite(tolerancePx) || tolerancePx <= 0) return null

  let bestDistanceSq = tolerancePx * tolerancePx
  let best: CableSnapTarget | null = null
  const consider = (target: CableSnapTarget) => {
    const distanceSq = (target.x - x) * (target.x - x) + (target.y - y) * (target.y - y)
    if (best ? distanceSq < bestDistanceSq : distanceSq <= bestDistanceSq) {
      bestDistanceSq = distanceSq
      best = target
    }
  }

  if (accept !== 'hub') {
    for (const device of index.devices) consider({ kind: 'device', ref: device.ref, x: device.x, y: device.y, label: device.label })
  }
  if (accept !== 'device') {
    for (const hub of index.hubs) consider({ kind: 'hub', hubId: hub.hubId, x: hub.x, y: hub.y, label: hub.label })
  }
  return best
}
