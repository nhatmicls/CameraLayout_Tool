import { useCallback, useMemo, useState } from 'react'
import { computeBomTotal, type BomRow } from '../../domain/bom/bill-of-materials-grouping'
import { formatVnd } from '../../domain/bom/bom-price-formatting'
import { formatBomUnpricedNote } from '../../domain/bom/cable-bill-of-materials-grouping'
import { describeUnestimatedCables } from '../../domain/cable/unestimated-cables-summary'
import { describeFloorsWithoutCableScale } from '../../domain/floor/floors-without-cable-scale-note'
import { resolveFireAlarmDeviceLabel } from '../../domain/fire-alarm/fire-alarm-device-label-by-id'
import { buildCombinedBomRows } from '../../export/shared/build-combined-bom-rows'
import { fireAlarmModelSpecById } from '../../export/shared/fire-alarm-compatibility-index-singleton'
import { FireAlarmCompatibilityWarningsBlock } from '../fire-alarm/fire-alarm-compatibility-warnings-block'
import { useProjectStore } from '../../state/project-store'
import { selectProject } from '../../state/project-store-floor-selectors'
import { useEditorUiStore } from '../../state/editor-ui-store'
import { BillOfMaterialsCablesSection } from './bill-of-materials-cables-section'
import { BillOfMaterialsFloorFilter } from './bill-of-materials-floor-filter'
import { BillOfMaterialsRowsSection } from './bill-of-materials-rows-section'

/** Stable per-row id derived from the row's own identity (type+brand+model+lens) - the same key the grouping functions group by, so it's as stable as the BOM itself. `type` keeps a camera row and a sensor row that happen to share brand+model+lens from colliding. */
function bomRowSlug(row: BomRow): string {
  return `${row.type}-${row.brand}-${row.model}-${row.lens}`.toLowerCase().replace(/[^a-z0-9]+/g, '-')
}

const plural = (count: number, noun: string) => `${count} ${noun}${count === 1 ? '' : 's'}`

/**
 * Live bill-of-materials table. Pure presentation - the rows come from
 * `buildCombinedBomRows`, the same call the CSV and PNG exports make, so
 * the three can never disagree. Project-wide by default: labels always
 * floor-prefixed (owner decision 2026-10-09), cable totals summed across
 * floors; the floor filter (shown only once there is more than one floor)
 * switches to one floor's own rows, still floor-prefixed. Cameras, sensors,
 * fire-alarm devices, cabling points (hub/riser/drop/shaft-opening markers,
 * priced TBD) and cables render as separate tables (sub-headings shown only
 * when the view has more than one of them); a cable row needs a scale on at
 * least one floor in view, since its quantity is metres.
 */
