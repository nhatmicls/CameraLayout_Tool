import type { EffectiveVfov, VfovSource } from '../domain/camera-coverage-resolver'
import type { MountedGroundCoverage } from '../domain/mounted-camera-ground-coverage-calculator'
import { formatM } from './camera-properties-form-helpers'

interface CameraGroundCoverageReadoutProps {
  coverage: MountedGroundCoverage
  /** null = not applicable (HFOV >= 180deg with no datasheet value). */
  vfov: EffectiveVfov | null
  /** Datasheet illumination range in metres, or null when not published. */
  illuminationRangeM: number | null
}

const VFOV_SOURCE_LABELS: Record<VfovSource, string> = {
  datasheet: 'datasheet',
  'datasheet-interpolated': 'datasheet, interpolated between wide/tele',
  computed: 'computed, not from datasheet',
}

const rowLabelClass = 'py-0.5 text-neutral-600'
const rowValueClass = 'py-0.5 font-medium text-neutral-900'
const noteClass = 'mt-1 text-[11px] text-amber-700'

function farEdgeQualifier(coverage: MountedGroundCoverage): string {
  if (coverage.geometricFarM <= coverage.effectiveFarM) return ''
  if (coverage.fisheye || Number.isFinite(coverage.geometricFarM)) return ' (limited by range)'
  return ' (horizon in view - limited by range)'
}

/**
 * Floor coverage of a mounted camera: blind spot, drawn far edge, the
 * datasheet's max range beside them, and the vertical FOV with its source.
 * Display only - every number comes from `computeMountedGroundCoverage`.
 */
export function CameraGroundCoverageReadout({ coverage, vfov, illuminationRangeM }: CameraGroundCoverageReadoutProps) {
  const exceedsIllumination = illuminationRangeM !== null && coverage.effectiveFarM > illuminationRangeM

  return (
    <div data-testid="properties-coverage-readout" className="mt-3">
      <h3 className="text-xs font-semibold text-neutral-700">Floor coverage</h3>
      <table className="mt-1 w-full text-left text-xs">
        <tbody>
          <tr>
            <td className={rowLabelClass}>Blind spot</td>
            <td data-testid="properties-coverage-near" className={rowValueClass}>
              {formatM(coverage.nearM)}
            </td>
          </tr>
          <tr className="border-t border-neutral-100">
            <td className={rowLabelClass}>Far edge</td>
            <td data-testid="properties-coverage-far" className={rowValueClass}>
              {formatM(coverage.effectiveFarM)}
              <span className="font-normal text-neutral-500">{farEdgeQualifier(coverage)}</span>
            </td>
          </tr>
          <tr className="border-t border-neutral-100">
            <td className={rowLabelClass}>Max range (datasheet)</td>
            <td data-testid="properties-coverage-max-range" className={rowValueClass}>
              {illuminationRangeM === null ? 'not published' : `${illuminationRangeM} m`}
            </td>
          </tr>
          <tr className="border-t border-neutral-100">
            <td className={rowLabelClass}>Vertical FOV</td>
            <td data-testid="properties-coverage-vfov" className={rowValueClass}>
              {coverage.fisheye || vfov === null ? (
                'not used (fisheye)'
              ) : (
                <>
                  {vfov.vfovDeg.toFixed(1)}&deg;{' '}
                  <span className="font-normal text-neutral-500">({VFOV_SOURCE_LABELS[vfov.source]})</span>
                </>
              )}
            </td>
          </tr>
        </tbody>
      </table>
      {exceedsIllumination && (
        <p data-testid="properties-coverage-range-warning" className={noteClass}>
          Warning: far edge exceeds the datasheet illumination range ({illuminationRangeM} m).
        </p>
      )}
      {coverage.bands.length === 0 && (
        <p data-testid="properties-coverage-empty-note" className={noteClass}>
          No floor coverage within the current range - increase range or tilt.
        </p>
      )}
      <p className="mt-1 text-[11px] text-neutral-500">Floor distances are centre-line approximations (slant model).</p>
    </div>
  )
}
