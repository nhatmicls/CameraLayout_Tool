import type { RefObject } from 'react'
import type Konva from 'konva'
import { Layer } from 'react-konva'
import type { RefLine } from '../../domain/shared/scale-calibration-calculator'
import { CableDrawingOverlay } from '../cable/cable-drawing-overlay'
import { HubPlacementOverlay } from '../cable/hub-placement-overlay'
import { HubTrunkDrawingOverlay } from '../cable/hub-trunk-drawing-overlay'
import { ScaleCalibrationOverlay } from './scale-calibration-overlay'
import { WallDrawingOverlay } from '../wall/wall-drawing-overlay'

interface PlanEditorOverlaysLayerProps {
  stageRef: RefObject<Konva.Stage | null>
  viewportScale: number
  imageWidthPx: number
  imageHeightPx: number
  dialogOpen: boolean
  onLineDrawn: (line: RefLine) => void
  /** True while the shaft floor-range dialog is open for a just-clicked point. */
  shaftDialogOpen: boolean
  onShaftPoint: (point: { x: number; y: number }) => void
}

/**
 * One Layer for every editor-only overlay (calibration, wall drawing, hub
 * placement, cable drawing, trunk drawing) - with the plan scene's four
 * Layers that makes five, Konva's recommended maximum. Pulled out of
 * `floor-plan-stage.tsx` (pure move, no behaviour change) to keep that file
 * under the project's line-count guideline; the trunk overlay (phase 5)
 * reuses this same Layer rather than adding a sixth.
 */
export function PlanEditorOverlaysLayer({
  stageRef,
  viewportScale,
  imageWidthPx,
  imageHeightPx,
  dialogOpen,
  onLineDrawn,
  shaftDialogOpen,
  onShaftPoint,
}: PlanEditorOverlaysLayerProps) {
  return (
    <Layer>
      <ScaleCalibrationOverlay stageRef={stageRef} viewportScale={viewportScale} dialogOpen={dialogOpen} onLineDrawn={onLineDrawn} />
      <WallDrawingOverlay stageRef={stageRef} viewportScale={viewportScale} imageWidthPx={imageWidthPx} imageHeightPx={imageHeightPx} />
      <HubPlacementOverlay
        stageRef={stageRef}
        imageWidthPx={imageWidthPx}
        imageHeightPx={imageHeightPx}
        shaftDialogOpen={shaftDialogOpen}
        onShaftPoint={onShaftPoint}
      />
      <CableDrawingOverlay stageRef={stageRef} viewportScale={viewportScale} imageWidthPx={imageWidthPx} imageHeightPx={imageHeightPx} />
      <HubTrunkDrawingOverlay stageRef={stageRef} viewportScale={viewportScale} imageWidthPx={imageWidthPx} imageHeightPx={imageHeightPx} />
    </Layer>
  )
}
