import { groupCamerasIntoBom } from '../domain/bill-of-materials-grouping'
import { computeBomStripLayout, computeExportScale } from '../domain/export-image-layout-calculator'
import { resolveEffectiveHfovDeg } from '../domain/camera-coverage-resolver'
import { isApproximateDoriModel } from '../domain/dori-zone-distance-calculator'
import type { PlacedCamera, PlanImage, ScaleCalibration } from '../domain/project-types'
import { triggerBrowserFileDownload } from '../file-io/trigger-browser-file-download'
import { buildCameraModelByIdRecord } from './camera-model-by-id-record'
import { canAllocateCanvas, SAFARI_SAFE_MAX_CANVAS_PIXELS, SAFARI_SAFE_MAX_CANVAS_SIDE_PX } from './probe-max-canvas-size'
import { renderPlanToOffscreenCanvas } from './render-plan-to-offscreen-canvas'
import { drawBomTableAndLegendStrip } from './draw-bom-table-and-legend-strip'
import { isPixelDataBlank, type RgbaSample } from './is-pixel-data-blank'
import { sanitizeExportFileName } from './sanitize-export-file-name'

export interface ExportPlanPngOptions {
  decodedImage: HTMLImageElement
  image: PlanImage
  cameras: PlacedCamera[]
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
 * bands exactly as on screen, no selection UI) plus a BOM strip beneath it
 * as a single PNG download. Downscales uniformly (plan and strip together)
 * when the combined canvas would exceed the browser-safe size, and reports
 * that back via `onDownscaled` rather than failing or silently cropping.
 * Every intermediate canvas is released before returning, success or not.
 */
export async function exportPlanPng(options: ExportPlanPngOptions): Promise<void> {
  const modelById = buildCameraModelByIdRecord()
  const rows = groupCamerasIntoBom(options.cameras, modelById)
  const layout = computeBomStripLayout(options.image.widthPx, rows.length)

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

    drawBomTableAndLegendStrip(ctx, options.image.heightPx * scale, outputWidthPx, layout, scale, {
      rows,
      scaleNoteText: options.scale ? `1 m = ${options.scale.planPxPerMeter.toFixed(1)} px` : 'Scale not set',
      dateText: `Exported ${formatIsoDate(options.now ?? new Date())}`,
      hasApproximateDoriModel,
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
