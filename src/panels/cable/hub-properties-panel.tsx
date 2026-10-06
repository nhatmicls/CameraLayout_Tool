import { hubLabels } from '../../domain/cable/cable-endpoint-index'
import { HUB_EXTRA_LENGTH_BOUNDS, HUB_MOUNT_HEIGHT_BOUNDS } from '../../domain/cable/cable-layout-types'
import { useEditorUiStore } from '../../state/editor-ui-store'
import { useProjectStore } from '../../state/project-store'
import { fieldLabelClass, inputClass } from '../camera/camera-properties-form-helpers'
import { NullableNumberInput } from '../shared/nullable-number-input'

/**
 * Right-panel editor for the selected hub: its mount height (the height the
 * cables drop to), how many cables end on it, and Delete - which removes
 * those cables too, as one undo step. A hub is a plan anchor only: it has
 * no model and is not a BOM line. A riser / drop is the same thing with
 * other wording (how far up / down the cable goes) plus the cable length on
 * the other floor.
 */
const WORDING = {
  hub: { noun: 'hub', heightLabel: 'Mount height (m)', help: 'Hub: where cables end (switch, recorder, alarm panel). Drag it on the plan to move it.' },
  riser: { noun: 'riser', heightLabel: 'Rises to (m above this floor)', help: 'Riser: where cables go up to the floor above. Drag it on the plan to move it.' },
  drop: { noun: 'drop', heightLabel: 'Goes down to (m below this floor)', help: 'Drop: where cables go down to the floor below. Drag it on the plan to move it.' },
}

export function HubPropertiesPanel() {
  const hubs = useProjectStore((s) => s.hubs)
  const cables = useProjectStore((s) => s.cables)
  const updateHub = useProjectStore((s) => s.updateHub)
  const deleteHub = useProjectStore((s) => s.deleteHub)
  const selectedHubId = useEditorUiStore((s) => s.selectedHubId)
  const setSelectedHubId = useEditorUiStore((s) => s.setSelectedHubId)

  // Looked up rather than trusted: an undo can remove the hub while its id is still selected.
  const index = hubs.findIndex((hub) => hub.id === selectedHubId)
  const hub = index >= 0 ? hubs[index] : null
  if (!hub) return null

  const cableCount = cables.filter((cable) => cable.hubId === hub.id).length
  const { noun, heightLabel, help } = WORDING[hub.kind ?? 'hub']
  const handleDelete = () => {
    deleteHub(hub.id)
    setSelectedHubId(null)
  }

  return (
    <div data-testid="properties-panel" className="text-sm">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-neutral-700">
          Properties <span data-testid="properties-hub-number" className="text-neutral-400">({hubLabels(hubs)[index]})</span>
        </h2>
        <button
          type="button"
          data-testid="properties-delete-button"
          onClick={handleDelete}
          title={cableCount > 0 ? `Also removes its ${cableCount} cable${cableCount === 1 ? '' : 's'}` : `Delete ${noun} (Del)`}
          className="rounded px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50 focus:outline focus:outline-2 focus:outline-red-600"
        >
          Delete {noun}{cableCount > 0 ? ` + ${cableCount} cable${cableCount === 1 ? '' : 's'}` : ''}
        </button>
      </div>

      <p className="mt-2 text-xs text-neutral-500">{help}</p>

      <label className={fieldLabelClass} htmlFor="properties-hub-height-input">
        {heightLabel}
      </label>
      <NullableNumberInput
        id="properties-hub-height-input"
        testId="properties-hub-height-input"
        value={hub.mountHeightM}
        min={HUB_MOUNT_HEIGHT_BOUNDS.min}
        max={HUB_MOUNT_HEIGHT_BOUNDS.max}
        step={0.1}
        allowEmpty={false}
        onCommit={(mountHeightM) => {
          if (mountHeightM !== null) updateHub(hub.id, { mountHeightM })
        }}
        className={inputClass}
      />

      {hub.kind && (
        <>
          <label className={fieldLabelClass} htmlFor="properties-hub-extra-length-input">
            Length on the other floor (m)
          </label>
          <NullableNumberInput
            id="properties-hub-extra-length-input"
            testId="properties-hub-extra-length-input"
            value={hub.extraLengthM ?? 0}
            min={HUB_EXTRA_LENGTH_BOUNDS.min}
            max={HUB_EXTRA_LENGTH_BOUNDS.max}
            step={0.5}
            allowEmpty={false}
            onCommit={(extraLengthM) => {
              if (extraLengthM !== null) updateHub(hub.id, { extraLengthM })
            }}
            className={inputClass}
          />
          <p className="mt-1 text-[10px] leading-tight text-neutral-400">Added to every cable ending here: the run from this point to its hub on the other floor.</p>
        </>
      )}

      <p data-testid="properties-hub-cable-count" className="mt-3 text-xs text-neutral-600">
        {cableCount} cable{cableCount === 1 ? '' : 's'} connected
      </p>
    </div>
  )
}
