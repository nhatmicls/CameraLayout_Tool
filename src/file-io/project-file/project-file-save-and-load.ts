/**
 * Project save/load: the only place that turns a `Project` into a
 * downloaded `.json` file and back. All schema validation lives in
 * `src/domain/project-file/project-file-schema.ts` - this module is pure file/DOM
 * plumbing around it (read file -> validate -> decode every floor's embedded image).
 */
import { formatMegabytes } from '../../domain/shared/format-megabytes'
import { MAX_PROJECT_TEXT_LENGTH_BYTES } from '../../domain/project-file/project-file-floor-schema'
import type { Floor } from '../../domain/floor/floor-types'
import { parseProjectFile, serializeProject, type ProjectFileLookups } from '../../domain/project-file/project-file-schema'
import type { Project } from '../../domain/project-file/project-types'
import { decodeEmbeddedImage } from '../browser/decode-image-data-url'
import { sanitiseDownloadFileName, triggerBrowserFileDownload } from '../browser/trigger-browser-file-download'

/** Guards against reading a huge file into memory at all; matches the schema's own text-length cap. */
const MAX_LOAD_FILE_SIZE_BYTES = 80 * 1024 * 1024 // 80 MB

/** `<image-base-name>-camera-layout.json`, per the phase spec. */
export function deriveProjectFileName(imageFileName: string): string {
  const base = imageFileName.replace(/\.[^./\\]+$/, '').trim()
  return `${base.length > 0 ? base : 'project'}-camera-layout.json`
}

export type SaveProjectResult = { ok: true } | { ok: false; error: string }

/** Real UTF-8 byte length of `text` (NOT JS string `.length`, which counts UTF-16 code units) - exported for its own unit test; a multi-byte character (e.g. in a Vietnamese floor/camera name) needs more UTF-8 bytes than UTF-16 units. */
export function utf8ByteLength(text: string): number {
  return new TextEncoder().encode(text).length
}

/**
 * Serialises `project` and triggers a browser download of it. Refuses (no
 * download) rather than writing a file this same app's own loader would
 * then reject: the multi-floor image budget (`floor-image-budget.ts`)
 * guards adding an image, but several floors' images can still add up past
 * the schema's `MAX_PROJECT_TEXT_LENGTH_BYTES` cap one small edit at a time
 * (another camera, a longer cable route...), so the save path checks the
 * SAME limit the reader enforces, one last time, right before download.
 *
 * Measured in real UTF-8 BYTES (`TextEncoder`), not JS string `.length`
 * (UTF-16 code units): a floor/camera name with non-ASCII characters (a
 * Vietnamese name, say) can need more UTF-8 bytes than UTF-16 units, and
 * `MAX_LOAD_FILE_SIZE_BYTES` below - the gate that actually decides whether
 * a reopened file is even read at all - is real bytes too (`File.size`), so
 * this check must use the same unit to be a reliable predictor of it.
 */
export function saveProjectToFile(project: Project): SaveProjectResult {
  const json = serializeProject(project)
  const byteLength = utf8ByteLength(json)
  if (byteLength > MAX_PROJECT_TEXT_LENGTH_BYTES) {
    return {
      ok: false,
      error: `This project file would be ${formatMegabytes(byteLength)} MB; the maximum is ${formatMegabytes(MAX_PROJECT_TEXT_LENGTH_BYTES)} MB. Remove or replace a floor's image to shrink it.`,
    }
  }
  const sourceImageFileName = project.floors.find((floor) => floor.image !== null)?.image?.fileName ?? ''
  const fileName = sanitiseDownloadFileName(deriveProjectFileName(sourceImageFileName))
  triggerBrowserFileDownload(json, fileName, 'application/json')
  return { ok: true }
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
