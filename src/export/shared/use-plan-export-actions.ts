import {
  buildProjectCableEndToEndLabels,
  resolveShaftLegLabels,
  selectCableLabelStrings,
  type CableEndToEndLabel,
} from '../../domain/cable/cable-end-to-end-label'
import { findShaftLegsOnFloor } from '../../domain/cable/shaft-cable-leg'
import { useCallback, useState } from 'react'
import { describeUnestimatedCables } from '../../domain/cable/unestimated-cables-summary'
import { describeFloorsWithoutCableScale } from '../../domain/floor/floors-without-cable-scale-note'
import { useProjectStore } from '../../state/project-store'
import { getActiveFloor, selectImage, selectProject, selectScale } from '../../state/project-store-floor-selectors'
import { useEditorUiStore } from '../../state/editor-ui-store'
import { resolveEffectiveViewConfig } from '../../domain/view/view-config-tool-mode-overrides'
import { describeExportAllFloorsOutcome } from './describe-export-all-floors-outcome'
import { exportAllFloorPlansPng } from '../png/export-all-floor-plans-png'
import { exportPlanPng } from '../png/export-plan-png'
import { exportBomCsv } from '../csv/export-bom-csv'
import { exportCableLengthEstimateCsv } from '../csv/export-cable-length-estimate-csv'
import { fireAlarmModelSpecById } from './fire-alarm-compatibility-index-singleton'
import { buildCombinedBomRows } from './build-combined-bom-rows'
import { buildFloorExportFileName } from './build-floor-export-file-name'

const NO_CABLE_LABEL_ENTRIES: ReadonlyMap<string, CableEndToEndLabel> = new Map()

/**
 * PNG/CSV export handlers, pulled out of `app.tsx` (pure move, no behaviour
 * change) to keep that file under the project's line-count guideline and to
 * stop phases 5/6 (canvas rendering vs. sidebar tabs) from both needing to
 * touch `app.tsx` for export wiring. The placed items and the cable layout are read via
 * `useProjectStore.getState()` at call time rather than subscribed - they
 * only matter at the instant export runs, so a camera move no longer forces
 * these callbacks to be recreated.
 *
 * Phase 7 (project BOM/CSV/per-floor PNG): "Export PNG" is the ACTIVE
 * floor's own picture (needs that floor's own image + scale); "Export CSV"
 * is always the whole project; "Export all floors" loops every floor,
 * skipping (and naming) the ones without an image or a scale, and
 * continuing past one that fails outright (M2). `isExporting` (M2: "disable
 * both export buttons while an export runs") is true while EITHER async
 * export is in flight - the toolbar disables PNG/CSV/"Export all floors"
 * together so a user cannot start a second export while one is running.
 */
