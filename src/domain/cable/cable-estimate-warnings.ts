import type { CableLengthEstimate } from './cable-length-estimate-calculator'
import type { ScaleUncertainty } from './cable-scale-uncertainty'
import type { CableType } from './cable-layout-types'
import type { HubBeyondLength } from './cross-floor-hub-beyond-length-resolver'
import { formatMeters } from './cable-length-format'

/**
 * Warning builders for `computeCableLayoutEstimate` - split out to keep that
 * file under 200 lines. Pure string formatting over already-computed values;
 * no new logic lives here.
 */

export interface CableEstimateWarning {
  code:
    | 'scale-not-set'
    | 'ref-line-too-short'
    | 'scale-uncertain'
    | 'cable-over-limit'
    | 'cable-maybe-over-limit'
    | 'linked-floor-scale-not-set'
    | 'link-cycle'
    | 'shaft-cable-not-routed'
  message: string
  cableId?: string
}

export function scaleWarnings(uncertainty: ScaleUncertainty): CableEstimateWarning[] {
  if (uncertainty.minFactor === null) {
    return [{ code: 'ref-line-too-short', message: 'Reference line is shorter than the click error - no min-max range.' }]
  }
  if (!uncertainty.isUnreliable) return []
  const percent = (uncertainty.relativeError * 100).toFixed(1)
  return [{ code: 'scale-uncertain', message: `Reference line too short for a reliable estimate (scale error up to ${percent}%).` }]
}

export function limitWarning(cable: CableLengthEstimate, type: CableType): CableEstimateWarning | null {
  if (type.lengthLimitM === null) return null
  const prefix = `${cable.label} (${type.name}):`
  const limit = `${type.lengthLimitM} m limit`
  if (cable.limitStatus === 'over') {
    return { code: 'cable-over-limit', cableId: cable.cableId, message: `${prefix} ${formatMeters(cable.run.nominal)} run exceeds the ${limit}.` }
  }
  if (cable.limitStatus === 'maybe-over') {
    const upTo = formatMeters(cable.run.max ?? cable.run.nominal)
    return { code: 'cable-maybe-over-limit', cableId: cable.cableId, message: `${prefix} may exceed the ${limit} (up to ${upTo}).` }
  }
  return null
}

/** Human text for the "could not estimate" reasons, named by the cable's own end-to-end label. */
export function unavailableWarning(label: string, cableId: string, beyond: Extract<HubBeyondLength, { source: 'unavailable' }>): CableEstimateWarning {
  if (beyond.reason === 'link-cycle') {
    return { code: 'link-cycle', cableId, message: `${label}: its cross-floor route forms a cycle - excluded from the estimate.` }
  }
  return {
    code: 'linked-floor-scale-not-set',
    cableId,
    message: `${label}: the route continues on "${beyond.floorName}", which has no scale set - excluded from the estimate.`,
  }
}

/** "F1_C1_?"-style not-yet-routed notice, named by the cable's own end-to-end label. */
export function shaftNotRoutedWarning(label: string, cableId: string): CableEstimateWarning {
  return { code: 'shaft-cable-not-routed', cableId, message: `${label}: not routed beyond its shaft yet - counted up to the shaft only.` }
}
