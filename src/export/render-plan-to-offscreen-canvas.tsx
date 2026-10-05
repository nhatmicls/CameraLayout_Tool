import { createRoot } from 'react-dom/client'
import { flushSync } from 'react-dom'
import type Konva from 'konva'
import { Stage } from 'react-konva'
import type { PlacedCamera, Wall } from '../domain/project-types'
import { PlanSceneLayers } from '../canvas/plan-scene-layers'

export interface RenderPlanToOffscreenCanvasOptions {
  decodedImage: HTMLImageElement
  imageWidthPx: number
  imageHeightPx: number
  cameras: PlacedCamera[]
  walls: Wall[]
  planPxPerMeter: number
  /** Export downscale factor (<=1). Konva's `pixelRatio` scales the *rasterised* output while the Stage/scene stays in image-px coordinates. */
  pixelRatio: number
}

const MAX_READY_POLL_FRAMES = 10

/** Resolves once `stageRef.current` is attached, or rejects after a bounded number of animation frames. Defensive fallback only - `renderPlanToOffscreenCanvas` expects `flushSync` to attach the ref synchronously in the normal case. */
function waitForStageRef(getStage: () => Konva.Stage | null): Promise<Konva.Stage> {
  return new Promise((resolve, reject) => {
    let attemptsLeft = MAX_READY_POLL_FRAMES
    const tryAgain = () => {
      const stage = getStage()
      if (stage) {
        resolve(stage)
        return
      }
      attemptsLeft -= 1
      if (attemptsLeft <= 0) {
        reject(new Error('Offscreen export stage never attached after waiting several frames.'))
        return
      }
      requestAnimationFrame(tryAgain)
    }
    requestAnimationFrame(tryAgain)
  })
}

/**
 * Renders the same `PlanSceneLayers` scene used on-screen (`interactive`
 * false: no selection ring, rotation handle, or drag wiring) into a
 * detached, image-native-size Konva Stage, and returns a plain
 * `HTMLCanvasElement` with the result. No drawing code is duplicated - this
 * is the only other mount point for that component besides
 * `floor-plan-stage.tsx`.
 *
 * The container is attached to `document.body` (off-screen, never visible)
 * because react-konva's `Stage` ref does not attach on a container that is
 * never inserted into the document. Mounting through `flushSync` forces
 * React's commit (and so the ref callback) to run before this function
 * continues, which is a deterministic readiness signal - no polling needed
 * in the normal case. `stage.toCanvas` always performs its own fresh render
 * pass onto a new canvas, so no additional "has it drawn yet" wait is
 * needed once the Stage instance itself exists.
 */
export async function renderPlanToOffscreenCanvas(
  options: RenderPlanToOffscreenCanvasOptions,
): Promise<HTMLCanvasElement> {
  const container = document.createElement('div')
  container.style.cssText = 'position:fixed; left:-99999px; top:-99999px; width:1px; height:1px; overflow:hidden;'
  document.body.appendChild(container)

  const root = createRoot(container)
  let stage: Konva.Stage | null = null

  try {
    flushSync(() => {
      root.render(
        <Stage
          ref={(node) => {
            stage = node
          }}
          width={options.imageWidthPx}
          height={options.imageHeightPx}
        >
          <PlanSceneLayers
            decodedImage={options.decodedImage}
            imageWidthPx={options.imageWidthPx}
            imageHeightPx={options.imageHeightPx}
            cameras={options.cameras}
            walls={options.walls}
            planPxPerMeter={options.planPxPerMeter}
            interactive={false}
            selectedCameraId={null}
            selectedWallId={null}
            wallsSelectable={false}
            viewportScale={1}
            onSelectCamera={() => {}}
            onSelectWall={() => {}}
            onMoveWallNode={() => {}}
            onCameraDragEnd={() => {}}
            onCameraRotateEnd={() => {}}
          />
        </Stage>,
      )
    })

    const attachedStage = stage ?? (await waitForStageRef(() => stage))
    return attachedStage.toCanvas({ pixelRatio: options.pixelRatio })
  } finally {
    root.unmount()
    container.remove()
  }
}
