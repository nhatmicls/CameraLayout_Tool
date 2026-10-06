import { useCallback, useRef, useState, type DragEvent } from 'react'
import type Konva from 'konva'
import type { KonvaEventObject } from 'konva/lib/Node'
import { Layer, Stage } from 'react-konva'
import { useProjectStore } from '../../state/project-store'
import { useEditorUiStore } from '../../state/editor-ui-store'
import { useStagePanZoom } from './use-stage-pan-zoom'
import { ScaleCalibrationOverlay } from './scale-calibration-overlay'
import { WallDrawingOverlay } from '../wall/wall-drawing-overlay'
import { ScaleCalibrationLengthDialog } from '../../panels/app-shell/scale-calibration-length-dialog'
import { PlanSceneLayers } from './plan-scene-layers'
import { CameraDebugList } from '../camera/camera-debug-list'
import { useCameraDragDropTarget } from '../camera/use-camera-drag-drop-target'
import { useSensorDragDropTarget } from '../sensor/use-sensor-drag-drop-target'
import { useCameraSelectionKeyboardShortcuts } from '../camera/use-camera-selection-keyboard-shortcuts'
import { useWallSelectionKeyboardShortcuts } from '../wall/use-wall-selection-keyboard-shortcuts'
import { useSensorSelectionKeyboardShortcuts } from '../sensor/use-sensor-selection-keyboard-shortcuts'
import { useWallNodeMoveHandler } from '../wall/use-wall-node-move-handler'
import { useStageContainerResizeAndInitialFit } from './use-stage-container-resize-and-initial-fit'
import { computePlanPxPerMeter, type RefLine } from '../../domain/shared/scale-calibration-calculator'

/**
 * The centre canvas: a Konva Stage sized to its container, with the plan
 * scene (image + cones + walls + markers - `plan-scene-layers.tsx`) and the
 * editor-only calibration and wall-drawing overlays on top. Pan/zoom is purely a stage transform -
 * positions painted here are always in image pixels (see `project-types.ts`).
 */
