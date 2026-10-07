import { useMemo } from 'react'
import { buildCableEndpointIndex, cableLabel } from '../../domain/cable/cable-endpoint-index'
import { SCALE_NOT_SET_CABLE_MESSAGE } from '../../domain/cable/cable-layout-estimate'
import { formatMeters, formatMetersInterval } from '../../domain/cable/cable-length-format'
import { useEditorUiStore } from '../../state/editor-ui-store'
import { useProjectStore } from '../../state/project-store'
import { selectCables, selectCameras, selectHubs, selectSensors } from '../../state/project-store-floor-selectors'
import { useCableLayoutEstimate } from '../../state/use-cable-layout-estimate'
import { fieldLabelClass, inputClass } from '../camera/camera-properties-form-helpers'
import { cableLimitStatusText } from './cable-limit-status-text'

const LIMIT_STATUS_CLASS = { ok: 'text-neutral-600', 'no-limit': 'text-neutral-400', 'maybe-over': 'text-amber-700', over: 'font-medium text-red-600' }

/**
 * Right-panel editor for the selected cable: its type, the length breakdown
 * (horizontal route, vertical runs, slack, run, waste, purchase) and the
 * length-limit verdict. Pure presentation over `computeCableLayoutEstimate`;
 * without a scale there are no metres, so the breakdown is replaced by a
 * prompt to calibrate.
 */
export function CablePropertiesPanel() {
  const cameras = useProjectStore(selectCameras)
  const sensors = useProjectStore(selectSensors)
  const hubs = useProjectStore(selectHubs)
  const cables = useProjectStore(selectCables)
  const cableTypes = useProjectStore((s) => s.cableTypes)
  const updateCable = useProjectStore((s) => s.updateCable)
  const deleteCable = useProjectStore((s) => s.deleteCable)
  const selectedCableId = useEditorUiStore((s) => s.selectedCableId)
  const setSelectedCableId = useEditorUiStore((s) => s.setSelectedCableId)
  const layoutEstimate = useCableLayoutEstimate()
  const index = useMemo(() => buildCableEndpointIndex(cameras, sensors, hubs), [cameras, sensors, hubs])

  // Looked up rather than trusted: an undo can remove the cable while its id is still selected.
  const cable = cables.find((candidate) => candidate.id === selectedCableId)
  if (!cable) return null

  const type = cableTypes.find((candidate) => candidate.id === cable.typeId)
  const estimate = layoutEstimate.byCableId.get(cable.id)
  const handleDelete = () => {
    deleteCable(cable.id)
    setSelectedCableId(null)
  }
  const rows: Array<[string, string, string]> = estimate
    ? [
        ['horizontal', 'Horizontal route', formatMeters(estimate.horizM)],
        ['device-rise', 'Rise at device', formatMeters(estimate.deviceRiseM)],
        ['hub-drop', 'Vertical at hub', formatMeters(estimate.hubDropM)],
        ...(estimate.hubExtraM > 0 ? [['hub-extra', 'On the other floor', formatMeters(estimate.hubExtraM)] as [string, string, string]] : []),
        ['slack', 'End slack', formatMeters(estimate.slackM)],
        ['run', 'Run', formatMetersInterval(estimate.run)],
        ['waste', 'Waste', formatMeters(estimate.wasteM)],
        ['purchase', 'To buy', formatMetersInterval(estimate.purchase)],
      ]
    : []

  return (
    <div data-testid="properties-panel" className="text-sm">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-neutral-700">
          Properties <span data-testid="properties-cable-label" className="text-neutral-400">({cableLabel(cable, index)})</span>
        </h2>
        <button
          type="button"
          data-testid="properties-delete-button"
          onClick={handleDelete}
          title="Delete cable (Del)"
          className="rounded px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50 focus:outline focus:outline-2 focus:outline-red-600"
        >
          Delete cable
        </button>
      </div>

      <label className={fieldLabelClass} htmlFor="properties-cable-type-select">
        Cable type
      </label>
      <select
        id="properties-cable-type-select"
        data-testid="properties-cable-type-select"
        value={cable.typeId}
        onChange={(e) => updateCable(cable.id, { typeId: e.target.value })}
        className={inputClass}
      >
        {cableTypes.map((candidate) => (
          <option key={candidate.id} value={candidate.id}>
            {candidate.name}
          </option>
        ))}
      </select>

      {estimate && type ? (
        <>
          <dl data-testid="properties-cable-breakdown" className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-xs">
            {rows.map(([key, label, value]) => (
              <div key={key} className="contents">
                <dt className="text-neutral-500">{label}</dt>
                <dd data-testid={`properties-cable-${key}`} className="text-right tabular-nums text-neutral-800">
                  {value}
                </dd>
              </div>
            ))}
          </dl>
          <p data-testid="properties-cable-limit-status" className={`mt-2 text-xs ${LIMIT_STATUS_CLASS[estimate.limitStatus]}`}>
            {cableLimitStatusText(estimate, type.lengthLimitM)}
          </p>
        </>
      ) : (
        <p data-testid="properties-cable-no-estimate" className="mt-3 text-xs font-medium text-amber-600">
          {layoutEstimate.hasScale ? 'This cable has lost one of its ends.' : SCALE_NOT_SET_CABLE_MESSAGE}
        </p>
      )}

      <p className="mt-3 text-[10px] leading-tight text-neutral-400">
        Drag a point to move it. Double-click the line to add a point, double-click a point to remove it.
      </p>
    </div>
  )
}
