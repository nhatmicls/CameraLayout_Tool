/**
 * Project save/load: the only place that turns a `Project` into a
 * downloaded `.json` file and back. All schema validation lives in
 * `src/domain/project-file/project-file-schema.ts` - this module is pure file/DOM
 * plumbing around it (read file -> validate -> decode every floor's embedded image).
 */
import type { Floor } from '../../domain/floor/floor-types'
import { parseProjectFile, serializeProject, type ProjectFileLookups } from '../../domain/project-file/project-file-schema'
import type { Project } from '../../domain/project-file/project-types'
import { decodeEmbeddedImage } from '../browser/decode-image-data-url'
import { sanitiseDownloadFileName, triggerBrowserFileDownload } from '../browser/trigger-browser-file-download'

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

/** Serialises `project` and triggers a browser download of it. The file name comes from the first floor (in tab order) that has an image. */
export function saveProjectToFile(project: Project): void {
  const json = serializeProject(project)
  const sourceImageFileName = project.floors.find((floor) => floor.image !== null)?.image?.fileName ?? ''
  const fileName = sanitiseDownloadFileName(deriveProjectFileName(sourceImageFileName))
  triggerBrowserFileDownload(json, fileName, 'application/json')
}

export type LoadProjectOutcome =
  | { ok: true; project: Project; warnings: string[] }
  | { ok: false; error: string }

/**
 * Reads, validates, and decodes a project file. Never throws - every
 * failure path (oversized file, unreadable file, invalid JSON/schema,
 * corrupt embedded image on ANY floor) resolves to `{ ok: false, error }`,
 * leaving the caller's current project untouched. Decodes every floor's
 * image sequentially so each floor's `widthPx`/`heightPx` become the
 * decoded element's real dimensions, not whatever the file claimed - the
 * decoded `HTMLImageElement`s themselves are discarded here;
 * `use-active-floor-decoded-image-sync.ts` is the only place that keeps one,
 * decoding the active floor's data URL again once `replaceProject` lands it
 * in the store (phase 2 removed the one-floor bridge that used to return it
 * from here).
 */
export async function loadProjectFromFile(file: File, lookups: ProjectFileLookups): Promise<LoadProjectOutcome> {
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

  const parsed = parseProjectFile(text, lookups)
  if (!parsed.ok) {
    return { ok: false, error: parsed.error }
  }

  const floors: Floor[] = []
  for (const floor of parsed.project.floors) {
    if (floor.image === null) {
      floors.push(floor)
      continue
    }

    let decoded: HTMLImageElement
    try {
      decoded = await decodeEmbeddedImage(floor.image.dataUrl)
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : 'Failed to decode the embedded image.' }
    }
    floors.push({ ...floor, image: { ...floor.image, widthPx: decoded.naturalWidth, heightPx: decoded.naturalHeight } })
  }

  const project: Project = { ...parsed.project, floors }
  return { ok: true, project, warnings: parsed.warnings }
}
