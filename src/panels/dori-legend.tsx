import { useProjectStore } from '../state/project-store'
import { cameraModelById } from '../catalog/camera-catalog-loader'
import { resolveEffectiveHfovDeg } from '../domain/camera-coverage-resolver'
import { isApproximateDoriModel } from '../domain/dori-zone-distance-calculator'
import { DORI_BAND_COLORS } from '../canvas/brand-and-dori-color-palette'

const LEGEND_ZONES: Array<{ zone: keyof typeof DORI_BAND_COLORS; label: string }> = [
  { zone: 'identify', label: 'Identify' },
  { zone: 'recognize', label: 'Recognize' },
  { zone: 'observe', label: 'Observe' },
  { zone: 'detect', label: 'Detect' },
  { zone: 'beyond-detect', label: 'Beyond detect' },
]

/**
 * Sidebar footer: DORI colour key + current scale + a note when any placed
 * camera uses a >=180deg lens (the arc-length DORI approximation - see
 * `dori-zone-distance-calculator.ts`'s `isApproximateDoriModel`).
 */
export function DoriLegend() {
  const scale = useProjectStore((s) => s.scale)
  const cameras = useProjectStore((s) => s.cameras)

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
    </div>
  )
}
