import type { PlacedCamera } from '../../domain/project-file/project-types'

interface CameraDebugListProps {
  cameras: PlacedCamera[]
}

/** Visually-hidden camera state, read by e2e tests (phase 8) without needing to decode canvas pixels. */
export function CameraDebugList({ cameras }: CameraDebugListProps) {
  return (
    <ul data-testid="camera-debug-list" className="sr-only">
      {cameras.map((camera) => (
        <li
          key={camera.id}
          data-testid={`camera-row-${camera.id}`}
          data-x={camera.x}
          data-y={camera.y}
          data-rotation-deg={camera.rotationDeg}
          data-range-m={camera.rangeM}
          data-model-id={camera.modelId}
          data-hfov-deg={camera.hfovDeg ?? ''}
        >
          {camera.id}
        </li>
      ))}
    </ul>
  )
}
