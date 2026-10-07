import type { FireAlarmModelSpec, FireAlarmSettings } from '../../domain/fire-alarm/fire-alarm-device-types'
import { resolveFireDetectorCoverageReadout } from './fire-detector-coverage-readout-text'
import {
  FIRE_COVERAGE_APPROXIMATION_NOTE,
  FIRE_COVERAGE_CO_NO_TABLE,
  FIRE_COVERAGE_DATASHEET_MODE,
  FIRE_COVERAGE_NEEDS_CEILING_HEIGHT,
  FIRE_COVERAGE_NEEDS_SCALE,
  FIRE_COVERAGE_NOT_CERTIFIED_NOTE,
  fireCoverageOutsideTableMessage,
} from './fire-alarm-ui-wording'
import { Tcvn5738SourceLink } from './tcvn-5738-source-link'

interface FireDetectorCoverageReadoutProps {
  model: FireAlarmModelSpec
  settings: FireAlarmSettings
  hasScale: boolean
}

const READOUT_TEST_ID = 'properties-fire-coverage-readout'

/**
 * Why no circle is drawn, or the resolved TCVN 5738 circle's figures, for
 * the selected detector. Case selection is pure logic in
 * `fire-detector-coverage-readout-text.ts` (unit-tested there) - this
 * component only renders the chosen case. Renders nothing for a
 * non-detector kind.
 */
export function FireDetectorCoverageReadout({ model, settings, hasScale }: FireDetectorCoverageReadoutProps) {
  const readout = resolveFireDetectorCoverageReadout(model, settings, hasScale)

  switch (readout.case) {
    case 'not-detector':
      return null

    case 'datasheet-mode':
      return (
        <p data-testid={READOUT_TEST_ID} className="mt-2 text-xs text-neutral-500">
          {FIRE_COVERAGE_DATASHEET_MODE}
        </p>
      )

    case 'needs-ceiling-height':
      return (
        <p data-testid={READOUT_TEST_ID} className="mt-2 text-xs text-amber-700">
          {FIRE_COVERAGE_NEEDS_CEILING_HEIGHT}
        </p>
      )

    case 'co-no-table':
      return (
        <p data-testid={READOUT_TEST_ID} className="mt-2 text-xs text-neutral-500">
          {FIRE_COVERAGE_CO_NO_TABLE}
        </p>
      )

    case 'outside-table':
      return (
        <p data-testid={READOUT_TEST_ID} className="mt-2 text-xs text-amber-700">
          {fireCoverageOutsideTableMessage(readout.kindLabel)}
        </p>
      )

    case 'needs-scale':
      return (
        <p data-testid={READOUT_TEST_ID} className="mt-2 text-xs text-amber-700">
          {FIRE_COVERAGE_NEEDS_SCALE}
        </p>
      )

    case 'circle':
      return (
        <div data-testid={READOUT_TEST_ID} className="mt-2 text-xs text-neutral-600">
          <p>
            {readout.edition}, clause {readout.clause} ({readout.table}), ceiling {readout.ceilingHeightM} m
          </p>
          <p>
            Area {readout.areaM2} m&sup2; &rarr; radius {readout.radiusM.toFixed(2)} m
          </p>
          <p>
            Printed max spacing {readout.spacingM} m, max wall distance {readout.wallDistanceM} m
          </p>
          <p>
            Based on: <Tcvn5738SourceLink testId="properties-fire-coverage-source-link" />
          </p>
          <p className="mt-1 text-neutral-500">{FIRE_COVERAGE_APPROXIMATION_NOTE}</p>
          <p className="text-amber-700">{FIRE_COVERAGE_NOT_CERTIFIED_NOTE}</p>
        </div>
      )
  }
}
