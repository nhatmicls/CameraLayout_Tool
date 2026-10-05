import type { CameraModel } from '../catalog/camera-catalog-loader'
import { cameraFeatureBadgeLabels } from '../catalog/camera-catalog-feature-labels'

interface CameraFeatureBadgesProps {
  model: CameraModel
}

/**
 * One wrapping row of small chips on the catalog card: ingress/IK ratings, built-in
 * mic/speaker, then detection types - positives only, straight from the manufacturer
 * datasheet (never an audio-port chip; that detail lives in the properties panel only).
 * Renders nothing when the model lists none of these fields.
 */
export function CameraFeatureBadges({ model }: CameraFeatureBadgesProps) {
  const labels = cameraFeatureBadgeLabels(model)
  if (labels.length === 0) return null

  return (
    <div
      data-testid={`catalog-badges-${model.id}`}
      className="flex flex-wrap gap-1 mt-1"
      title="From the manufacturer datasheet"
    >
      {labels.map((label) => (
        <span key={label} className="rounded bg-neutral-100 px-1 py-0.5 text-[10px] text-neutral-600">
          {label}
        </span>
      ))}
    </div>
  )
}
