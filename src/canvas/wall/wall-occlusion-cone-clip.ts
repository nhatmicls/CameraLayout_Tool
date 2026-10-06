import { computeWallOcclusionVisibilityPolygon } from '../../domain/wall/wall-occlusion-visibility-polygon'
import type { WallSegment } from '../../domain/wall/wall-segment-geometry'

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

/** The clip reaches this far past the outermost band so the band's own outline is never shaved - shared by camera cones and sensor coverage shapes (both pass it into `ConeOcclusionInputs.clipRadiusPx`). */
export const CONE_CLIP_STROKE_PAD_PX = 2

export interface ConeOcclusionInputs {
  /** Outermost band radius plus stroke padding, image px. 0 = nothing drawn, nothing to clip. */
  clipRadiusPx: number
  /** Segments that block: kind-agnostic despite the name - a camera cone passes opaque walls only, a PIR/thermal sensor passes opaque+glass, a vibration sensor passes opaque only (`SENSOR_BLOCKING_WALL_KINDS`). */
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

/**
 * Namespaces a raw camera/sensor id before it is used as a key in the
 * shared live-handle registry (`use-cone-live-handles.ts`). Camera and
 * sensor ids are each only unique WITHIN their own kind (a hand-edited
 * project file can give a camera and a sensor the same raw id string - the
 * loader only checks for repeats within each array separately), so the raw
 * id alone is not a safe map key.
 */
export function cameraLiveHandleKey(id: string): string {
  return `camera:${id}`
}

/** Sensor twin of `cameraLiveHandleKey` - see its docstring. */
export function sensorLiveHandleKey(id: string): string {
  return `sensor:${id}`
}

/** What a marker's drag / rotate uses to move its cone mid-gesture, with no store write and no React render. */
export interface ConeLiveHandle {
  /** Moves the cone and re-clips it against the walls at the new position. */
  moveTo(pos: { x: number; y: number }): void
  /** Rotation never changes the clip: the polygon covers the full disc. */
  rotateTo(rotationDeg: number): void
}
