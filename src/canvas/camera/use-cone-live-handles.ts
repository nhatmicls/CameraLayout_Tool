import { useCallback, useRef } from 'react'
import type { PlacedSensorPatch } from '../../domain/sensor/sensor-types'
import { cameraLiveHandleKey, sensorLiveHandleKey, type ConeLiveHandle } from '../wall/wall-occlusion-cone-clip'

export interface PositionCallback {
  (id: string, pos: { x: number; y: number }): void
}

export interface RotationCallback {
  (id: string, rotationDeg: number): void
}

/**
 * The single live-handle registry (`coneLiveHandles`) a camera cone
 * (`camera-fov-cone-shape.tsx`) or a sector/circle sensor coverage shape
 * (`sensor-coverage-shape.tsx`) registers itself into, plus the eight
 * drag/rotate wrapper callbacks `plan-scene-layers.tsx` hands to the marker
 * components. Cameras and sensors share one map, keyed through
 * `cameraLiveHandleKey`/`sensorLiveHandleKey` (a raw id is only guaranteed
 * unique within its own kind, not across a camera and a sensor, so the raw
 * id alone would let a hand-edited file's same-id pair collide) - pulled
 * into its own hook purely to keep `plan-scene-layers.tsx` under the
 * project's line-count guideline.
 *
 * Every "live" callback only pokes the registry (imperative Konva call, no
 * React state, no store write). Both "end" callbacks re-poke the registry
 * with the committed position before writing to the store: react-konva only
 * applies CHANGED props, so when the commit is a no-op (dropped back at the
 * start) or clamps to a value the marker's `x`/`y` prop already held before
 * the drag (e.g. a sensor pinned against the image edge), the prop diff is
 * empty and React never touches the underlying Konva node - without the
 * re-poke the cone/coverage shape would stay wherever the mouse was
 * released instead of snapping to the committed position.
 */
export function useConeLiveHandles(
  onCameraDragEnd: (id: string, x: number, y: number) => void,
  onCameraRotateEnd: (id: string, rotationDeg: number) => void,
  onSensorCommit: (id: string, patch: PlacedSensorPatch) => void,
) {
  const coneLiveHandles = useRef(new Map<string, ConeLiveHandle>())

  const moveLive = useCallback((key: string, pos: { x: number; y: number }) => {
    coneLiveHandles.current.get(key)?.moveTo(pos)
  }, [])

  const rotateLive = useCallback((key: string, rotationDeg: number) => {
    coneLiveHandles.current.get(key)?.rotateTo(rotationDeg)
  }, [])

  const handleCameraDragMove: PositionCallback = useCallback(
    (id, pos) => moveLive(cameraLiveHandleKey(id), pos),
    [moveLive],
  )

  const handleCameraDragEnd: PositionCallback = useCallback(
    (id, pos) => {
      moveLive(cameraLiveHandleKey(id), pos)
      onCameraDragEnd(id, pos.x, pos.y)
    },
    [moveLive, onCameraDragEnd],
  )

  const handleCameraRotateLive: RotationCallback = useCallback(
    (id, rotationDeg) => rotateLive(cameraLiveHandleKey(id), rotationDeg),
    [rotateLive],
  )

  const handleCameraRotateEnd: RotationCallback = useCallback(
    (id, rotationDeg) => {
      rotateLive(cameraLiveHandleKey(id), rotationDeg)
      onCameraRotateEnd(id, rotationDeg)
    },
    [rotateLive, onCameraRotateEnd],
  )

  const handleSensorDragMove: PositionCallback = useCallback(
    (id, pos) => moveLive(sensorLiveHandleKey(id), pos),
    [moveLive],
  )

  const handleSensorDragEnd: PositionCallback = useCallback(
    (id, pos) => {
      moveLive(sensorLiveHandleKey(id), pos)
      onSensorCommit(id, { x: pos.x, y: pos.y })
    },
    [moveLive, onSensorCommit],
  )

  const handleSensorRotateLive: RotationCallback = useCallback(
    (id, rotationDeg) => rotateLive(sensorLiveHandleKey(id), rotationDeg),
    [rotateLive],
  )

  const handleSensorRotateEnd: RotationCallback = useCallback(
    (id, rotationDeg) => {
      rotateLive(sensorLiveHandleKey(id), rotationDeg)
      onSensorCommit(id, { rotationDeg })
    },
    [rotateLive, onSensorCommit],
  )

  return {
    coneLiveHandles,
    handleCameraDragMove,
    handleCameraDragEnd,
    handleCameraRotateLive,
    handleCameraRotateEnd,
    handleSensorDragMove,
    handleSensorDragEnd,
    handleSensorRotateLive,
    handleSensorRotateEnd,
  }
}