export function usePlanExportActions() {
  const image = useProjectStore(selectImage)
  const scale = useProjectStore(selectScale)
  const decodedImage = useEditorUiStore((s) => s.decodedImage)
  const pushNotification = useEditorUiStore((s) => s.pushNotification)

  const [isExportingPng, setIsExportingPng] = useState(false)
  const [isExportingAllFloors, setIsExportingAllFloors] = useState(false)
  const isExporting = isExportingPng || isExportingAllFloors

  const handleExportPng = useCallback(async () => {
    if (!image || !decodedImage || isExporting) return
    if (!scale) {
      pushNotification('warning', 'Set the scale before exporting a PNG.')
      return
    }
    setIsExportingPng(true)
    try {
      const store = useProjectStore.getState()
      const activeFloor = getActiveFloor(store)
      const project = selectProject(store)
      const floorIndex = project.floors.indexOf(activeFloor)
      const { allRows, cableEstimate, fireAlarmWarnings } = buildCombinedBomRows(project, { floorId: activeFloor.id })
      // Same label source the screen reads (`use-stage-cabling-scene-props.ts`).
      const allCableLabels = buildProjectCableEndToEndLabels(project, fireAlarmModelSpecById)
      const shaftLegs = findShaftLegsOnFloor(project.floors, activeFloor.id)
      // The drawing shows what is on screen: the stored view config with the active tool's layers forced on.
      const { viewConfig, toolMode } = useEditorUiStore.getState()
      await exportPlanPng({
        decodedImage,
        image,
        cameras: activeFloor.cameras,
        walls: activeFloor.walls,
        sensors: activeFloor.sensors,
        hubs: activeFloor.hubs,
        cables: activeFloor.cables,
        cableTypes: project.cableTypes,
        cableSettings: project.cableSettings,
        fireAlarmDevices: activeFloor.fireAlarmDevices,
        fireAlarmSettings: project.fireAlarmSettings,
        scale,
        cableEstimate,
        rows: allRows,
        fireAlarmWarnings,
        shaftIds: project.shafts.map((shaft) => shaft.id),
        shaftLegs,
        cableLabelByCableId: selectCableLabelStrings(allCableLabels.get(activeFloor.id) ?? NO_CABLE_LABEL_ENTRIES),
        shaftLegLabels: resolveShaftLegLabels(shaftLegs, project.floors, allCableLabels),
        shafts: project.shafts,
        floorPosition: { index: floorIndex, count: project.floors.length, name: activeFloor.name },
        fileName: buildFloorExportFileName(floorIndex, project.floors.length, activeFloor.name, image.fileName),
        viewConfig: resolveEffectiveViewConfig(viewConfig, toolMode),
        onDownscaled: (widthPx, heightPx, scaleFactor) =>
          pushNotification(
            'warning',
            `Exported at ${widthPx} x ${heightPx} (${Math.round(scaleFactor * 100)}%) - browser canvas limit.`,
          ),
      })
    } catch (err) {
      pushNotification('error', err instanceof Error ? err.message : 'Failed to export the PNG.')
    } finally {
      setIsExportingPng(false)
    }
  }, [image, decodedImage, scale, isExporting, pushNotification])

  const handleExportCsv = useCallback(() => {
    if (isExporting) return
    try {
      const store = useProjectStore.getState()
      const project = selectProject(store)
      const firstFloorWithImage = project.floors.find((floor) => floor.image !== null)
      if (!firstFloorWithImage?.image) return

      exportBomCsv({ project, imageFileName: firstFloorWithImage.image.fileName })
      // Second download, same click: the per-cable length CSV (phase 4) - BOM first, so the first
      // `waitForEvent('download')`/browser-prompt result is always the BOM.
      exportCableLengthEstimateCsv({ project, imageFileName: firstFloorWithImage.image.fileName })

      const { cableEstimate, floorsWithoutScale } = buildCombinedBomRows(project)
      if (project.floors.length > 1) {
        const note = describeFloorsWithoutCableScale(floorsWithoutScale)
        if (note) pushNotification('warning', `${note} (left out of the CSV).`)
      } else {
        const activeFloor = getActiveFloor(store)
        if (activeFloor.cables.length > 0 && !activeFloor.scale) {
          pushNotification('warning', 'Cable rows were left out of the CSV: set the scale first.')
        }
      }
      // HIGH fix: a cross-floor cable excluded from the estimate (unscaled partner floor, a link
      // cycle) left the CSV with no row for it at all, and no mention anywhere - warn, same
      // wording the BOM panel and the PNG legend use.
      const unestimatedNote = describeUnestimatedCables(cableEstimate.unestimatedCableCount, cableEstimate.warnings)
      if (unestimatedNote) pushNotification('warning', `${unestimatedNote} (left out of the CSV).`)
    } catch (err) {
      pushNotification('error', err instanceof Error ? err.message : 'Failed to export the CSV.')
    }
  }, [isExporting, pushNotification])

  const handleExportAllFloors = useCallback(async () => {
    if (isExporting) return
    setIsExportingAllFloors(true)
    try {
      const project = selectProject(useProjectStore.getState())
      const { viewConfig, toolMode } = useEditorUiStore.getState()
      const { exported, skipped, failed } = await exportAllFloorPlansPng({
        project,
        viewConfig: resolveEffectiveViewConfig(viewConfig, toolMode),
        onDownscaled: (widthPx, heightPx, scaleFactor, floorName) =>
          pushNotification(
            'warning',
            `${floorName}: exported at ${widthPx} x ${heightPx} (${Math.round(scaleFactor * 100)}%) - browser canvas limit.`,
          ),
      })
      pushNotification(failed.length > 0 ? 'error' : skipped.length > 0 ? 'warning' : 'info', describeExportAllFloorsOutcome(exported, skipped, failed))
    } catch (err) {
      pushNotification('error', err instanceof Error ? err.message : 'Failed to export all floors.')
    } finally {
      setIsExportingAllFloors(false)
    }
  }, [isExporting, pushNotification])

  return { isExportingPng, isExportingAllFloors, isExporting, handleExportPng, handleExportCsv, handleExportAllFloors }
}
