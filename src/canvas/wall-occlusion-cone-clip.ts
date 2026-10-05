import { computeWallOcclusionVisibilityPolygon } from '../domain/wall-occlusion-visibility-polygon'
import type { WallSegment } from '../domain/wall-segment-geometry'

/**
 * Glue between the domain's visibility polygon and a Konva `clipFunc`. The
 * polygon is camera-centred in unrotated image axes, so the clip belongs on a
 * Group positioned at the camera with NO rotation (see
 * `camera-fov-cone-shape.tsx`). No React here: the same function serves the
 * memoised static path and the imperative drag path.
 */

/** The three path calls a clip needs; satisfied by both the 2D context and Konva's wrapper around it. */
type ClipPathContext = Pick<CanvasRenderingContext2D, 'moveTo' | 'lineTo' | 'closePath'>
export type ConeClipFunc = (ctx: ClipPathContext) => void

/** Closed path through the flat `[x0, y0, x1, y1, ...]` polygon (Konva has already called `beginPath`); undefined for null = no clip. */
export function buildConeClipFunc(polygon: number[] | null): ConeClipFunc | undefined {
  if (!polygon || polygon.length < 6) return undefined
  return (ctx) => {
    ctx.moveTo(polygon[0], polygon[1])
    for (let i = 2; i < polygon.length; i += 2) ctx.lineTo(polygon[i], polygon[i + 1])
    ctx.closePath()
  }
}

export interface ConeOcclusionInputs {
  /** Outermost band radius plus stroke padding, image px. 0 = nothing drawn, nothing to clip. */
  clipRadiusPx: number
  opaqueWalls: readonly WallSegment[]
  /** `WALL_MOUNT_CLEARANCE_M` in image px. */
  clearancePx: number
}

/** Clip for a cone whose camera is at (x, y) image px; undefined when no opaque wall is in range (the cone then draws exactly as it would with no walls at all). */
export function computeConeClipFunc(x: number, y: number, inputs: ConeOcclusionInputs): ConeClipFunc | undefined {
  if (inputs.clipRadiusPx <= 0 || inputs.opaqueWalls.length === 0) return undefined
  return buildConeClipFunc(
    computeWallOcclusionVisibilityPolygon({
      originX: x,
      originY: y,
      radiusPx: inputs.clipRadiusPx,
      segments: inputs.opaqueWalls,
      originClearancePx: inputs.clearancePx,
    }),
  )
}

/** What a marker's drag / rotate uses to move its cone mid-gesture, with no store write and no React render. */
export interface ConeLiveHandle {
  /** Moves the cone and re-clips it against the walls at the new position. */
  moveTo(pos: { x: number; y: number }): void
  /** Rotation never changes the clip: the polygon covers the full disc. */
  rotateTo(rotationDeg: number): void
}
