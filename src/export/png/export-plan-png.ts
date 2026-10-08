import { computeBomStripLayout, computeExportScale } from '../../domain/export/export-image-layout-calculator'
import { resolveEffectiveHfovDeg } from '../../domain/camera/camera-coverage-resolver'
import { isApproximateDoriModel } from '../../domain/camera/dori-zone-distance-calculator'
import type { BomRow } from '../../domain/bom/bill-of-materials-grouping'
import type { CableLayoutEstimate } from '../../domain/cable/cable-layout-estimate'
import type { CableLimitStatus } from '../../domain/cable/cable-length-estimate-calculator'
import type { CableLayout, Shaft } from '../../domain/cable/cable-layout-types'
import type { CompatibilityWarning } from '../../domain/fire-alarm/fire-alarm-compatibility-checker'
import type { FireAlarmSettings, PlacedFireAlarmDevice } from '../../domain/fire-alarm/fire-alarm-device-types'
import type { PlacedCamera, PlanImage, ScaleCalibration, Wall } from '../../domain/project-file/project-types'
import type { PlacedSensor } from '../../domain/sensor/sensor-types'
import { hasGlassWallClippingAnySensor } from '../../domain/sensor/sensor-wall-blocking-rules'
import type { ViewConfig } from '../../domain/view/view-config-types'
import { triggerBrowserFileDownload } from '../../file-io/browser/trigger-browser-file-download'
import { buildCameraModelByIdRecord } from '../shared/camera-model-by-id-record'
import { buildSensorModelByIdRecord } from '../shared/sensor-model-by-id-record'
import { buildExportLegends, type FloorPositionContext } from './build-export-legends'
import { canAllocateCanvas, SAFARI_SAFE_MAX_CANVAS_PIXELS, SAFARI_SAFE_MAX_CANVAS_SIDE_PX } from './probe-max-canvas-size'
import { renderPlanToOffscreenCanvas } from './render-plan-to-offscreen-canvas'
import { drawBomTableAndLegendStrip, legendLineCountFor } from './draw-bom-table-and-legend-strip'
import { canvasToPngBlob, sampleCanvasPixels } from './export-canvas-pixel-helpers'
import { isPixelDataBlank } from './is-pixel-data-blank'
import { sanitizeExportFileName } from '../shared/sanitize-export-file-name'

export interface ExportPlanPngOptions extends CableLayout {
  decodedImage: HTMLImageElement
  image: PlanImage
  cameras: PlacedCamera[]
  walls: Wall[]
  sensors: PlacedSensor[]
  fireAlarmDevices: PlacedFireAlarmDevice[]
  fireAlarmSettings: FireAlarmSettings
  /** Null is valid (e.g. exporting before calibrating) - the plan still renders at a 1:1 pixel/unit fallback, matching `floor-plan-stage.tsx`'s own `scale?.planPxPerMeter ?? 1`. Fire-detector coverage circles draw only when non-null (`renderPlanToOffscreenCanvas`'s `scaleIsSet`). */
  scale: ScaleCalibration | null
  /** This floor's own slice of the ONE project cable estimate (`useCableLayoutEstimate`/`computeProjectCableEstimate`), cross-floor contributions already resolved - the caller computes this, never `exportPlanPng` itself. Drives the legend numbers AND which cable lines draw over-length. */
  cableEstimate: CableLayoutEstimate
  /** This floor's own BOM rows (`buildCombinedBomRows(project, {floorId}).allRows`, phase 7) - the caller computes these, never `exportPlanPng` itself, so the strip's table can never drift from the panel/CSV. */
  rows: BomRow[]
  /** Same call's `fireAlarmWarnings` - drives the legend's compatibility-warning line. */
  fireAlarmWarnings: CompatibilityWarning[]
  /** The project's `shafts[]` ids, in order - so a shaft marker's "T{n}" on the picture matches the screen (phase 6). Omitted on every pre-shaft caller/test. */
  shaftIds?: readonly string[]
  /** The project's `shafts[]` (id + name) - lets the strip name the shafts that have a marker on THIS floor ("Shafts: T1 Main riser"). Omitted on every pre-phase-7 caller/test (no note). */
  shafts?: readonly Shaft[]
  /** This floor's position in the project, for the "F2 of 3 - Level 2" strip note - `undefined` or `count <= 1` draws no note (one-floor regression). */
  floorPosition?: FloorPositionContext
  /** Overrides the file name this plan's `buildFloorExportFileName` computed - omitted falls back to today's single-floor name from `image.fileName` (every pre-phase-7 caller/test). */
  fileName?: string
  /** What the plan DRAWING shows - the caller passes the tool-effective config, i.e. what is on screen. Legend lines and BOM rows never follow it. */
  viewConfig: ViewConfig
  /** Injectable for deterministic tests; defaults to "now". */
  now?: Date
  /** Override hooks for the canvas-size limit - lets a caller force the downscale path without editing the shared constants. Defaults to the Safari-safe limits. */
  maxCanvasPixels?: number
  maxCanvasSidePx?: number
  /** Called only when the output was actually downscaled, so the caller can show a notification. */
  onDownscaled?: (outputWidthPx: number, outputHeightPx: number, scaleFactor: number) => void
}

/** Appended to the strip's scale note when the plan has an opaque wall. Short on purpose: the note is right-aligned and never truncated. */
const WALL_OCCLUSION_NOTE_SUFFIX = '  ·  Walls: 2D'

function formatIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10)
}

