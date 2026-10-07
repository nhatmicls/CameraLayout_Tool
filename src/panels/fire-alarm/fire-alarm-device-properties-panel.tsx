import { fireAlarmModelById, type FireAlarmModel } from '../../catalog/fire-alarm/fire-alarm-catalog-loader'
import type { Floor } from '../../domain/floor/floor-types'
import { checkFireAlarmCompatibility, type CompatibilityWarning } from '../../domain/fire-alarm/fire-alarm-compatibility-checker'
import { FIRE_ALARM_KIND_LABELS, isFireAlarmControllerKind, isFireDetectorKind } from '../../domain/fire-alarm/fire-alarm-device-types'
import type { PlacedFireAlarmDevice } from '../../domain/fire-alarm/fire-alarm-device-types'
import { useEditorUiStore } from '../../state/editor-ui-store'
import { useProjectStore } from '../../state/project-store'
import { selectFireAlarmDevices, selectScale } from '../../state/project-store-floor-selectors'
import { CameraUnknownModelNotice } from '../camera/camera-unknown-model-notice'
import { capitalizeFirstLetter } from '../shared/capitalize-first-letter'
import { fireAlarmCompatibilityIndex, fireAlarmModelSpecById } from '../../export/shared/fire-alarm-compatibility-index-singleton'
import { FireAlarmCompatibilityList } from './fire-alarm-compatibility-list'
import { FireDetectorCoverageReadout } from './fire-detector-coverage-readout'
import {
  FIRE_ALARM_PRODUCT_LINE_NOTES,
  FIRE_COMPATIBILITY_NO_CONTROLLER_PLACED,
  FIRE_COMPATIBILITY_NOT_LISTED,
  FIRE_COMPATIBILITY_WORKS_STANDALONE,
  FIRE_DETECTOR_PROTECTION_NOT_PRINTED,
} from './fire-alarm-ui-wording'

interface CompatibilityStatus {
  text: string
  isWarning: boolean
}

/**
 * First placed controller this device is listed as compatible with, as
 * "F{n} {model}" - null when none is placed or listed for. One panel/hub
 * can serve the whole building, so every floor's controllers count (drift
 * addendum); `n` is still that controller's own position among its OWN
 * floor's fire-alarm devices (marker numbering stays per floor).
 */
function findCompatiblePlacedControllerLabel(device: PlacedFireAlarmDevice, floors: readonly Floor[]): string | null {
  const links = fireAlarmCompatibilityIndex.controllersByDeviceModelId.get(device.modelId) ?? []
  if (links.length === 0) return null
  for (const floor of floors) {
    for (let i = 0; i < floor.fireAlarmDevices.length; i++) {
      const candidateSpec = fireAlarmModelSpecById[floor.fireAlarmDevices[i].modelId]
      if (!candidateSpec || !isFireAlarmControllerKind(candidateSpec.kind)) continue
      if (links.some((link) => link.controllerModelId === candidateSpec.id)) return `F${i + 1} ${candidateSpec.model}`
    }
  }
  return null
}

/**
 * Compatibility status line for the selected device: controllers get none
 * (never warned); a `worksStandalone` device never needs a controller;
 * otherwise the matching warning from `checkFireAlarmCompatibility` (run
 * over every placed device, then filtered to this one - the checker's
 * "no controller placed" case is a plan-wide fact, not a per-device one),
 * else the first placed controller it is listed as compatible with.
 */
function resolveCompatibilityStatus(
  device: PlacedFireAlarmDevice,
  model: FireAlarmModel,
  floors: readonly Floor[],
  warnings: readonly CompatibilityWarning[],
): CompatibilityStatus | null {
  if (isFireAlarmControllerKind(model.kind)) return null
  if (model.worksStandalone) return { text: FIRE_COMPATIBILITY_WORKS_STANDALONE, isWarning: false }

  const warning = warnings.find(
    (w) =>
      (w.code === 'not-listed-for-placed-controllers' && w.deviceId === device.id) ||
      (w.code === 'no-controller-placed' && w.deviceIds.includes(device.id)),
  )
  if (warning?.code === 'no-controller-placed') return { text: FIRE_COMPATIBILITY_NO_CONTROLLER_PLACED, isWarning: true }
  if (warning?.code === 'not-listed-for-placed-controllers') return { text: FIRE_COMPATIBILITY_NOT_LISTED, isWarning: true }

  const controllerLabel = findCompatiblePlacedControllerLabel(device, floors)
  return controllerLabel ? { text: `Compatible with placed ${controllerLabel}.`, isWarning: false } : null
}

/**
 * Right-panel editor for the currently-selected fire-alarm device:
 * read-only catalog facts, the product-line honesty note, the catalog
 * compatibility list, this device's own compatibility status (checked
 * against every placed device), the TCVN 5738 coverage readout and
 * position - the fire-alarm twin of `sensor-properties-panel.tsx`. No
 * editable fields: a placed device has nothing but position (dragged on
 * the canvas, phase 6) and no per-device coverage override exists
 * (`fire-alarm-device-types.ts`).
 */
