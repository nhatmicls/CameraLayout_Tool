import { findShaftLegsOnFloor } from '../../domain/cable/shaft-cable-leg'
import { decodeEmbeddedImage } from '../../file-io/browser/decode-image-data-url'
import type { Project } from '../../domain/project-file/project-types'
import type { ViewConfig } from '../../domain/view/view-config-types'
import { buildCombinedBomRows } from '../shared/build-combined-bom-rows'
import { buildFloorExportFileName } from '../shared/build-floor-export-file-name'
import { exportPlanPng, type ExportPlanPngOptions } from './export-plan-png'

/** One floor's position in the project (1-based) + name - the common shape every outcome list below shares, so the caller can always say "F{position} {name}". */
export interface FloorExportOutcome {
  position: number
  name: string
}

export interface SkippedFloorOutcome extends FloorExportOutcome {
  reason: 'no-image' | 'no-scale'
}

export interface FailedFloorOutcome extends FloorExportOutcome {
  message: string
}

export interface ExportAllFloorPlansPngResult {
  exported: FloorExportOutcome[]
  skipped: SkippedFloorOutcome[]
  /** M2 review fix: a floor whose export THREW (e.g. blank-canvas guard, browser allocation limit) no longer aborts the whole run - it is recorded here and the loop continues to the next floor. */
  failed: FailedFloorOutcome[]
}

export interface ExportAllFloorPlansPngOptions {
  project: Project
  viewConfig: ViewConfig
  now?: Date
  /** M2 review fix: the floor name is included so the caller's notification can say WHICH floor was downscaled. */
  onDownscaled?: (widthPx: number, heightPx: number, scaleFactor: number, floorName: string) => void
  /** Gap between two downloads - default 300 ms (plan decision g); injectable so a test does not have to wait for real time. */
  delayMs?: number
}

const DEFAULT_DELAY_MS = 300

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * "Export all floors" (plan decision g): one PNG download per floor that
 * has both an image and a scale, sequential with a short gap between
 * downloads (browsers otherwise block a burst of downloads), skipping and
 * naming every floor that lacks either. No zip - the browser's own
 * multiple-download prompt is the accepted UX (README/risk assessment).
 * Decodes and releases one `HTMLImageElement` at a time (in a `finally`),
 * so memory never holds more than one floor's decoded bitmap + canvases.
 * M2 review fix: a floor whose own export throws is recorded as FAILED and
 * the loop continues - one bad floor (corrupt image data, a browser canvas
 * limit) must never silently stop every floor after it from exporting.
 */
export async function exportAllFloorPlansPng(options: ExportAllFloorPlansPngOptions): Promise<ExportAllFloorPlansPngResult> {
  const { project } = options
  const floorCount = project.floors.length
  const exported: FloorExportOutcome[] = []
  const skipped: SkippedFloorOutcome[] = []
  const failed: FailedFloorOutcome[] = []

  for (let floorIndex = 0; floorIndex < floorCount; floorIndex += 1) {
    const floor = project.floors[floorIndex]
    const outcome: FloorExportOutcome = { position: floorIndex + 1, name: floor.name }

    if (!floor.image) {
      skipped.push({ ...outcome, reason: 'no-image' })
      continue
    }
    if (!floor.scale) {
      skipped.push({ ...outcome, reason: 'no-scale' })
      continue
    }

    if (exported.length + failed.length > 0) await delay(options.delayMs ?? DEFAULT_DELAY_MS)

    let decodedImage: HTMLImageElement | null = null
    try {
      const { allRows, cableEstimate, fireAlarmWarnings } = buildCombinedBomRows(project, { floorId: floor.id })
      decodedImage = await decodeEmbeddedImage(floor.image.dataUrl)
      await exportPlanPng({
        decodedImage,
        image: floor.image,
        cameras: floor.cameras,
        walls: floor.walls,
        sensors: floor.sensors,
        hubs: floor.hubs,
        cables: floor.cables,
        cableTypes: project.cableTypes,
        cableSettings: project.cableSettings,
        fireAlarmDevices: floor.fireAlarmDevices,
        fireAlarmSettings: project.fireAlarmSettings,
        scale: floor.scale,
        cableEstimate,
        rows: allRows,
        fireAlarmWarnings,
        shaftIds: project.shafts.map((shaft) => shaft.id),
        shaftLegs: findShaftLegsOnFloor(project.floors, floor.id),
        shafts: project.shafts,
        floorPosition: { index: floorIndex, count: floorCount, name: floor.name },
        fileName: buildFloorExportFileName(floorIndex, floorCount, floor.name, floor.image.fileName),
        viewConfig: options.viewConfig,
        now: options.now,
        onDownscaled: options.onDownscaled
          ? (widthPx, heightPx, scaleFactor) => options.onDownscaled!(widthPx, heightPx, scaleFactor, floor.name)
          : undefined,
      } satisfies ExportPlanPngOptions)
      exported.push(outcome)
    } catch (err) {
      failed.push({ ...outcome, message: err instanceof Error ? err.message : String(err) })
    } finally {
      if (decodedImage) decodedImage.src = ''
    }
  }

  return { exported, skipped, failed }
}