export function FloorPlanStage() {
  const image = useProjectStore((s) => s.image)
  const scale = useProjectStore((s) => s.scale)
  const setScale = useProjectStore((s) => s.setScale)
  const cameras = useProjectStore((s) => s.cameras)
  const updateCamera = useProjectStore((s) => s.updateCamera)
  const walls = useProjectStore((s) => s.walls)
  const sensors = useProjectStore((s) => s.sensors)
  const updateSensor = useProjectStore((s) => s.updateSensor)
  const decodedImage = useEditorUiStore((s) => s.decodedImage)
  const toolMode = useEditorUiStore((s) => s.toolMode)
  const setToolMode = useEditorUiStore((s) => s.setToolMode)
  const pushNotification = useEditorUiStore((s) => s.pushNotification)
  const setStageSize = useEditorUiStore((s) => s.setStageSize)
  const selectedCameraId = useEditorUiStore((s) => s.selectedCameraId)
  const setSelectedCameraId = useEditorUiStore((s) => s.setSelectedCameraId)
  const selectedWallId = useEditorUiStore((s) => s.selectedWallId)
  const setSelectedWallId = useEditorUiStore((s) => s.setSelectedWallId)
  const selectedSensorId = useEditorUiStore((s) => s.selectedSensorId)
  const setSelectedSensorId = useEditorUiStore((s) => s.setSelectedSensorId)
  const clearSelection = useEditorUiStore((s) => s.clearSelection)

  const containerRef = useRef<HTMLDivElement>(null)
  const stageRef = useRef<Konva.Stage>(null)
  const [pendingLine, setPendingLine] = useState<RefLine | null>(null)

  const { viewport, draggable, stageSize, handleWheel, handleDragEnd, fitToView } = useStagePanZoom()
  const { handleDragOver: handleCameraDragOver, handleDrop: handleCameraDrop } = useCameraDragDropTarget(stageRef)
  const { handleDragOver: handleSensorDragOver, handleDrop: handleSensorDrop } = useSensorDragDropTarget(stageRef)
  useCameraSelectionKeyboardShortcuts()
  useWallSelectionKeyboardShortcuts()
  useSensorSelectionKeyboardShortcuts()
  const handleMoveWallNode = useWallNodeMoveHandler()

  useStageContainerResizeAndInitialFit(containerRef, image, stageSize, fitToView, setStageSize)

  const handleLineDrawn = useCallback((line: RefLine) => setPendingLine(line), [])

  const handleConfirmLength = useCallback(
    (lengthM: number) => {
      if (!pendingLine) return
      const planPxPerMeter = computePlanPxPerMeter(pendingLine, lengthM)
      setScale({ planPxPerMeter, refLine: pendingLine, refLengthM: lengthM })
      setPendingLine(null)
      setToolMode('select')
      pushNotification('info', `Scale set: 1 m = ${planPxPerMeter.toFixed(1)} px.`)
    },
    [pendingLine, setScale, setToolMode, pushNotification],
  )

  // Clicking empty canvas (the Stage itself, not a camera/wall/sensor marker) deselects all three.
  const handleStageClick = useCallback(
    (e: KonvaEventObject<MouseEvent | TouchEvent>) => {
      if (e.target !== e.target.getStage()) return
      clearSelection()
    },
    [clearSelection],
  )

  // Combined drag-over: each hook's handler only reacts to its own MIME type, so calling both is safe.
  const handleDragOver = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      handleCameraDragOver(e)
      handleSensorDragOver(e)
    },
    [handleCameraDragOver, handleSensorDragOver],
  )

  // Tries the camera payload first, then the sensor payload, and selects whichever one actually dropped.
  const handleDropOnStage = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      const newCameraId = handleCameraDrop(e)
      if (newCameraId) {
        setSelectedCameraId(newCameraId)
        return
      }
      const newSensorId = handleSensorDrop(e)
      if (newSensorId) setSelectedSensorId(newSensorId)
    },
    [handleCameraDrop, handleSensorDrop, setSelectedCameraId, setSelectedSensorId],
  )

  const handleCameraDragEnd = useCallback((id: string, x: number, y: number) => updateCamera(id, { x, y }), [updateCamera])

  const handleCameraRotateEnd = useCallback(
    (id: string, rotationDeg: number) => updateCamera(id, { rotationDeg }),
    [updateCamera],
  )

  if (!image || !decodedImage) return null

  return (
    <div
      ref={containerRef}
      data-testid="stage-container"
      className={`relative h-full w-full overflow-hidden bg-neutral-200 ${toolMode === 'wall' ? 'cursor-crosshair' : ''}`}
      onDragOver={handleDragOver}
      onDrop={handleDropOnStage}
    >
      {stageSize.width > 0 && stageSize.height > 0 && (
        <Stage
          ref={stageRef}
          width={stageSize.width}
          height={stageSize.height}
          x={viewport.x}
          y={viewport.y}
          scaleX={viewport.scale}
          scaleY={viewport.scale}
          draggable={draggable}
          onWheel={handleWheel}
          onDragEnd={handleDragEnd}
          onClick={handleStageClick}
          onTap={handleStageClick}
        >
          <PlanSceneLayers
            decodedImage={decodedImage}
            imageWidthPx={image.widthPx}
            imageHeightPx={image.heightPx}
            cameras={cameras}
            walls={walls}
            sensors={sensors}
            planPxPerMeter={scale?.planPxPerMeter ?? 1}
            interactive
            selectedCameraId={selectedCameraId}
            selectedWallId={selectedWallId}
            selectedSensorId={selectedSensorId}
            wallsSelectable={toolMode === 'select'}
            markersListening={toolMode !== 'wall'}
            viewportScale={viewport.scale}
            onSelectCamera={setSelectedCameraId}
            onSelectWall={setSelectedWallId}
            onSelectSensor={setSelectedSensorId}
            onMoveWallNode={handleMoveWallNode}
            onCameraDragEnd={handleCameraDragEnd}
            onCameraRotateEnd={handleCameraRotateEnd}
            onSensorCommit={updateSensor}
          />
          {/* One Layer for both editor overlays: with the scene's four that makes five, Konva's recommended maximum. */}
          <Layer>
            <ScaleCalibrationOverlay
              stageRef={stageRef}
              viewportScale={viewport.scale}
              dialogOpen={pendingLine !== null}
              onLineDrawn={handleLineDrawn}
            />
            <WallDrawingOverlay
              stageRef={stageRef}
              viewportScale={viewport.scale}
              imageWidthPx={image.widthPx}
              imageHeightPx={image.heightPx}
            />
          </Layer>
        </Stage>
      )}

      {pendingLine && (
        <ScaleCalibrationLengthDialog
          line={pendingLine}
          onCancel={() => setPendingLine(null)}
          onConfirm={handleConfirmLength}
        />
      )}

      <CameraDebugList cameras={cameras} />
    </div>
  )
}
