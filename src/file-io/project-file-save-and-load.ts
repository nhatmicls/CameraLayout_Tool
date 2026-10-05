/**
 * Project save/load: the only place that turns a `Project` into a
 * downloaded `.json` file and back. All schema validation lives in
 * `src/domain/project-file-schema.ts` - this module is pure file/DOM
 * plumbing around it (read file -> validate -> decode embedded image).
 */
import { parseProjectFile, serializeProject } from '../domain/project-file-schema'
import type { Project } from '../domain/project-types'
import { sanitiseDownloadFileName, triggerBrowserFileDownload } from './trigger-browser-file-download'

/** Guards against reading a huge file into memory at all; matches the schema's own text-length cap. */
const MAX_LOAD_FILE_SIZE_BYTES = 80 * 1024 * 1024 // 80 MB

function formatMegabytes(bytes: number): string {
  return (bytes / (1024 * 1024)).toFixed(1)
}

/** `<image-base-name>-camera-layout.json`, per the phase spec. */
export function deriveProjectFileName(imageFileName: string): string {
  const base = imageFileName.replace(/\.[^./\\]+$/, '').trim()
  return `${base.length > 0 ? base : 'project'}-camera-layout.json`
}

/** Serialises `project` and triggers a browser download of it. */
export function saveProjectToFile(project: Project): void {
  const json = serializeProject(project)
  const fileName = sanitiseDownloadFileName(deriveProjectFileName(project.image.fileName))
  triggerBrowserFileDownload(json, fileName, 'application/json')
}

export type LoadProjectOutcome =
  | { ok: true; project: Project; decodedImage: HTMLImageElement; warnings: string[] }
  | { ok: false; error: string }

/** Decodes a project's embedded `data:image/...` URL, rejecting with a user-facing message on any failure. */
function decodeEmbeddedImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const element = new Image()
    element.onload = () => {
      element
        .decode()
        .then(() => resolve(element))
        .catch(() => reject(new Error('The project file is corrupt: its embedded image failed to decode.')))
    }
    element.onerror = () => reject(new Error('The project file is corrupt: its embedded image failed to decode.'))
    element.src = dataUrl
  })
}

/**
 * Reads, validates, and decodes a project file. Never throws - every
 * failure path (oversized file, unreadable file, invalid JSON/schema,
 * corrupt embedded image) resolves to `{ ok: false, error }`, leaving the
 * caller's current project untouched. On success, the returned image's
 * `widthPx`/`heightPx` are the decoded element's real dimensions, not
 * whatever the file claimed (the decode is the source of truth).
 */
export async function loadProjectFromFile(file: File, knownModelIds: ReadonlySet<string>): Promise<LoadProjectOutcome> {
  if (file.size > MAX_LOAD_FILE_SIZE_BYTES) {
    return {
      ok: false,
      error: `Project file is ${formatMegabytes(file.size)} MB; the maximum is ${formatMegabytes(MAX_LOAD_FILE_SIZE_BYTES)} MB.`,
    }
  }

  let text: string
  try {
    text = await file.text()
  } catch {
    return { ok: false, error: 'Failed to read the project file. It may be locked or unreadable.' }
  }

  const parsed = parseProjectFile(text, knownModelIds)
  if (!parsed.ok) {
    return { ok: false, error: parsed.error }
  }

  let decodedImage: HTMLImageElement
  try {
    decodedImage = await decodeEmbeddedImage(parsed.project.image.dataUrl)
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Failed to decode the embedded image.' }
  }

  const project: Project = {
    ...parsed.project,
    image: {
      ...parsed.project.image,
      widthPx: decodedImage.naturalWidth,
      heightPx: decodedImage.naturalHeight,
    },
  }

  return { ok: true, project, decodedImage, warnings: parsed.warnings }
}
