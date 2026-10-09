import { useMemo, useState } from 'react'
import { HUB_EXTRA_LENGTH_BOUNDS, type Hub } from '../../domain/cable/cable-layout-types'
import { findShaftMarkers } from '../../domain/cable/shaft-integrity'
import type { Floor } from '../../domain/floor/floor-types'
import { useEditorUiStore } from '../../state/editor-ui-store'
import { useProjectStore } from '../../state/project-store'
import { fieldLabelClass, inputClass, secondaryButtonClass } from '../camera/camera-properties-form-helpers'
import { NullableNumberInput } from '../shared/nullable-number-input'
import { ShaftCableRouteList } from './shaft-cable-route-list'

interface ShaftPropertiesSectionProps {
  floors: Floor[]
  floorIndex: number
  hub: Hub
}

/** The whole properties-panel body for a selected SHAFT marker - name, openings, the typed length for cables not routed yet, the list of cables through the shaft (each routed on its own from here), and the remove-opening/delete-shaft actions. Mounted by `HubPropertiesPanel` instead of the plain riser/drop body. */
export function ShaftPropertiesSection({ floors, floorIndex, hub }: ShaftPropertiesSectionProps) {
  const shafts = useProjectStore((s) => s.shafts)
  const renameShaft = useProjectStore((s) => s.renameShaft)
  const addShaftOpening = useProjectStore((s) => s.addShaftOpening)
  const deleteShaft = useProjectStore((s) => s.deleteShaft)
  const deleteHub = useProjectStore((s) => s.deleteHub)
  const updateHub = useProjectStore((s) => s.updateHub)
  const setSelectedHubId = useEditorUiStore((s) => s.setSelectedHubId)
  const pushNotification = useEditorUiStore((s) => s.pushNotification)
  const [nameDraft, setNameDraft] = useState<string | null>(null)
  // Computed unconditionally (hooks rule, same convention as `hub-properties-panel.tsx`) - cheap,
  // and stable identity (LOW fix, phase 6 review): passed down as a prop to several children, a
  // fresh array every render would defeat any `useMemo` keyed on it there too.
  const shaftIds = useMemo(() => shafts.map((candidate) => candidate.id), [shafts])

  const shaft = shafts.find((candidate) => candidate.id === hub.shaftId)
  if (!shaft || !hub.shaftId) return null
  const shaftId = hub.shaftId
  const markers = findShaftMarkers(floors, shaftId)
  const floorsWithoutOpening = floors.filter((candidate, i) => candidate.image && !markers.some((marker) => marker.floorId === candidate.id) && i !== floorIndex)

  const commitRename = (value: string) => {
    renameShaft(shaftId, value)
    setNameDraft(null)
  }

  const handleAddOpening = (targetFloorIndex: number) => {
    const result = addShaftOpening(shaftId, targetFloorIndex, { x: hub.x, y: hub.y })
    if (!result.ok) pushNotification('error', result.reason)
  }

  const handleRemoveOpening = () => {
    deleteHub(hub.id)
    setSelectedHubId(null)
  }

  const handleDeleteShaft = () => {
    const cableCount = markers.reduce((sum, marker) => sum + floors[marker.floorIndex].cables.filter((cable) => cable.hubId === marker.hub.id).length, 0)
    const message = `Delete ${shaft.name}? This removes ${markers.length} opening${markers.length === 1 ? '' : 's'} and ${cableCount} cable${cableCount === 1 ? '' : 's'}. Can be undone.`
    if (!window.confirm(message)) return
    deleteShaft(shaftId)
    setSelectedHubId(null)
  }

  return (
    <div data-testid="shaft-properties-section" className="text-sm">
      <label className={fieldLabelClass} htmlFor="shaft-panel-name-input">
        Shaft name
      </label>
      <input
        id="shaft-panel-name-input"
        data-testid="shaft-name-input"
        value={nameDraft ?? shaft.name}
        onChange={(e) => setNameDraft(e.target.value)}
        onBlur={(e) => commitRename(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commitRename(e.currentTarget.value)
        }}
        className={inputClass}
      />

      <p className="mt-3 text-xs text-neutral-600" data-testid="shaft-openings">
        {`Openings: ${markers.map((marker) => floors[marker.floorIndex].name).join(', ')}`}
      </p>
      {floorsWithoutOpening.map((candidate) => (
        <button
          key={candidate.id}
          type="button"
          data-testid={`shaft-add-opening-${candidate.id}`}
          onClick={() => handleAddOpening(floors.findIndex((f) => f.id === candidate.id))}
          className={`mt-1 w-full ${secondaryButtonClass}`}
        >
          {`Add opening on ${candidate.name}`}
        </button>
      ))}

      <label className={fieldLabelClass} htmlFor="shaft-extra-length-input">
        Length beyond this opening, for cables not routed yet (m)
      </label>
      <NullableNumberInput
        id="shaft-extra-length-input"
        testId="shaft-extra-length-input"
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

      <ShaftCableRouteList floors={floors} shaftIds={shaftIds} shaftId={shaftId} floorIndex={floorIndex} />

      <button type="button" data-testid="shaft-remove-opening-button" onClick={handleRemoveOpening} className={`mt-3 w-full ${secondaryButtonClass} text-red-600`}>
        Remove this opening
      </button>
      <button type="button" data-testid="shaft-delete-button" onClick={handleDeleteShaft} className={`mt-1 w-full ${secondaryButtonClass} text-red-600`}>
        Delete shaft
      </button>
    </div>
  )
}
