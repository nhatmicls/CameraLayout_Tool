import { useCallback, useEffect, useRef, useState, type DragEvent } from 'react'
import type Konva from 'konva'
import type { KonvaEventObject } from 'konva/lib/Node'
import { Stage } from 'react-konva'
import { useProjectStore } from '../state/project-store'
import { useEditorUiStore } from '../state/editor-ui-store'
import { useStagePanZoom } from './use-stage-pan-zoom'
import { ScaleCalibrationOverlay } from './scale-calibration-overlay'
import { ScaleCalibrationLengthDialog } from '../panels/scale-calibration-length-dialog'
import { PlanSceneLayers } from './plan-scene-layers'
import { CameraDebugList } from './camera-debug-list'
import { useCameraDragDropTarget } from './use-camera-drag-drop-target'
import { useCameraSelectionKeyboardShortcuts } from './use-camera-selection-keyboard-shortcuts'
import { computePlanPxPerMeter, type RefLine } from '../domain/scale-calibration-calculator'

/**
 * The centre canvas: a Konva Stage sized to its container, with the plan
 * scene (image + cones + markers - `plan-scene-layers.tsx`) and the
 * calibration overlay on top. Pan/zoom is purely a stage transform -
 * positions painted here are always in image pixels (see `project-types.ts`).
 */
export function FloorPlanStage() {
  const image = useProjectStore((s) => s.image)
  const scale = useProjectStore((s) => s.scale)
  const setScale = useProjectStore((s) => s.setScale)
  const cameras = useProjectStore((s) => s.cameras)
  const updateCamera = useProjectStore((s) => s.updateCamera)
  const decodedImage = useEditorUiStore((s) => s.decodedImage)
  const setToolMode = useEditorUiStore((s) => s.setToolMode)
  const pushNotification = useEditorUiStore((s) => s.pushNotification)
  const setStageSize = useEditorUiStore((s) => s.setStageSize)
  const selectedCameraId = useEditorUiStore((s) => s.selectedCameraId)
  const setSelectedCameraId = useEditorUiStore((s) => s.setSelectedCameraId)

  const containerRef = useRef<HTMLDivElement>(null)
  const stageRef = useRef<Konva.Stage>(null)
  const [pendingLine, setPendingLine] = useState<RefLine | null>(null)

  const { viewport, draggable, stageSize, handleWheel, handleDragEnd, fitToView } = useStagePanZoom()
  const { handleDragOver, handleDrop } = useCameraDragDropTarget(stageRef)
  useCameraSelectionKeyboardShortcuts()

  // Keep the stage sized to its flex container (the container, not the window, since side panels resize it too).
  // Written to editor-ui-store (not local state) so the toolbar's zoom/fit buttons can use the same size.
  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (entry) setStageSize({ width: entry.contentRect.width, height: entry.contentRect.height })
    })
    observer.observe(container)
    return () => observer.disconnect()
  }, [setStageSize])

  // Fit the plan to the view whenever a new image is loaded (and we already know the container size).
  const fileNameRef = useRef<string | null>(null)
  useEffect(() => {
    if (!image || stageSize.width === 0 || stageSize.height === 0) return
    if (fileNameRef.current === image.fileName) return
    fileNameRef.current = image.fileName
    fitToView()
  }, [image, stageSize, fitToView])

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

  // Clicking empty canvas (the Stage itself, not a camera marker) deselects.
  const handleStageClick = useCallback(
    (e: KonvaEventObject<MouseEvent | TouchEvent>) => {
      if (e.target === e.target.getStage()) setSelectedCameraId(null)
    },
    [setSelectedCameraId],
  )

  const handleDropOnStage = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      const newCameraId = handleDrop(e)
      if (newCameraId) setSelectedCameraId(newCameraId)
    },
    [handleDrop, setSelectedCameraId],
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
      className="relative h-full w-full overflow-hidden bg-neutral-200"
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
            planPxPerMeter={scale?.planPxPerMeter ?? 1}
            interactive
            selectedCameraId={selectedCameraId}
            viewportScale={viewport.scale}
            onSelectCamera={setSelectedCameraId}
            onCameraDragEnd={handleCameraDragEnd}
            onCameraRotateEnd={handleCameraRotateEnd}
          />
          <ScaleCalibrationOverlay
            stageRef={stageRef}
            viewportScale={viewport.scale}
            dialogOpen={pendingLine !== null}
            onLineDrawn={handleLineDrawn}
          />
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