export function FireAlarmDevicePropertiesPanel() {
  const fireAlarmDevices = useProjectStore(selectFireAlarmDevices)
  const floors = useProjectStore((s) => s.floors)
  const fireAlarmSettings = useProjectStore((s) => s.fireAlarmSettings)
  const scale = useProjectStore(selectScale)
  const deleteFireAlarmDevice = useProjectStore((s) => s.deleteFireAlarmDevice)
  const selectedFireAlarmDeviceId = useEditorUiStore((s) => s.selectedFireAlarmDeviceId)
  const setSelectedFireAlarmDeviceId = useEditorUiStore((s) => s.setSelectedFireAlarmDeviceId)

  const index = fireAlarmDevices.findIndex((d) => d.id === selectedFireAlarmDeviceId)
  const device = index >= 0 ? fireAlarmDevices[index] : null

  // Mirrors CameraPropertiesPanel/SensorPropertiesPanel's own guard; selection-properties-panel.tsx
  // only mounts this component when selectedFireAlarmDeviceId is set, so this is defensive only.
  if (!device) return null

  const model = fireAlarmModelById(device.modelId)
  const label = `F${index + 1}`

  const handleDelete = () => {
    deleteFireAlarmDevice(device.id)
    setSelectedFireAlarmDeviceId(null)
  }

  if (!model) {
    return <CameraUnknownModelNotice label={label} modelId={device.modelId} onDelete={handleDelete} itemNoun="fire-alarm device" />
  }

  // "Not listed" / "no controller placed" considers a controller on ANY floor (one panel/hub
  // serves the whole building - drift addendum), not just the active floor's own devices.
  const allFireAlarmDevices = floors.flatMap((floor) => floor.fireAlarmDevices)
  const warnings = checkFireAlarmCompatibility(allFireAlarmDevices, fireAlarmModelSpecById, fireAlarmCompatibilityIndex)
  const status = resolveCompatibilityStatus(device, model, floors, warnings)
  const positionLabel = scale
    ? `${(device.x / scale.planPxPerMeter).toFixed(2)} m, ${(device.y / scale.planPxPerMeter).toFixed(2)} m`
    : `${device.x.toFixed(0)} px, ${device.y.toFixed(0)} px`

  return (
    <div data-testid="properties-panel" className="text-sm">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-neutral-700">
          Properties <span data-testid="properties-fire-alarm-number" className="text-neutral-400">({label})</span>
        </h2>
        <button
          type="button"
          data-testid="properties-delete-button"
          onClick={handleDelete}
          className="rounded px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50 focus:outline focus:outline-2 focus:outline-red-600"
        >
          Delete
        </button>
      </div>

      <dl className="mt-2 grid grid-cols-2 gap-x-2 gap-y-0.5 text-xs text-neutral-600">
        <div>
          <dt className="inline text-neutral-400">Brand </dt>
          <dd data-testid="properties-brand" className="inline font-medium text-neutral-900">
            {capitalizeFirstLetter(model.brand)}
          </dd>
        </div>
        <div>
          <dt className="inline text-neutral-400">Kind </dt>
          <dd data-testid="properties-kind" className="inline font-medium text-neutral-900">
            {FIRE_ALARM_KIND_LABELS[model.kind]}
          </dd>
        </div>
        <div className="col-span-2">
          <dt className="inline text-neutral-400">Model </dt>
          <dd data-testid="properties-model" className="inline font-medium text-neutral-900">
            {model.model}
          </dd>
        </div>
      </dl>

      <p data-testid="properties-fire-alarm-product-line-note" className="mt-1 text-xs text-amber-700">
        {FIRE_ALARM_PRODUCT_LINE_NOTES[model.productLine]}
      </p>

      {isFireDetectorKind(model.kind) && (
        <p data-testid="properties-fire-alarm-protection-note" className="mt-0.5 text-xs text-neutral-400">
          {FIRE_DETECTOR_PROTECTION_NOT_PRINTED}
        </p>
      )}

      <div className="mt-2 text-xs">
        <FireAlarmCompatibilityList model={model} />
      </div>

      {status && (
        <p
          data-testid="properties-fire-alarm-compatibility-status"
          className={`mt-1 text-xs ${status.isWarning ? 'text-amber-700' : 'text-neutral-500'}`}
        >
          {status.text}
        </p>
      )}

      <FireDetectorCoverageReadout model={model} settings={fireAlarmSettings} hasScale={scale !== null} />

      <p data-testid="properties-position" className="mt-3 text-xs text-neutral-500">
        Position: {positionLabel}
      </p>
    </div>
  )
}
