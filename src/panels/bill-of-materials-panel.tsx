import { useMemo } from 'react'
import { computeBomTotal, formatVnd, groupCamerasIntoBom, type BomRow } from '../domain/bill-of-materials-grouping'
import { groupSensorsIntoBom } from '../domain/sensor-bill-of-materials-grouping'
import { buildCameraModelByIdRecord } from '../export/camera-model-by-id-record'
import { buildSensorModelByIdRecord } from '../export/sensor-model-by-id-record'
import { useProjectStore } from '../state/project-store'
import { BillOfMaterialsRow } from './bill-of-materials-row'
import { BillOfMaterialsTableHeaderRow } from './bill-of-materials-table-header-row'

/** Stable per-row id derived from the row's own identity (type+brand+model+lens) - the same key the grouping functions group by, so it's as stable as the BOM itself. `type` keeps a camera row and a sensor row that happen to share brand+model+lens from colliding. */
function bomRowSlug(row: BomRow): string {
  return `${row.type}-${row.brand}-${row.model}-${row.lens}`.toLowerCase().replace(/[^a-z0-9]+/g, '-')
}

/**
 * Live bill-of-materials table, grouped by the domain layer
 * (`groupCamerasIntoBom` + `groupSensorsIntoBom`). Pure presentation - no
 * grouping/sorting logic lives here. Cameras and sensors render as two
 * separate tables (sub-headings shown only when the project has both), each
 * sharing the same header row and row component.
 */
export function BillOfMaterialsPanel() {
  const cameras = useProjectStore((s) => s.cameras)
  const sensors = useProjectStore((s) => s.sensors)

  // Reuses the full-catalog record builders already used by the PNG/CSV export orchestrators
  // (`buildCameraModelByIdRecord`/`buildSensorModelByIdRecord`) instead of a hand-rolled
  // per-placed-item loop building the same id->spec shape.
  const cameraModels = useMemo(() => buildCameraModelByIdRecord(), [])
  const sensorModels = useMemo(() => buildSensorModelByIdRecord(), [])

  const cameraRows = useMemo(() => groupCamerasIntoBom(cameras, cameraModels), [cameras, cameraModels])
  const sensorRows = useMemo(() => groupSensorsIntoBom(sensors, sensorModels), [sensors, sensorModels])

  const cameraCount = useMemo(() => cameraRows.reduce((sum, row) => sum + row.quantity, 0), [cameraRows])
  const sensorCount = useMemo(() => sensorRows.reduce((sum, row) => sum + row.quantity, 0), [sensorRows])
  const total = useMemo(() => computeBomTotal([...cameraRows, ...sensorRows]), [cameraRows, sensorRows])

  const hasCameras = cameraRows.length > 0
  const hasSensors = sensorRows.length > 0
  const showSubHeadings = hasCameras && hasSensors

  return (
    <div data-testid="bom-panel" className="mt-4 border-t border-neutral-200 pt-3">
      <div className="flex items-baseline justify-between">
        <h2 className="text-sm font-semibold text-neutral-700">Bill of materials</h2>
        <span data-testid="bom-total-count" className="text-xs text-neutral-500">
          {cameraCount} camera{cameraCount === 1 ? '' : 's'}, {sensorCount} sensor{sensorCount === 1 ? '' : 's'}
        </span>
      </div>

      {!hasCameras && !hasSensors ? (
        <p data-testid="bom-empty-state" className="mt-2 text-xs text-neutral-400">
          No cameras or sensors placed yet.
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

          <p data-testid="bom-total-price" className="mt-2 text-right text-xs font-semibold text-neutral-800">
            Estimated total: {formatVnd(total.totalVnd)}
            {total.unpricedQuantity > 0 && (
              <span className="ml-1 font-normal text-neutral-500">
                (excludes {total.unpricedQuantity} item{total.unpricedQuantity === 1 ? '' : 's'} with no listed price)
              </span>
            )}
          </p>
          <p className="mt-0.5 text-right text-[10px] text-neutral-400">Indicative Vietnam reseller prices - confirm with your supplier.</p>
        </div>
      )}
    </div>
  )
}
