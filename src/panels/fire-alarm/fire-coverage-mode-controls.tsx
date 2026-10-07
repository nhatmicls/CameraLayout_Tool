import type { FireCoverageMode } from '../../domain/fire-alarm/fire-alarm-device-types'
import { CEILING_HEIGHT_MAX_M, isTcvn5738TableAvailable } from '../../domain/fire-alarm/tcvn-5738-detector-protection-table'
import { useCatalogSidebarFilterStore } from '../../state/catalog-sidebar-filter-store'
import { useProjectStore } from '../../state/project-store'
import { selectFireAlarmDevices } from '../../state/project-store-floor-selectors'
import { NullableNumberInput } from '../shared/nullable-number-input'
import { FIRE_COVERAGE_MODE_TCVN_HINT, FIRE_COVERAGE_NEEDS_CEILING_HEIGHT } from './fire-alarm-ui-wording'
import { Tcvn5738SourceLink } from './tcvn-5738-source-link'

interface FireCoverageModeControlsProps {
  hasImage: boolean
}

const CEILING_HEIGHT_MIN_M = 0.1

/**
 * Self-contained toolbar group for the fire-detector coverage mode:
 * Datasheet | TCVN 5738, plus the ceiling height the TCVN table lookup
 * uses. Reads/writes the project and catalog-sidebar stores directly
 * (parallel to `WallToolControls`/`CableToolControls`), so `app-toolbar.tsx`
 * only has to mount one line. Visible when an image is loaded AND (the
 * fire-alarm tab is active OR at least one fire-alarm device is placed) -
 * otherwise it would be dead UI for a plan with no fire devices. The TCVN
 * option itself is hidden when the standard's table was never populated
 * (G3 no-go, `isTcvn5738TableAvailable`); nothing else about the group
 * changes in that case.
 */
export function FireCoverageModeControls({ hasImage }: FireCoverageModeControlsProps) {
  const fireAlarmSettings = useProjectStore((s) => s.fireAlarmSettings)
  const setFireAlarmSettings = useProjectStore((s) => s.setFireAlarmSettings)
  const fireAlarmDeviceCount = useProjectStore((s) => selectFireAlarmDevices(s).length)
  const catalogTab = useCatalogSidebarFilterStore((s) => s.catalogTab)

  const visible = hasImage && (catalogTab === 'fire-alarm' || fireAlarmDeviceCount > 0)
  if (!visible) return null

  const tcvnAvailable = isTcvn5738TableAvailable()
  const showCeilingHeightInput = fireAlarmSettings.coverageMode === 'tcvn-5738' && tcvnAvailable

  return (
    <div role="group" aria-label="Fire detector coverage" className="flex items-center gap-1.5">
      <span className="text-xs text-neutral-500">Fire coverage</span>
      <select
        data-testid="fire-coverage-mode-select"
        value={fireAlarmSettings.coverageMode}
        onChange={(e) => setFireAlarmSettings({ coverageMode: e.target.value as FireCoverageMode })}
        className="rounded border border-neutral-300 bg-white px-1 py-1 text-sm text-neutral-700"
      >
        <option value="datasheet">Datasheet</option>
        {tcvnAvailable && <option value="tcvn-5738">TCVN 5738</option>}
      </select>

      {showCeilingHeightInput && (
        <>
          <span className="text-[11px] text-neutral-400">{FIRE_COVERAGE_MODE_TCVN_HINT}</span>
          <Tcvn5738SourceLink testId="fire-coverage-source-link" />
          <label className="flex items-center gap-1 text-xs text-neutral-500" htmlFor="fire-coverage-ceiling-height-input">
            Ceiling (m)
            <NullableNumberInput
              id="fire-coverage-ceiling-height-input"
              testId="fire-coverage-ceiling-height-input"
              value={fireAlarmSettings.ceilingHeightM}
              min={CEILING_HEIGHT_MIN_M}
              max={CEILING_HEIGHT_MAX_M}
              step={0.1}
              onCommit={(ceilingHeightM) => setFireAlarmSettings({ ceilingHeightM })}
              className="w-16 rounded border border-neutral-300 px-1 py-1 text-sm text-neutral-700"
            />
          </label>
          {fireAlarmSettings.ceilingHeightM === null && (
            <span data-testid="fire-coverage-ceiling-height-hint" className="text-[11px] text-amber-700">
              {FIRE_COVERAGE_NEEDS_CEILING_HEIGHT}
            </span>
          )}
        </>
      )}
    </div>
  )
}
