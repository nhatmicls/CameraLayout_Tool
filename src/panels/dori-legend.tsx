import { useProjectStore } from '../state/project-store'
import { cameraModelById } from '../catalog/camera-catalog-loader'
import { resolveEffectiveHfovDeg } from '../domain/camera-coverage-resolver'
import { isApproximateDoriModel } from '../domain/dori-zone-distance-calculator'
import { WALL_MOUNT_CLEARANCE_M } from '../domain/wall-segment-geometry'
import { DORI_BAND_COLORS, WALL_GLASS_COLOR, WALL_OPAQUE_COLOR } from '../canvas/brand-and-dori-color-palette'

const LEGEND_ZONES: Array<{ zone: keyof typeof DORI_BAND_COLORS; label: string }> = [
  { zone: 'identify', label: 'Identify' },
  { zone: 'recognize', label: 'Recognize' },
  { zone: 'observe', label: 'Observe' },
  { zone: 'detect', label: 'Detect' },
  { zone: 'beyond-detect', label: 'Beyond detect' },
]

const WALL_LEGEND_ENTRIES = [
  { label: 'Wall (blocks view)', color: WALL_OPAQUE_COLOR, borderStyle: 'solid' },
  { label: 'Glass (see-through)', color: WALL_GLASS_COLOR, borderStyle: 'dashed' },
] as const

/**
 * Sidebar footer: DORI colour key + current scale + a note when any placed
 * camera uses a >=180deg lens (the arc-length DORI approximation - see
 * `dori-zone-distance-calculator.ts`'s `isApproximateDoriModel`). Once a
 * wall exists it also shows the wall key and states what the 2D wall model
 * does not do, right where the user reads the colours.
 */
export function DoriLegend() {
  const scale = useProjectStore((s) => s.scale)
  const cameras = useProjectStore((s) => s.cameras)
  const hasWalls = useProjectStore((s) => s.walls.length > 0)

  const hasApproximateModel = cameras.some((camera) => {
    const model = cameraModelById(camera.modelId)
    if (!model) return false
    return isApproximateDoriModel(resolveEffectiveHfovDeg(model.lens, camera.hfovDeg))
  })

  return (
    <div data-testid="dori-legend" className="border-t border-neutral-200 p-3 text-xs text-neutral-600">
      <h3 className="font-semibold text-neutral-700">DORI legend</h3>
      <ul className="mt-1.5 flex flex-col gap-1">
        {LEGEND_ZONES.map(({ zone, label }) => (
          <li key={zone} className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 flex-shrink-0 rounded-sm" style={{ backgroundColor: DORI_BAND_COLORS[zone] }} />
            {label}
          </li>
        ))}
      </ul>
      <p className="mt-1.5 text-neutral-400">{scale ? `1 m = ${scale.planPxPerMeter.toFixed(1)} px` : 'Scale not set'}</p>
      {hasApproximateModel && (
        <p data-testid="dori-approximate-note" className="mt-1.5 text-amber-600">
          Approximate: a placed camera uses a &ge;180&deg; lens (arc-length DORI model, not the rectilinear one).
        </p>
      )}
      {hasWalls && (
        <>
          <ul data-testid="wall-legend" className="mt-2 flex flex-col gap-1">
            {WALL_LEGEND_ENTRIES.map(({ label, color, borderStyle }) => (
              <li key={label} className="flex items-center gap-2">
                <span className="w-4 flex-shrink-0 border-t-2" style={{ borderColor: color, borderStyle }} />
                {label}
              </li>
            ))}
          </ul>
          <p data-testid="wall-model-note" className="mt-1.5 text-neutral-500">
            Walls are 2D: an opaque wall blocks everything behind it at any height. Mounting height does not let a
            camera see over a wall. A wall within {WALL_MOUNT_CLEARANCE_M} m of a camera does not block that camera (it
            is treated as the wall the camera is mounted on), even if the camera is aimed through it.
          </p>
        </>
      )}
    </div>
  )
}
