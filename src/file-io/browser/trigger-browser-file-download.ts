/**
 * Shared download primitive: takes a `Blob` (or raw string content) and a
 * file name, and triggers a browser download via a temporary, never-shown
 * `<a download>` link. Used by both PNG/CSV export (phase 7) and project
 * save (phase 6) - one place owns the "how" of a local-only download so it
 * is never duplicated.
 */
// eslint-disable-next-line no-control-regex -- intentional: stripping control characters is the point of this sanitiser
const PATH_SEPARATOR_OR_CONTROL_CHAR_PATTERN = /[\\/\x00-\x1f]/g

/**
 * Strips characters from a proposed download file name that could escape
 * the downloads folder (path separators) or confuse a filesystem/shell
 * (control characters), one-for-one with `_` (no collapsing - keeps the
 * result predictable). Falls back to `download` when nothing but
 * whitespace survives. Added alongside `triggerBrowserFileDownload` since
 * both phase 6 (project save) and phase 7 (PNG/CSV export) build their
 * final file name from user-controlled input (the loaded image's file
 * name) before calling it.
 */
export function sanitiseDownloadFileName(fileName: string): string {
  const trimmed = fileName.trim()
  if (trimmed.length === 0) return 'download'
  return trimmed.replace(PATH_SEPARATOR_OR_CONTROL_CHAR_PATTERN, '_')
}

export function triggerBrowserFileDownload(content: Blob | string, fileName: string, mimeType?: string): void {
  const blob = typeof content === 'string' ? new Blob([content], { type: mimeType ?? 'text/plain' }) : content
  const url = URL.createObjectURL(blob)

  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  link.rel = 'noopener'
  document.body.appendChild(link)
  link.click()
  link.remove()

  // Revoke on a short delay rather than synchronously: Firefox has been
  // observed to cancel a blob: download when the object URL is revoked in
  // the same tick as the click that started it.
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}