export function BillOfMaterialsPanel() {
  const floors = useProjectStore((s) => s.floors)
  const shafts = useProjectStore((s) => s.shafts)
  const cableTypes = useProjectStore((s) => s.cableTypes)
  const cableSettings = useProjectStore((s) => s.cableSettings)
  const fireAlarmSettings = useProjectStore((s) => s.fireAlarmSettings)
  const activeFloorId = useProjectStore((s) => s.activeFloorId)
  const setSelectedFireAlarmDeviceId = useEditorUiStore((s) => s.setSelectedFireAlarmDeviceId)
  // Built locally from stable slices via `selectProject` (not a store selector returning a
  // fresh object directly) - a zustand selector must return a STABLE reference when nothing
  // changed, or React re-renders forever re-deriving it.
  const project = useMemo(
    () => selectProject({ floors, shafts, cableTypes, cableSettings, fireAlarmSettings }),
    [floors, shafts, cableTypes, cableSettings, fireAlarmSettings],
  )
  const [selectedFloorId, setSelectedFloorId] = useState<string>('all')

  // Falls back to "All floors" if the selected floor disappeared (deleted/reordered away).
  const effectiveFloorId = selectedFloorId === 'all' || floors.some((floor) => floor.id === selectedFloorId) ? selectedFloorId : 'all'
  const floorsInView = useMemo(
    () => (effectiveFloorId === 'all' ? floors : floors.filter((floor) => floor.id === effectiveFloorId)),
    [floors, effectiveFloorId],
  )
  const cables = useMemo(() => floorsInView.flatMap((floor) => floor.cables), [floorsInView])
  const hasScaleInView = floorsInView.some((floor) => floor.scale !== null)

  const { cameraRows, sensorRows, fireAlarmRows, cablingPointRows, cableRows, allRows, fireAlarmWarnings, floorsWithoutScale, cableEstimate } = useMemo(
    () => buildCombinedBomRows(project, effectiveFloorId === 'all' ? undefined : { floorId: effectiveFloorId }),
    [project, effectiveFloorId],
  )
  const cameraCount = cameraRows.reduce((sum, row) => sum + row.quantity, 0)
  const sensorCount = sensorRows.reduce((sum, row) => sum + row.quantity, 0)
  const fireAlarmCount = fireAlarmRows.reduce((sum, row) => sum + row.quantity, 0)
  const total = useMemo(() => computeBomTotal(allRows), [allRows])
  const unpricedNote = formatBomUnpricedNote(total)

  const hasCameras = cameraRows.length > 0
  const hasSensors = sensorRows.length > 0
  const hasFireAlarm = fireAlarmRows.length > 0
  const hasCablingPoints = cablingPointRows.length > 0
  const hasCables = cables.length > 0
  const showSubHeadings = [hasCameras, hasSensors, hasFireAlarm, hasCablingPoints, hasCables].filter(Boolean).length > 1
  const floorsWithoutScaleNote = describeFloorsWithoutCableScale(floorsWithoutScale)
  // HIGH fix: a cross-floor cable excluded from the estimate (unscaled partner floor, a link
  // cycle) must never just silently show short metres here - name it, same wording the CSV
  // notification and the PNG legend use.
  const unestimatedNote = describeUnestimatedCables(cableEstimate.unestimatedCableCount, cableEstimate.warnings)

  // H3 review fix: label fire-alarm warning lines with the SAME text their BOM row uses (always
  // floor-prefixed - owner decision 2026-10-09) - never a raw flattened index that can name an
  // "F3" that exists on no floor. A line is clickable only when its device is on the floor
  // currently active on the CANVAS (switching floors first would be the fancier option - this is
  // the simpler one, see the component's own doc comment).
  const labelForFireAlarmDevice = useCallback(
    (deviceId: string) => resolveFireAlarmDeviceLabel(floors, deviceId, fireAlarmModelSpecById, effectiveFloorId === 'all' ? undefined : effectiveFloorId),
    [floors, effectiveFloorId],
  )
  const isFireAlarmDeviceOnActiveFloor = useCallback(
    (deviceId: string) => floors.find((floor) => floor.id === activeFloorId)?.fireAlarmDevices.some((device) => device.id === deviceId) ?? false,
    [floors, activeFloorId],
  )

  return (
    <div data-testid="bom-panel" className="mt-4 border-t border-neutral-200 pt-3">
      <div className="flex items-baseline justify-between">
        <h2 className="text-sm font-semibold text-neutral-700">Bill of materials</h2>
        <span data-testid="bom-total-count" className="text-xs text-neutral-500">
          {plural(cameraCount, 'camera')}, {plural(sensorCount, 'sensor')}, {plural(fireAlarmCount, 'fire-alarm device')}
          {hasCables && `, ${plural(cables.length, 'cable')}`}
        </span>
      </div>
      {/* M4 review fix: restores the pre-plan one-floor header exactly (h2 left, count right, single
          row) - the floor filter is an EXTRA row that only exists once there is something to filter. */}
      {floors.length > 1 && (
        <div className="mt-1 flex items-baseline justify-end">
          <BillOfMaterialsFloorFilter floors={floors} selectedFloorId={effectiveFloorId} onChange={setSelectedFloorId} />
        </div>
      )}

      {!hasCameras && !hasSensors && !hasFireAlarm && !hasCablingPoints && !hasCables ? (
        <p data-testid="bom-empty-state" className="mt-2 text-xs text-neutral-400">
          No cameras, sensors, fire-alarm devices or cables placed yet.
        </p>
      ) : (
        <div className="mt-2 overflow-x-auto">
          <BillOfMaterialsRowsSection heading="Cameras" showHeading={showSubHeadings} rows={cameraRows} labelsTestIdPrefix="cameras" slugFor={bomRowSlug} isFirst />
          <BillOfMaterialsRowsSection heading="Sensors" showHeading={showSubHeadings} rows={sensorRows} labelsTestIdPrefix="labels" slugFor={bomRowSlug} />
          <BillOfMaterialsRowsSection heading="Fire alarm" showHeading={showSubHeadings} rows={fireAlarmRows} labelsTestIdPrefix="fire-alarm" slugFor={bomRowSlug} />
          <BillOfMaterialsRowsSection heading="Cabling points" showHeading={showSubHeadings} rows={cablingPointRows} labelsTestIdPrefix="cabling-point" slugFor={bomRowSlug} />

          {hasCables && (
            <BillOfMaterialsCablesSection
              showHeading={showSubHeadings}
              hasScaleInView={hasScaleInView}
              cableRows={cableRows}
              floorsWithoutScaleNote={floorsWithoutScaleNote}
              unestimatedNote={unestimatedNote}
            />
          )}

          <p data-testid="bom-total-price" className="mt-2 text-right text-xs font-semibold text-neutral-800">
            Estimated total: {formatVnd(total.totalVnd)}
            {unpricedNote && <span className="ml-1 font-normal text-neutral-500">({unpricedNote})</span>}
          </p>
          <p className="mt-0.5 text-right text-[10px] text-neutral-400">
            Indicative Vietnam reseller prices{hasCables ? '; cable prices as you entered them' : ''} - confirm with your supplier.
          </p>

          <FireAlarmCompatibilityWarningsBlock
            warnings={fireAlarmWarnings}
            labelFor={labelForFireAlarmDevice}
            isSelectable={isFireAlarmDeviceOnActiveFloor}
            onSelectDevice={setSelectedFireAlarmDeviceId}
          />
        </div>
      )}
    </div>
  )
}
