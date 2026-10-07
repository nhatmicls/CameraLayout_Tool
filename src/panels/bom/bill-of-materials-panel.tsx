import { useMemo } from 'react'
import { computeBomTotal, formatVnd, type BomRow } from '../../domain/bom/bill-of-materials-grouping'
import { formatBomUnpricedNote } from '../../domain/bom/cable-bill-of-materials-grouping'
import { SCALE_NOT_SET_CABLE_MESSAGE } from '../../domain/cable/cable-layout-estimate'
import { buildCombinedBomRows } from '../../export/shared/build-combined-bom-rows'
import { FireAlarmCompatibilityWarningsBlock } from '../fire-alarm/fire-alarm-compatibility-warnings-block'
import { useProjectStore } from '../../state/project-store'
import {
  selectCables,
  selectCameras,
  selectFireAlarmDevices,
  selectHubs,
  selectScale,
  selectSensors,
} from '../../state/project-store-floor-selectors'
import { BillOfMaterialsCableRowsTable } from './bill-of-materials-cable-rows-table'
import { BillOfMaterialsRow } from './bill-of-materials-row'
import { BillOfMaterialsTableHeaderRow } from './bill-of-materials-table-header-row'

/** Stable per-row id derived from the row's own identity (type+brand+model+lens) - the same key the grouping functions group by, so it's as stable as the BOM itself. `type` keeps a camera row and a sensor row that happen to share brand+model+lens from colliding. */
function bomRowSlug(row: BomRow): string {
  return `${row.type}-${row.brand}-${row.model}-${row.lens}`.toLowerCase().replace(/[^a-z0-9]+/g, '-')
}

const plural = (count: number, noun: string) => `${count} ${noun}${count === 1 ? '' : 's'}`

/**
 * Live bill-of-materials table. Pure presentation - the rows come from
 * `buildCombinedBomRows`, the same call the CSV and PNG exports make, so
 * the three can never disagree. Cameras, sensors and cables render as
 * separate tables (sub-headings shown only when the project has more than
 * one of them); cable rows need a scale, since their quantity is metres.
 */
export function BillOfMaterialsPanel() {
  const cameras = useProjectStore(selectCameras)
  const sensors = useProjectStore(selectSensors)
  const fireAlarmDevices = useProjectStore(selectFireAlarmDevices)
  const hubs = useProjectStore(selectHubs)
  const cables = useProjectStore(selectCables)
  const cableTypes = useProjectStore((s) => s.cableTypes)
  const cableSettings = useProjectStore((s) => s.cableSettings)
  const scale = useProjectStore(selectScale)

  const { cameraRows, sensorRows, fireAlarmRows, cableRows, allRows, fireAlarmWarnings } = useMemo(
    () => buildCombinedBomRows({ cameras, sensors, fireAlarmDevices, hubs, cables, cableTypes, cableSettings, scale }),
    [cameras, sensors, fireAlarmDevices, hubs, cables, cableTypes, cableSettings, scale],
  )
  const cameraCount = cameraRows.reduce((sum, row) => sum + row.quantity, 0)
  const sensorCount = sensorRows.reduce((sum, row) => sum + row.quantity, 0)
  const fireAlarmCount = fireAlarmRows.reduce((sum, row) => sum + row.quantity, 0)
  const total = useMemo(() => computeBomTotal(allRows), [allRows])
  const unpricedNote = formatBomUnpricedNote(total)

  const hasCameras = cameraRows.length > 0
  const hasSensors = sensorRows.length > 0
  const hasFireAlarm = fireAlarmRows.length > 0
  const hasCables = cables.length > 0
  const showSubHeadings = [hasCameras, hasSensors, hasFireAlarm, hasCables].filter(Boolean).length > 1

  return (
    <div data-testid="bom-panel" className="mt-4 border-t border-neutral-200 pt-3">
      <div className="flex items-baseline justify-between">
        <h2 className="text-sm font-semibold text-neutral-700">Bill of materials</h2>
        <span data-testid="bom-total-count" className="text-xs text-neutral-500">
          {plural(cameraCount, 'camera')}, {plural(sensorCount, 'sensor')}, {plural(fireAlarmCount, 'fire-alarm device')}
          {hasCables && `, ${plural(cables.length, 'cable')}`}
        </span>
      </div>

      {!hasCameras && !hasSensors && !hasFireAlarm && !hasCables ? (
        <p data-testid="bom-empty-state" className="mt-2 text-xs text-neutral-400">
          No cameras, sensors, fire-alarm devices or cables placed yet.
        </p>
      ) : (
        <div className="mt-2 overflow-x-auto">
          {hasCameras && (
            <>
              {showSubHeadings && <h3 className="text-xs font-semibold text-neutral-600">Cameras</h3>}
              <table className="w-full min-w-[400px] text-left text-xs">
                <thead>
                  <BillOfMaterialsTableHeaderRow />
                </thead>
                <tbody>
                  {cameraRows.map((row) => (
                    <BillOfMaterialsRow key={bomRowSlug(row)} row={row} slug={bomRowSlug(row)} labelsTestIdPrefix="cameras" />
                  ))}
                </tbody>
              </table>
            </>
          )}

          {hasSensors && (
            <>
              {showSubHeadings && <h3 className="mt-3 text-xs font-semibold text-neutral-600">Sensors</h3>}
              <table className="w-full min-w-[400px] text-left text-xs">
                <thead>
                  <BillOfMaterialsTableHeaderRow />
                </thead>
                <tbody>
                  {sensorRows.map((row) => (
                    <BillOfMaterialsRow key={bomRowSlug(row)} row={row} slug={bomRowSlug(row)} labelsTestIdPrefix="labels" />
                  ))}
                </tbody>
              </table>
            </>
          )}

          {hasFireAlarm && (
            <>
              {showSubHeadings && <h3 className="mt-3 text-xs font-semibold text-neutral-600">Fire alarm</h3>}
              <table className="w-full min-w-[400px] text-left text-xs">
                <thead>
                  <BillOfMaterialsTableHeaderRow />
                </thead>
                <tbody>
                  {fireAlarmRows.map((row) => (
                    <BillOfMaterialsRow key={bomRowSlug(row)} row={row} slug={bomRowSlug(row)} labelsTestIdPrefix="fire-alarm" />
                  ))}
                </tbody>
              </table>
            </>
          )}

          {hasCables && (
            <>
              {showSubHeadings && <h3 className="mt-3 text-xs font-semibold text-neutral-600">Cables</h3>}
              {scale ? (
                <BillOfMaterialsCableRowsTable rows={cableRows} />
              ) : (
                <p data-testid="bom-cables-no-scale" className="text-xs font-medium text-amber-600">
                  {SCALE_NOT_SET_CABLE_MESSAGE}
                </p>
              )}
            </>
          )}

          <p data-testid="bom-total-price" className="mt-2 text-right text-xs font-semibold text-neutral-800">
            Estimated total: {formatVnd(total.totalVnd)}
            {unpricedNote && <span className="ml-1 font-normal text-neutral-500">({unpricedNote})</span>}
          </p>
          <p className="mt-0.5 text-right text-[10px] text-neutral-400">
            Indicative Vietnam reseller prices{hasCables ? '; cable prices as you entered them' : ''} - confirm with your supplier.
          </p>

          <FireAlarmCompatibilityWarningsBlock devices={fireAlarmDevices} warnings={fireAlarmWarnings} />
        </div>
      )}
    </div>
  )
}
