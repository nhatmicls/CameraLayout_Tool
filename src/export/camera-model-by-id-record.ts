import { cameraModels } from '../catalog/camera-catalog-loader'
import type { CameraModelSpec } from '../domain/project-types'

/**
 * `groupCamerasIntoBom` (phase 3) takes a plain `Record<string, CameraModelSpec>`
 * on purpose - keeps the domain layer catalog-agnostic. Both export
 * orchestrators (PNG strip + CSV) need the same lookup, so it is built once
 * here rather than duplicated. The static catalog never changes at runtime,
 * so this is cheap to call per export.
 */
export function buildCameraModelByIdRecord(): Record<string, CameraModelSpec> {
  return Object.fromEntries(cameraModels.map((model) => [model.id, model]))
}
