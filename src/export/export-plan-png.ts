import { groupCamerasIntoBom } from '../domain/bill-of-materials-grouping'
import { groupSensorsIntoBom } from '../domain/sensor-bill-of-materials-grouping'
import { computeBomStripLayout, computeExportScale } from '../domain/export-image-layout-calculator'
import { resolveEffectiveHfovDeg } from '../domain/camera-coverage-resolver'
import { isApproximateDoriModel } from '../domain/dori-zone-distance-calculator'
import type { PlacedCamera, PlanImage, ScaleCalibration, Wall } from '../domain/project-types'
import { SENSOR_KIND_DISPLAY_ORDER, type PlacedSensor, type SensorKind, type SensorModelSpec } from '../domain/sensor-types'
import { hasGlassWallClippingAnySensor } from '../domain/sensor-wall-blocking-rules'
import { triggerBrowserFileDownload } from '../file-io/trigger-browser-file-download'
import { buildCameraModelByIdRecord } from './camera-model-by-id-record'
import { buildSensorModelByIdRecord } from './sensor-model-by-id-record'
import { canAllocateCanvas, SAFARI_SAFE_MAX_CANVAS_PIXELS, SAFARI_SAFE_MAX_CANVAS_SIDE_PX } from './probe-max-canvas-size'
import { renderPlanToOffscreenCanvas } from './render-plan-to-offscreen-canvas'
import { drawBomTableAndLegendStrip } from './draw-bom-table-and-legend-strip'
import { isPixelDataBlank, type RgbaSample } from './is-pixel-data-blank'
import { sanitizeExportFileName } from './sanitize-export-file-name'

/** Unique kinds among `sensors` whose model is known (skips a dangling `modelId`, same as the BOM grouping), in `SENSOR_KIND_DISPLAY_ORDER`. */
function resolveSensorKindsPresent(sensors: readonly PlacedSensor[], sensorModelById: Record<string, SensorModelSpec>): SensorKind[] {
  const present = new Set<SensorKind>()
  for (const sensor of sensors) {
    const model = sensorModelById[sensor.modelId]
    if (model) present.add(model.kind)
  }
  return SENSOR_KIND_DISPLAY_ORDER.filter((kind) => present.has(kind))
}

export interface ExportPlanPngOptions {
  decodedImage: HTMLImageElement
  image: PlanImage
  cameras: PlacedCamera[]
  walls: Wall[]
  sensors: PlacedSensor[]
  /** Null is valid (e.g. exporting before calibrating) - the plan still renders at a 1:1 pixel/unit fallback, matching `floor-plan-stage.tsx`'s own `scale?.planPxPerMeter ?? 1`. */
  scale: ScaleCalibration | null
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

function canvasToPngBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob)
      else reject(new Error('Canvas failed to encode a PNG blob.'))
    }, 'image/png')
  })
}

/** Samples a 3x3 grid spread across the canvas (not just corners, which the white strip background would dominate) for the post-render blank check. */
function sampleCanvasPixels(ctx: CanvasRenderingContext2D, widthPx: number, heightPx: number): RgbaSample[] {
  const fractions = [0.1, 0.5, 0.9]
  const samples: RgbaSample[] = []
  for (const fx of fractions) {
    for (const fy of fractions) {
      const x = Math.min(widthPx - 1, Math.max(0, Math.round(fx * widthPx)))
      const y = Math.min(heightPx - 1, Math.max(0, Math.round(fy * heightPx)))
      const [r, g, b, a] = ctx.getImageData(x, y, 1, 1).data
      samples.push([r, g, b, a])
    }
  }
  return samples
}

/**
 * Exports the floor plan (image-native resolution, cameras/cones/DORI
 * bands and walls exactly as on screen, no selection UI) plus a BOM strip beneath it
 * as a single PNG download. Downscales uniformly (plan and strip together)
 * when the combined canvas would exceed the browser-safe size, and reports
 * that back via `onDownscaled` rather than failing or silently cropping.
 * Every intermediate canvas is released before returning, success or not.
 */
export async function exportPlanPng(options: ExportPlanPngOptions): Promise<void> {
  const modelById = buildCameraModelByIdRecord()
  const sensorModelById = buildSensorModelByIdRecord()
  const rows = [...groupCamerasIntoBom(options.cameras, modelById), ...groupSensorsIntoBom(options.sensors, sensorModelById)]
  const sensorKindsPresent = resolveSensorKindsPresent(options.sensors, sensorModelById)
  const legendLineCount = sensorKindsPresent.length > 0 ? 2 : 1
  const layout = computeBomStripLayout(options.image.widthPx, rows.length, legendLineCount)

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
      planPxPerMeter: options.scale?.planPxPerMeter ?? 1,
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
      sensorKindsPresent,
    })

    if (isPixelDataBlank(sampleCanvasPixels(ctx, outputWidthPx, outputHeightPx))) {
      throw new Error('Export produced a blank image - aborting instead of downloading an empty file.')
    }

    const blob = await canvasToPngBlob(finalCanvas)
    const fileName = `${sanitizeExportFileName(options.image.fileName)}-camera-layout.png`
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
