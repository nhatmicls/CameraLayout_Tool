import { z } from 'zod'
import type { PlacedCamera, Project } from './project-types'

/** Bumped whenever the saved-file shape changes in a non-backward-compatible way. */
export const PROJECT_SCHEMA_VERSION = 1 as const

/** Mirrors `serializeCsv`'s input cap intent: generous for a floor-plan PNG, small enough to reject garbage quickly. */
const MAX_PROJECT_TEXT_LENGTH_BYTES = 80 * 1024 * 1024 // 80 MB

const DATA_URL_PATTERN = /^data:image\/(png|jpeg);base64,[A-Za-z0-9+/=]+$/

const planImageSchema = z.strictObject({
  dataUrl: z
    .string()
    .max(MAX_PROJECT_TEXT_LENGTH_BYTES)
    .regex(DATA_URL_PATTERN, 'image must be a base64 data:image/png or data:image/jpeg URL'),
  widthPx: z.number().int().min(1).max(32767),
  heightPx: z.number().int().min(1).max(32767),
  fileName: z.string().min(1).max(260),
})

const refLineSchema = z.strictObject({
  x1: z.number().finite(),
  y1: z.number().finite(),
  x2: z.number().finite(),
  y2: z.number().finite(),
})

const scaleCalibrationSchema = z.strictObject({
  planPxPerMeter: z.number().finite().gt(0),
  refLine: refLineSchema,
  refLengthM: z.number().finite().gt(0),
})

const placedCameraSchema = z.strictObject({
  id: z.string().min(1),
  modelId: z.string().min(1),
  x: z.number().finite(),
  y: z.number().finite(),
  rotationDeg: z.number().finite(),
  hfovDeg: z.number().finite().gt(0).lte(360).optional(),
  rangeM: z.number().finite().gt(0).lte(500),
})

const MAX_CAMERAS = 500

const projectFileSchema = z.strictObject({
  app: z.literal('camera-layout-tool'),
  schemaVersion: z.literal(PROJECT_SCHEMA_VERSION),
  image: planImageSchema,
  scale: scaleCalibrationSchema.nullable(),
  cameras: z.array(placedCameraSchema).max(MAX_CAMERAS),
})

/** Serialises a project to the on-disk JSON shape (adds the `app`/`schemaVersion` envelope). */
export function serializeProject(project: Project): string {
  return JSON.stringify({
    app: 'camera-layout-tool',
    schemaVersion: PROJECT_SCHEMA_VERSION,
    image: project.image,
    scale: project.scale,
    cameras: project.cameras,
  })
}

function formatZodError(error: z.ZodError): string {
  const first = error.issues[0]
  const path = first.path.length > 0 ? first.path.join('.') : '(root)'
  return `${path}: ${first.message}`
}

export type ParseProjectResult =
  | { ok: true; project: Project; warnings: string[] }
  | { ok: false; error: string }

/**
 * Parses untrusted project-file text. This is the single trust boundary for
 * loaded JSON: size cap, strict schema (rejects unknown keys and any
 * non-finite number), image restricted to inline PNG/JPEG data URLs, and
 * camera/model cross-check against the caller's known catalog ids. Never
 * throws - every failure mode returns `{ ok: false, error }`.
 */
export function parseProjectFile(text: string, knownModelIds: ReadonlySet<string>): ParseProjectResult {
  try {
    if (text.length > MAX_PROJECT_TEXT_LENGTH_BYTES) {
      return {
        ok: false,
        error: `Project file is too large (${text.length} bytes, max ${MAX_PROJECT_TEXT_LENGTH_BYTES}).`,
      }
    }

    let raw: unknown
    try {
      raw = JSON.parse(text)
    } catch {
      return { ok: false, error: 'Project file is not valid JSON.' }
    }

    const result = projectFileSchema.safeParse(raw)
    if (!result.success) {
      return { ok: false, error: `Invalid project file: ${formatZodError(result.error)}` }
    }

    const warnings: string[] = []
    const cameras: PlacedCamera[] = result.data.cameras.filter((camera) => {
      if (knownModelIds.has(camera.modelId)) return true
      warnings.push(`Camera "${camera.id}" references unknown model "${camera.modelId}"; dropped.`)
      return false
    })

    const project: Project = {
      image: result.data.image,
      scale: result.data.scale,
      cameras,
    }

    return { ok: true, project, warnings }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Unknown error parsing project file.' }
  }
}
