import { useMemo } from 'react'
import { formatMeters, formatMetersInterval } from '../../domain/cable/cable-length-format'
import type { Hub, HubRef } from '../../domain/cable/cable-layout-types'
import { listLinkCandidates } from '../../domain/cable/cross-floor-hub-link-integrity'
import { pairedHubRefusalReason } from '../../domain/cable/cross-floor-paired-hub-creator'
import type { HubBeyondLength } from '../../domain/cable/cross-floor-hub-beyond-length-resolver'
import type { Floor } from '../../domain/floor/floor-types'
import { useEditorUiStore } from '../../state/editor-ui-store'
import { useProjectStore } from '../../state/project-store'
import { fieldLabelClass, inputClass, secondaryButtonClass } from '../camera/camera-properties-form-helpers'

interface HubCrossFloorLinkSectionProps {
  floors: Floor[]
  floorIndex: number
  hub: Hub
  /** Already resolved by the caller (`resolveHubBeyondLength`) - null only when this hub cannot be linked (shouldn't happen: the caller only mounts this section for a riser/drop). */
  beyond: HubBeyondLength | null
}

const LINK_KEY_SEPARATOR = '\u0000'

/**
 * Riser/drop link picker + "Create paired point" button + a read-only
 * summary of which mode (typed / computed) is in use and why. Mounted only
 * on a riser/drop properties panel in a project with more than one floor.
 */
export function HubCrossFloorLinkSection({ floors, floorIndex, hub, beyond }: HubCrossFloorLinkSectionProps) {
  const relinkHub = useProjectStore((s) => s.relinkHub)
  const createPairedHub = useProjectStore((s) => s.createPairedHub)
  const pushNotification = useEditorUiStore((s) => s.pushNotification)

  const floor = floors[floorIndex]
  const ref: HubRef = { floorId: floor.id, hubId: hub.id }
  const candidates = useMemo(() => listLinkCandidates(floors, floorIndex, hub), [floors, floorIndex, hub])
  const refusal = hub.link ? null : pairedHubRefusalReason(floors, ref)
  const partnerFloorName = (hub.kind === 'riser' ? floors[floorIndex + 1] : floors[floorIndex - 1])?.name
  const linkedCandidateLabel = candidates.find((c) => c.floorId === hub.link?.floorId && c.hubId === hub.link?.hubId)?.label
  // The crossing's vertical metres always come from the RISER side of the pair - this hub's own
  // floor when it IS the riser, otherwise its partner's floor (the riser is always below a drop).
  const crossingFloorName = hub.kind === 'riser' ? floor.name : floors.find((f) => f.id === hub.link?.floorId)?.name ?? 'the floor below'

  const currentValue = hub.link ? `${hub.link.floorId}${LINK_KEY_SEPARATOR}${hub.link.hubId}` : ''

  const handleSelectChange = (value: string) => {
    // `relinkHub` (not `linkHubs` directly): switching to a DIFFERENT partner must clear the old
    // one first - old partner's link + trunk, and this hub's own trunk - all in ONE undo step.
    if (value === '') {
      relinkHub(ref, null)
      return
    }
    const [targetFloorId, targetHubId] = value.split(LINK_KEY_SEPARATOR)
    relinkHub(ref, { floorId: targetFloorId, hubId: targetHubId })
  }

  const handleCreatePaired = () => {
    const result = createPairedHub(ref, crypto.randomUUID())
    if (!result.ok) pushNotification('error', result.problem)
  }

  return (
    <div className="mt-3 border-t border-neutral-200 pt-3">
      <label className={fieldLabelClass} htmlFor="properties-hub-link-select">
        Linked to
      </label>
      <select
        id="properties-hub-link-select"
        data-testid="properties-hub-link-select"
        value={currentValue}
        onChange={(e) => handleSelectChange(e.target.value)}
        className={inputClass}
      >
        <option value="">Not linked</option>
        {candidates.map((candidate) => (
          <option key={`${candidate.floorId}${LINK_KEY_SEPARATOR}${candidate.hubId}`} value={`${candidate.floorId}${LINK_KEY_SEPARATOR}${candidate.hubId}`}>
            {candidate.label}
          </option>
        ))}
      </select>

      {!hub.link && (
        <>
          <button
            type="button"
            data-testid="properties-hub-create-paired-point"
            onClick={handleCreatePaired}
            disabled={refusal !== null}
            title={refusal ?? undefined}
            className={`mt-2 w-full ${secondaryButtonClass} disabled:cursor-not-allowed disabled:opacity-50`}
          >
            {partnerFloorName ? `Create paired point on ${partnerFloorName}` : 'Create paired point'}
          </button>
          {refusal && (
            <p data-testid="properties-hub-create-paired-point-refusal" className="mt-1 text-[10px] leading-tight text-amber-600">
              {refusal}
            </p>
          )}
        </>
      )}

      {hub.link && beyond && (
        <p data-testid="properties-hub-cross-floor-mode" className="mt-2 text-xs text-neutral-600">
          {beyond.source === 'route' &&
            `Computed: ${formatMetersInterval(beyond.run)} beyond this point via ${beyond.viaLabel} ` +
              `(includes ${formatMeters(beyond.crossingVerticalM)} crossing ${crossingFloorName}'s height).`}
          {beyond.source === 'typed' &&
            `No route drawn from ${linkedCandidateLabel ?? 'the partner'} yet - typed values in use above.`}
          {beyond.source === 'unavailable' &&
            (beyond.reason === 'linked-floor-scale-not-set'
              ? `${beyond.floorName} has no scale - no cable metres via this point.`
              : 'This crossing forms a cycle - no cable metres via this point.')}
        </p>
      )}
    </div>
  )
}