/**
 * Exports the floor plan (image-native resolution, cameras/cones/DORI
 * bands, walls, hubs and cables exactly as on screen, no selection UI) plus a BOM strip beneath it
 * as a single PNG download. The drawing follows `viewConfig`; when that hides anything the strip
 * says so in a "Shown / Hidden" note, while the legend lines and the BOM stay complete. Downscales uniformly (plan and strip together)
 * when the combined canvas would exceed the browser-safe size, and reports
 * that back via `onDownscaled` rather than failing or silently cropping.
 * Every intermediate canvas is released before returning, success or not.
 */
export async function exportPlanPng(options: ExportPlanPngOptions): Promise<void> {
  const modelById = buildCameraModelByIdRecord()
  const sensorModelById = buildSensorModelByIdRecord()
  // Rows/cableEstimate/fireAlarmWarnings are the CALLER's `buildCombinedBomRows(project, {floorId})`
  // result (phase 7) - this function builds no BOM rows of its own, so the strip can never drift
  // from the panel/CSV.
  const { rows, cableEstimate, fireAlarmWarnings } = options
  const limitStatusById: ReadonlyMap<string, CableLimitStatus> = new Map(
    cableEstimate.cables.map((cable) => [cable.cableId, cable.limitStatus]),
  )
  // The font size depends on the image width only, so it is known before the final layout.
  const { fontPx } = computeBomStripLayout(options.image.widthPx, rows.length)
  // Built before the layout: the strip's height depends on how many legend lines its content draws.
  const legends = buildExportLegends(options, fireAlarmWarnings, sensorModelById, fontPx)
  const layout = computeBomStripLayout(options.image.widthPx, rows.length, legendLineCountFor(legends))

  const maxPixels = options.maxCanvasPixels ?? SAFARI_SAFE_MAX_CANVAS_PIXELS
  const maxSidePx = options.maxCanvasSidePx ?? SAFARI_SAFE_MAX_CANVAS_SIDE_PX
  const totalHeightPx = options.image.heightPx + layout.stripHeightPx
  const scale = computeExportScale(options.image.widthPx, totalHeightPx, maxPixels, maxSidePx)

  const outputWidthPx = Math.max(1, Math.round(options.image.widthPx * scale))
  const outputHeightPx = Math.max(1, Math.round(totalHeightPx * scale))

  if (!canAllocateCanvas(outputWidthPx, outputHeightPx)) {
    throw new Error(
      `This browser cannot allocate a ${outputWidthPx}x${outputHeightPx} canvas. Try a smaller floor-plan image.`,
    )
  }

  let planCanvas: HTMLCanvasElement | null = null
  let finalCanvas: HTMLCanvasElement | null = null

  try {
    planCanvas = await renderPlanToOffscreenCanvas({
      decodedImage: options.decodedImage,
      imageWidthPx: options.image.widthPx,
      imageHeightPx: options.image.heightPx,
      cameras: options.cameras,
      walls: options.walls,
      sensors: options.sensors,
      fireAlarmDevices: options.fireAlarmDevices,
      fireAlarmSettings: options.fireAlarmSettings,
      planPxPerMeter: options.scale?.planPxPerMeter ?? 1,
      cabling: {
        hubs: options.hubs,
        cables: options.cables,
        cableTypes: options.cableTypes,
        cableSettings: options.cableSettings,
        scale: options.scale,
        limitStatusById,
        shaftIds: options.shaftIds,
      },
      viewConfig: options.viewConfig,
      pixelRatio: scale,
    })

    finalCanvas = document.createElement('canvas')
    finalCanvas.width = outputWidthPx
    finalCanvas.height = outputHeightPx
    const ctx = finalCanvas.getContext('2d')
    if (!ctx) throw new Error('2D canvas context unavailable in this browser.')

    // Opaque white background - the export must never carry transparency.
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, outputWidthPx, outputHeightPx)
    ctx.drawImage(planCanvas, 0, 0)

    const hasApproximateDoriModel = options.cameras.some((camera) => {
      const model = modelById[camera.modelId]
      if (!model) return false
      return isApproximateDoriModel(resolveEffectiveHfovDeg(model.lens, camera.hfovDeg))
    })

    const scaleNote = options.scale ? `1 m = ${options.scale.planPxPerMeter.toFixed(1)} px` : 'Scale not set'
    const hasOpaqueWall = options.walls.some((wall) => wall.kind === 'opaque')
    // A glass wall draws no occlusion note on its own (glass never clips a camera), but it
    // DOES clip a PIR/thermal sensor's coverage - the note must appear for that combination
    // too, not just an opaque wall.
    const showWallOcclusionNote = hasOpaqueWall || hasGlassWallClippingAnySensor(options.walls, options.sensors, sensorModelById)

    drawBomTableAndLegendStrip(ctx, options.image.heightPx * scale, outputWidthPx, layout, scale, {
      rows,
      scaleNoteText: showWallOcclusionNote ? `${scaleNote}${WALL_OCCLUSION_NOTE_SUFFIX}` : scaleNote,
      dateText: `Exported ${formatIsoDate(options.now ?? new Date())}`,
      hasApproximateDoriModel,
      ...legends,
    })

    if (isPixelDataBlank(sampleCanvasPixels(ctx, outputWidthPx, outputHeightPx))) {
      throw new Error('Export produced a blank image - aborting instead of downloading an empty file.')
    }

    const blob = await canvasToPngBlob(finalCanvas)
    const fileName = options.fileName ?? `${sanitizeExportFileName(options.image.fileName)}-camera-layout.png`
    triggerBrowserFileDownload(blob, fileName)

    if (scale < 1) {
      options.onDownscaled?.(outputWidthPx, outputHeightPx, scale)
    }
  } finally {
    if (planCanvas) {
      planCanvas.width = 0
      planCanvas.height = 0
    }
    if (finalCanvas) {
      finalCanvas.width = 0
      finalCanvas.height = 0
    }
  }
}
