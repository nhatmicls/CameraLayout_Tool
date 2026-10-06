import type { CableLengthEstimate } from '../../domain/cable/cable-length-estimate-calculator'
import { formatMeters } from '../../domain/cable/cable-length-format'

/** The cable properties panel's one-line verdict on the type's length limit (checked on the run, without waste). */
export function cableLimitStatusText(estimate: CableLengthEstimate, lengthLimitM: number | null): string {
  switch (estimate.limitStatus) {
    case 'ok':
      return `Within the ${lengthLimitM} m limit`
    case 'maybe-over':
      return `May exceed the ${lengthLimitM} m limit (up to ${formatMeters(estimate.run.max ?? estimate.run.nominal)})`
    case 'over':
      return `Exceeds the ${lengthLimitM} m limit`
    case 'no-limit':
      return 'No length limit set for this type'
  }
}
